

# Plan: Integrar tu `whatsapp-webhook` con Persistencia de Imágenes y Panel de Indexación

## Resumen del Problema

Tu función `whatsapp-webhook` procesa imágenes correctamente para búsqueda por embeddings (GPT-4o describe → embedding → match), pero **no persiste las imágenes** en Supabase Storage. El resultado:

| Lo que hace hoy | Lo que falta |
|-----------------|--------------|
| ✅ Descarga imagen de WhatsApp (línea 388) | ❌ No la sube a Storage |
| ✅ GPT-4o describe la imagen (línea 473) | ❌ No guarda `media_url` en BD |
| ✅ Busca productos similares por embedding | ❌ Frontend muestra "Imagen no disponible" |

## Solución: 2 Cambios

### 1. Modificar `whatsapp-webhook` para persistir imágenes

Agregar función para subir la imagen a Supabase Storage y guardar la URL:

```text
┌─────────────────────────────────────────────────────────────────┐
│  FLUJO ACTUAL (líneas 383-389)                                  │
├─────────────────────────────────────────────────────────────────┤
│  message.image.id → downloadWhatsAppMedia() → base64            │
│                                    ↓                            │
│                              GPT-4o describe                    │
│                                    ↓                            │
│                              embedding → match                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLUJO NUEVO (agregando persistencia)                           │
├─────────────────────────────────────────────────────────────────┤
│  message.image.id → downloadWhatsAppMedia() → base64            │
│                      ↓                   ↓                      │
│              uploadToStorage()     GPT-4o describe              │
│                      ↓                   ↓                      │
│              media_url            embedding → match             │
│                      ↓                                          │
│              INSERT con media_url poblada                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Mejorar UI para mostrar estado de imágenes analizadas

Cuando una imagen fue procesada por IA pero no tiene URL persistida:

| Antes | Después |
|-------|---------|
| "Imagen no disponible" (gris) | "🔍 Imagen analizada para búsqueda de productos" (badge verde) |

### 3. Agregar panel de estado de indexación en ProductCatalogConnection

Mostrar estadísticas de `product_embeddings` y `product_indexing_queue`:
- Total de productos indexados
- Productos pendientes en cola
- Productos fallidos con opción de reintentar

---

## Cambios Técnicos Detallados

### Archivo 1: `supabase/functions/whatsapp-webhook/index.ts`

Crear el archivo en el repositorio con tu código + las siguientes adiciones:

**A. Nueva función `uploadMediaToStorage`** (después de línea 96):

```typescript
async function uploadMediaToStorage(
  base64Data: string, 
  mediaId: string, 
  supabase: any,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
    const fileName = `whatsapp-media/${Date.now()}_${mediaId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(fileName, binaryData, {
        contentType: mimeType,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(fileName);

    console.log('✅ Image uploaded to storage:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('❌ Upload error:', error);
    return null;
  }
}
```

**B. Modificar `processMessage`** para usar la nueva función:

En línea ~379, agregar variable para media_url:
```typescript
let mediaUrl: string | null = null;
```

En línea ~388, después de descargar la imagen:
```typescript
if (message.image?.id) {
  console.log('🖼️ Downloading image...');
  imageBase64 = await downloadWhatsAppMedia(message.image.id);
  
  // NUEVO: Subir a Storage para persistencia
  if (imageBase64) {
    mediaUrl = await uploadMediaToStorage(
      imageBase64, 
      message.image.id, 
      supabase,
      'image/jpeg'
    );
  }
}
```

En línea ~451, modificar el INSERT para incluir media_url:
```typescript
await supabase.from('messaging_messages').insert({
  conversation_id: conversation.id,
  channel_type: 'whatsapp',
  direction: 'inbound',
  sender_type: 'user',
  content: content || '[Imagen]',
  message_type: messageType,
  external_message_id: messageId,
  sent_at: timestamp.toISOString(),
  media_url: mediaUrl,           // NUEVO
  media_mime_type: 'image/jpeg', // NUEVO (cuando hay imagen)
});
```

---

### Archivo 2: `src/components/messaging-ai/ConversationThread.tsx`

Modificar el fallback de imágenes (líneas 569-577) para mostrar que fue analizada:

```typescript
{/* Fallback for image messages without URL - show AI analysis badge */}
{!message.mediaUrl && message.mediaType === 'image' && (
  <div className="max-w-[200px] rounded-lg mb-2 p-3 bg-emerald-50 border border-emerald-200">
    <div className="flex items-center gap-2 text-emerald-700">
      <Search className="h-5 w-5" />
      <div>
        <p className="text-sm font-medium">Imagen analizada</p>
        <p className="text-xs opacity-70">Búsqueda por IA</p>
      </div>
    </div>
  </div>
)}
```

---

### Archivo 3: `src/hooks/useProductIndexing.ts` (nuevo)

Hook para consultar estadísticas de indexación:

```typescript
export const useProductIndexing = (organizationId?: string) => {
  // Query product_embeddings count
  // Query product_indexing_queue by status
  // Return stats: { indexed, pending, processing, failed }
  // Mutation to reindex a product
}
```

---

### Archivo 4: `src/components/whatsapp-ai/ProductCatalogConnection.tsx`

Agregar sección de estado de indexación después del panel de sincronización:

```typescript
// Nueva sección: Panel de Indexación Visual
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Sparkles className="h-5 w-5 text-purple-500" />
      Indexación Visual IA
    </CardTitle>
    <CardDescription>
      Productos indexados para búsqueda por imagen
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-lg bg-purple-50 text-center">
        <p className="text-xl font-bold text-purple-600">{stats.indexed}</p>
        <p className="text-xs text-purple-600">Indexados</p>
      </div>
      <div className="p-3 rounded-lg bg-amber-50 text-center">
        <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
        <p className="text-xs text-amber-600">Pendientes</p>
      </div>
    </div>
    {stats.failed > 0 && (
      <div className="mt-3 p-2 rounded bg-red-50 text-red-700 text-sm">
        {stats.failed} productos fallidos - revisar cola
      </div>
    )}
  </CardContent>
</Card>
```

---

## Archivos a Crear/Modificar

| Archivo | Acción | Propósito |
|---------|--------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Crear | Tu código + persistencia de imágenes |
| `src/components/messaging-ai/ConversationThread.tsx` | Modificar | Mejor fallback para imágenes analizadas |
| `src/hooks/useProductIndexing.ts` | Crear | Hook para estadísticas de indexación |
| `src/components/whatsapp-ai/ProductCatalogConnection.tsx` | Modificar | Agregar panel de indexación visual |

---

## Resultado Esperado

1. **Imágenes nuevas**: Se guardarán en Storage y se mostrarán en el chat
2. **Imágenes antiguas (sin URL)**: Mostrarán badge "Imagen analizada para búsqueda"
3. **Panel de catálogo**: Mostrará estadísticas de productos indexados para búsqueda visual
4. **Tu función `index-products`**: Seguirá funcionando igual (no la tocamos)

---

## Nota Importante

Al crear `supabase/functions/whatsapp-webhook/index.ts` en Lovable, se desplegará automáticamente y podrás actualizar el webhook en Meta para apuntar a esta versión con persistencia de imágenes.

