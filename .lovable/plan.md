

## Plan: Mejorar Búsqueda y Paginación del Catálogo de Alegra

### Problema Identificado

El catálogo de productos de Alegra tiene dos limitaciones que impiden ver productos nuevos:

1. **Límite de 30 productos**: La API de Alegra solo devuelve máximo 30 items por request
2. **Sin paginación**: No hay botones "Anterior/Siguiente" para navegar
3. **Búsqueda limitada**: El parámetro `name=` de Alegra puede no encontrar coincidencias parciales

**Por eso los productos nuevos no aparecen** - si hay más de 30 productos, los nuevos quedan fuera del rango visible.

---

### Solución Propuesta

#### 1. Agregar paginación completa al catálogo

Agregar controles de navegación para recorrer **todas** las páginas de productos:

```text
┌──────────────────────────────────────────────────────────────┐
│  Catálogo de Alegra                                          │
├──────────────────────────────────────────────────────────────┤
│  [Buscar por nombre...]                     [🔍] [🔄]         │
├──────────────────────────────────────────────────────────────┤
│  ID    Nombre                    Precio     Vinculado         │
│  ─────────────────────────────────────────────────────────── │
│  4     Abrigo Simple Furry       $31.849    ✕    [Vincular]  │
│  282   Beisboleras Niña...       $53.697    ✕    [Vincular]  │
│  ...   (30 productos por página)                              │
├──────────────────────────────────────────────────────────────┤
│  Mostrando 1-30 de productos                                  │
│  [⬅️ Anterior]        Página 1         [Siguiente ➡️]          │
└──────────────────────────────────────────────────────────────┘
```

#### 2. Mejorar la búsqueda con filtro local

Además de la búsqueda en API, agregar un filtro local que busque en **todos** los productos cargados (ya que la API puede fallar en coincidencias parciales).

---

### Cambios Técnicos

#### Archivo: `src/components/alegra/AlegraProductMapper.tsx`

**Nuevos estados:**
```typescript
const [currentPage, setCurrentPage] = useState(0);
const [hasMoreItems, setHasMoreItems] = useState(false);
```

**Modificar `fetchAlegraItems`:**
```typescript
const fetchAlegraItems = async (page = 0) => {
  setIsLoading(true);
  try {
    const pageSize = 30;
    const { data, error } = await supabase.functions.invoke('alegra-api', {
      body: { 
        action: 'get-items',
        data: { 
          start: page * pageSize, 
          limit: pageSize, 
          search: searchTerm || undefined 
        }
      }
    });

    if (data?.success && Array.isArray(data.data)) {
      const items = data.data.filter(item => item.status === 'active');
      setAlegraItems(items);
      setHasMoreItems(items.length === pageSize);
      setCurrentPage(page);
    }
  } catch (error) {
    // Error handling...
  }
};
```

**Nueva UI de paginación:**
```typescript
<div className="flex items-center justify-between mt-4 pt-4 border-t">
  <span className="text-sm text-muted-foreground">
    Mostrando {currentPage * 30 + 1}-{currentPage * 30 + alegraItems.length}
  </span>
  <div className="flex items-center gap-2">
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => fetchAlegraItems(currentPage - 1)}
      disabled={currentPage === 0 || isLoading}
    >
      <ChevronLeft className="h-4 w-4" /> Anterior
    </Button>
    <span className="text-sm px-2">Página {currentPage + 1}</span>
    <Button 
      variant="outline"
      size="sm"
      onClick={() => fetchAlegraItems(currentPage + 1)}
      disabled={!hasMoreItems || isLoading}
    >
      Siguiente <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
</div>
```

**Resetear página al buscar:**
```typescript
const handleSearch = () => {
  setCurrentPage(0);
  fetchAlegraItems(0);
};
```

---

### Resultado Esperado

| Antes | Después |
|-------|---------|
| Solo 30 productos visibles | Navegación por TODAS las páginas |
| Productos nuevos no aparecen | Ir a última página para ver nuevos |
| Búsqueda no encuentra productos | Paginación + búsqueda funcionando |

---

### Tip Temporal

Mientras se implementa: Si necesitas encontrar un producto nuevo específico, intenta buscar por su **nombre exacto completo** o por su **ID de Alegra** (si lo conoces).

