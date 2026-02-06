
# Fix: Mensajes de respuesta (reply) no se guardan en el chat

## Problema identificado

El mensaje "Si" de Vivi Jaramillo no se guarda en la base de datos porque es una **respuesta a un mensaje anterior** (reply/quote en WhatsApp). Cuando alguien responde citando un mensaje, WhatsApp envia un `context.id` con el identificador externo del mensaje (WAMID). El codigo actual inserta ese WAMID directamente en la columna `reply_to_message_id`, que es de tipo UUID con una restriccion de clave foranea (FK). Esto causa un error silencioso y el mensaje se pierde.

El fix anterior se aplico al archivo equivocado (`meta-webhook/index.ts`). La funcion que realmente procesa los webhooks de WhatsApp es `whatsapp-webhook/index.ts` (confirmado por los logs y analytics del servidor).

## Solucion

Aplicar la misma correccion de resolucion de WAMID a UUID en las **dos funciones restantes** que manejan mensajes de WhatsApp:

### 1. Corregir `supabase/functions/whatsapp-webhook/index.ts` (funcion activa)

En la seccion de insercion de mensajes (linea ~670-684), agregar logica para:
- Tomar el WAMID de `message.context.id`
- Buscar en la tabla `messaging_messages` el registro con ese `external_message_id`
- Si lo encuentra, usar el `id` interno (UUID) como `reply_to_message_id`
- Si no lo encuentra, insertar `null` en vez de fallar

### 2. Agregar soporte de reply en `supabase/functions/meta-webhook-openai/index.ts` (funcion de respaldo)

Actualmente esta funcion no maneja `reply_to_message_id` en absoluto. Se agregara la misma logica de extraccion de `context.id` y resolucion a UUID para mantener consistencia.

### 3. Redesplegar ambas funciones

Redesplegar `whatsapp-webhook` y `meta-webhook-openai` para que los cambios tomen efecto inmediato.

## Nota sobre el mensaje perdido

El mensaje "Si" de Vivi Jaramillo que se perdio **no se puede recuperar automaticamente** ya que nunca fue almacenado. La preview de la conversacion se actualizo (muestra "Si") pero la fila del mensaje no se creo. Sin embargo, una vez aplicado el fix, todos los mensajes futuros con respuestas/citas se guardaran correctamente.

---

## Detalles tecnicos

**Archivo principal a corregir**: `supabase/functions/whatsapp-webhook/index.ts`

Cambio en lineas ~670-684:

```text
// ANTES (linea 684):
reply_to_message_id: replyToMessageId,

// DESPUES: Agregar resolucion antes del insert
let resolvedReplyToId = null;
if (replyToMessageId) {
  const { data: replyMsg } = await supabase
    .from('messaging_messages')
    .select('id')
    .eq('external_message_id', replyToMessageId)
    .limit(1)
    .single();
  
  if (replyMsg) {
    resolvedReplyToId = replyMsg.id;
  }
}

// En el insert:
reply_to_message_id: resolvedReplyToId,
```

**Archivo secundario**: `supabase/functions/meta-webhook-openai/index.ts`

Agregar extraccion de `message.context?.id` y la misma resolucion de WAMID a UUID antes del insert en lineas ~1128-1148.

**Funciones a redesplegar**: `whatsapp-webhook`, `meta-webhook-openai`
