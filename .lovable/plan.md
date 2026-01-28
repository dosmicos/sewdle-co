
# Plan: Corregir Descarga y Visualización de Imágenes de Clientes en WhatsApp

## Problema Identificado

La Edge Function `meta-webhook-openai` procesa los mensajes entrantes de WhatsApp pero **NO descarga ni almacena las imágenes** enviadas por los clientes. Cuando llega una imagen:

1. Solo guarda `[Imagen recibida]` como contenido de texto
2. No extrae el `media_id` del mensaje de imagen de Meta
3. No descarga la imagen desde la API de WhatsApp
4. No la sube al bucket de Supabase Storage
5. No guarda la URL en el campo `media_url` de la base de datos

Por eso todas las imágenes inbound tienen `media_url: NULL` y aparecen como "[Imagen]" en la interfaz en lugar de mostrar la imagen real.

## Solución Propuesta

Implementar la lógica de descarga y almacenamiento de media en `meta-webhook-openai`, similar a la que existe en `meta-webhook`:

### Cambios en `supabase/functions/meta-webhook-openai/index.ts`

1. **Agregar función `fetchMediaUrl`** que:
   - Obtiene la URL temporal del media de WhatsApp usando el `media_id`
   - Descarga el contenido binario de la imagen
   - Sube la imagen al bucket `messaging-media` de Supabase Storage
   - Retorna la URL pública permanente

2. **Modificar el manejo de mensajes de imagen** (líneas 689-705):
   - Extraer el `media_id` del mensaje de imagen
   - Llamar a `fetchMediaUrl` para descargar y almacenar la imagen
   - Guardar la URL resultante

3. **Actualizar el INSERT del mensaje** (líneas 800-814):
   - Incluir el campo `media_url` con la URL de la imagen guardada
   - Incluir el campo `media_mime_type` con el tipo MIME

### Detalle Técnico

| Paso | Descripción |
|------|-------------|
| 1 | Detectar que `message.type === 'image'` |
| 2 | Extraer `message.image.id` (el media_id de Meta) |
| 3 | Llamar a Meta Graph API: `GET /v21.0/{media_id}` para obtener URL temporal |
| 4 | Descargar imagen con Authorization header |
| 5 | Subir a Supabase Storage `messaging-media/whatsapp-media/{timestamp}_{mediaId}.{ext}` |
| 6 | Obtener URL pública del bucket |
| 7 | Guardar mensaje con `media_url` poblada |

### Función a Agregar

```typescript
async function fetchMediaUrl(mediaId: string, supabase: any): Promise<{url: string | null, mimeType: string | null}> {
  const accessToken = Deno.env.get('META_WHATSAPP_TOKEN');
  if (!accessToken || !mediaId) return { url: null, mimeType: null };

  try {
    // 1. Get media info from Meta
    const infoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!infoResponse.ok) return { url: null, mimeType: null };
    
    const mediaInfo = await infoResponse.json();
    if (!mediaInfo.url) return { url: null, mimeType: null };

    // 2. Download the media
    const mediaResponse = await fetch(mediaInfo.url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!mediaResponse.ok) return { url: null, mimeType: null };

    // 3. Upload to Supabase Storage
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const mimeType = mediaInfo.mime_type || 'image/jpeg';
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
    const fileName = `whatsapp-media/${Date.now()}_${mediaId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('messaging-media')
      .upload(fileName, new Uint8Array(arrayBuffer), {
        contentType: mimeType,
        cacheControl: '31536000',
      });

    if (uploadError) return { url: null, mimeType: null };

    // 4. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(fileName);

    return { url: publicUrlData.publicUrl, mimeType };
  } catch (error) {
    console.error('Error fetching media:', error);
    return { url: null, mimeType: null };
  }
}
```

### Modificación del Flujo de Procesamiento

```typescript
// Línea ~689 - Extraer media_id y procesar
let mediaUrl: string | null = null;
let mediaMimeType: string | null = null;

if (message.type === 'image') {
  const mediaId = message.image?.id;
  if (mediaId) {
    const mediaResult = await fetchMediaUrl(mediaId, supabase);
    mediaUrl = mediaResult.url;
    mediaMimeType = mediaResult.mimeType;
  }
  content = message.image?.caption || '';
  messageType = 'image';
}

// Línea ~800 - Incluir media_url en el INSERT
await supabase.from('messaging_messages').insert({
  // ... otros campos
  media_url: mediaUrl,
  media_mime_type: mediaMimeType,
});
```

## Archivos a Modificar

| Archivo | Acción |
|---------|--------|
| `supabase/functions/meta-webhook-openai/index.ts` | Modificar |

## Resultado Esperado

Después de implementar estos cambios:
1. Las imágenes enviadas por clientes se descargarán automáticamente
2. Se almacenarán en el bucket `messaging-media` de Supabase
3. La URL pública se guardará en `messaging_messages.media_url`
4. La interfaz mostrará las imágenes correctamente en lugar de "[Imagen]"
5. Las imágenes no expirarán (problema actual con URLs temporales de WhatsApp)
