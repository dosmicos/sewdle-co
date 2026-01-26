
## Plan: Impresión de códigos de barras por artículo y modal manual

### Resumen de los cambios solicitados

1. **Botón de imprimir por artículo** - Agregar un botón de impresora al lado de cada artículo que aparezca solo después de guardar (cuando `quantity_approved > 0`)
2. **Sin necesidad de sincronización** - El botón de imprimir debe estar disponible inmediatamente después de guardar, sin esperar la sincronización con Shopify
3. **Botón superior manual** - Mantener el botón superior "Imprimir Códigos" pero convertirlo en una herramienta manual donde se pueda seleccionar el producto y la cantidad de códigos a imprimir

---

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/DeliveryDetails.tsx` | Agregar botón de impresión por artículo + estado y función para modal manual |
| `src/components/DeliveryReviewSummary.tsx` | Convertir botón de impresión automático a botón que abre modal manual |
| `src/components/delivery/DeliveryManualBarcodeModal.tsx` | **NUEVO** - Modal para impresión manual de códigos (seleccionar producto + cantidad) |

---

### Cambio 1: Agregar botón de impresión por artículo en DeliveryDetails.tsx

**Ubicación:** Dentro de la celda de acciones de cada fila de variante (líneas ~1339-1385)

**Lógica del botón:**
- Solo visible cuando `item.quantity_approved > 0` (artículo ya guardado con aprobados)
- Al hacer clic, imprime etiquetas para esa variante específica según `quantity_approved`
- Icono de impresora pequeño (`Printer` de lucide-react)

**Código a agregar en la sección de acciones por variante:**
```typescript
{/* Botón de imprimir códigos de barras - visible solo si hay aprobados */}
{item.quantity_approved > 0 && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => handlePrintItemBarcodes(item)}
    className="text-xs gap-1"
    title="Imprimir códigos de barras"
  >
    <Printer className="w-3 h-3" />
    Imprimir ({item.quantity_approved})
  </Button>
)}
```

**Nueva función `handlePrintItemBarcodes`:**
```typescript
const handlePrintItemBarcodes = (item: any) => {
  const variant = item.order_items?.product_variants;
  if (!variant) return;

  const productName = variant.products?.name || 'Producto';
  const variantText = [variant.size, variant.color].filter(Boolean).join(' - ');
  const sku = variant.sku_variant || '';
  const quantity = item.quantity_approved;

  // Generar etiquetas
  const labels = Array.from({ length: quantity }, (_, i) => ({
    sku,
    productName,
    variant: variantText,
    unitIndex: i + 1
  }));

  // Imprimir directamente
  printBarcodeLabels(labels);
};
```

**Nueva función `printBarcodeLabels` (reutilizable):**
```typescript
const printBarcodeLabels = (labels: Array<{sku: string; productName: string; variant: string; unitIndex: number}>) => {
  if (labels.length === 0) return;

  const labelsWithCompactText = labels.map(label => ({
    ...label,
    compactText: label.variant ? `${label.productName} - ${label.variant}` : label.productName
  }));

  const printWindow = window.open('', '_blank', 'width=600,height=400');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title></title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          width: 100mm;
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .page { 
          display: grid;
          grid-template-columns: repeat(2, 48mm);
          column-gap: 4mm;
          row-gap: 0;
          padding: 0;
          margin: 0;
          justify-content: center;
        }
        .barcode-label {
          width: 48mm;
          height: 20mm;
          padding: 1mm;
          box-sizing: border-box;
          text-align: center;
          page-break-inside: avoid;
          background: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }
        .barcode-label svg {
          max-width: 46mm;
          height: auto;
        }
        .product-info {
          font-size: 12px;
          font-weight: 500;
          margin-top: 1px;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 46mm;
          color: #333;
        }
        @media print {
          @page { 
            size: 100mm 20mm;
            margin: 0 !important;
          }
          html, body { 
            width: 100mm;
            margin: 0 !important; 
          }
          .barcode-label { 
            border: none;
            width: 48mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        ${labelsWithCompactText.map(label => `
          <div class="barcode-label">
            <svg id="barcode-${label.sku.replace(/[^a-zA-Z0-9]/g, '')}-${label.unitIndex}"></svg>
            <div class="product-info">${label.compactText}</div>
          </div>
        `).join('')}
      </div>
      <script>
        ${labelsWithCompactText.map(label => `
          JsBarcode("#barcode-${label.sku.replace(/[^a-zA-Z0-9]/g, '')}-${label.unitIndex}", "${label.sku}", {
            format: "CODE128",
            width: 2.5,
            height: 70,
            fontSize: 16,
            margin: 0,
            displayValue: true,
            textMargin: 2
          });
        `).join('')}
        setTimeout(() => { window.print(); window.close(); }, 500);
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
```

---

### Cambio 2: Nuevo componente DeliveryManualBarcodeModal.tsx

**Propósito:** Modal que permite seleccionar manualmente qué productos de la entrega imprimir y en qué cantidad.

**Características:**
- Lista todos los artículos de la entrega que tienen `quantity_approved > 0`
- Permite modificar la cantidad de etiquetas a imprimir para cada uno
- Input numérico para cada variante
- Botón "Imprimir Selección" que genera las etiquetas

**Estructura del componente:**
```typescript
interface DeliveryManualBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryItems: any[];
  trackingNumber: string;
}

const DeliveryManualBarcodeModal = ({ isOpen, onClose, deliveryItems, trackingNumber }) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Inicializar cantidades con quantity_approved
  useEffect(() => {
    const initial: Record<string, number> = {};
    deliveryItems.forEach(item => {
      if (item.quantity_approved > 0) {
        initial[item.id] = item.quantity_approved;
      }
    });
    setQuantities(initial);
  }, [deliveryItems, isOpen]);

  // Solo mostrar items con aprobados
  const approvedItems = deliveryItems.filter(item => item.quantity_approved > 0);

  const handleQuantityChange = (itemId: string, value: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  const handlePrint = () => {
    const labels = [];
    approvedItems.forEach(item => {
      const qty = quantities[item.id] || 0;
      if (qty > 0) {
        const variant = item.order_items?.product_variants;
        const productName = variant?.products?.name || 'Producto';
        const variantText = [variant?.size, variant?.color].filter(Boolean).join(' - ');
        const sku = variant?.sku_variant || '';
        
        for (let i = 0; i < qty; i++) {
          labels.push({ sku, productName, variant: variantText, unitIndex: i + 1 });
        }
      }
    });
    // Usar la función de impresión
    printLabels(labels);
  };

  // ... render con tabla de items y inputs de cantidad
};
```

---

### Cambio 3: Modificar DeliveryReviewSummary.tsx

**Ubicación:** Líneas 125-147 (botón de códigos de barras)

**Antes:**
- Botón que abre `DeliveryBarcodeModal` (imprime automáticamente todos los aprobados)

**Después:**
- Botón que abre `DeliveryManualBarcodeModal` (permite seleccionar qué y cuántos imprimir)
- Cambiar el texto del botón a "Imprimir Códigos de Barras (Manual)"
- El modal ahora permite editar cantidades antes de imprimir

---

### Resumen del flujo de usuario

```text
┌─────────────────────────────────────────────────────────────┐
│  FLUJO 1: Impresión rápida por artículo                     │
├─────────────────────────────────────────────────────────────┤
│  1. Usuario revisa calidad y pone Aprobadas: 5              │
│  2. Usuario hace clic en "Guardar"                          │
│  3. Aparece botón [🖨️ Imprimir (5)] al lado del artículo    │
│  4. Clic → Imprime 5 etiquetas directamente                 │
│     (Sin esperar sincronización)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FLUJO 2: Impresión manual (botón superior)                 │
├─────────────────────────────────────────────────────────────┤
│  1. Usuario hace clic en "Imprimir Códigos de Barras"       │
│  2. Se abre modal con lista de todos los artículos aprobados│
│  3. Usuario puede modificar cantidad para cada uno:         │
│     - Ruana Mapache 2 (3-12m): [5] ← editable               │
│     - Ruana Mapache 4 (1-2a):  [3] ← editable               │
│  4. Clic en "Imprimir Selección"                            │
│  5. Imprime 8 etiquetas (5+3) según selección               │
└─────────────────────────────────────────────────────────────┘
```

---

### Sección técnica

**Imports necesarios en DeliveryDetails.tsx:**
```typescript
import { Printer } from 'lucide-react';
```

**Estado nuevo para modal manual:**
```typescript
const [showManualBarcodeModal, setShowManualBarcodeModal] = useState(false);
```

**Ubicación del botón por artículo:**
- Dentro del bloque de acciones (líneas ~1339-1385)
- Agregar después del bloque de "Guardar" y antes de "Sincronizar"
- Solo visible si `item.quantity_approved > 0` (ya guardado)

**Condición de visibilidad:**
```typescript
// Visible inmediatamente después de guardar (quantity_approved > 0)
// NO depende de synced_to_shopify
item.quantity_approved > 0
```

---

### Resultado esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Artículo guardado (no sincronizado) | Sin botón de imprimir | ✅ Botón "Imprimir (N)" visible |
| Artículo sincronizado | Sin botón de imprimir | ✅ Botón "Imprimir (N)" visible |
| Botón superior | Imprime todos automáticamente | Abre modal para seleccionar producto y cantidad |
| Impresión individual | No existía | ✅ Clic directo imprime esa variante |
