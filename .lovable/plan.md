
# Plan: Implementar Actualización en Tiempo Real para la Lista de Conversaciones

## Problema Detectado

Cuando llegan nuevos mensajes a WhatsApp, la lista de conversaciones en la página de Mensajería IA no se actualiza automáticamente. El usuario tiene que refrescar manualmente para ver los nuevos mensajes.

## Análisis Técnico

La suscripción realtime en `useMessagingConversations.ts` tiene varios problemas:

1. **Canal único y estático**: Usa siempre el mismo nombre de canal (`messaging-conversations-changes`) sin importar el filtro activo, causando conflictos cuando el filtro cambia

2. **Cache desincronizado**: Cuando el `channelFilter` cambia, el `queryKey` incluye el nuevo filtro pero el canal realtime sigue enviando a la suscripción anterior

3. **Datos incompletos**: Las conversaciones nuevas recibidas por realtime no incluyen las relaciones (`channel` y `tags`) porque vienen directamente de la tabla base

4. **Sin refetch de relaciones**: A diferencia de `useMessagingMessages` que maneja mensajes simples, las conversaciones requieren datos de tablas relacionadas

## Solución Propuesta

### Cambio 1: Suscripción Realtime Única y Estable

En lugar de intentar hacer updates optimistas complejos, usar una estrategia de invalidación inteligente:

```typescript
// src/hooks/useMessagingConversations.ts

useEffect(() => {
  // Canal único que no depende del filtro
  const channel = supabase
    .channel('messaging-conversations-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messaging_conversations'
      },
      (payload) => {
        console.log('Realtime event received:', payload.eventType);
        
        // Invalidar todas las queries de conversaciones para refetch completo
        // Esto asegura que las relaciones (tags, channel) se carguen correctamente
        queryClient.invalidateQueries({ 
          queryKey: ['messaging-conversations'],
          refetchType: 'active'  // Solo refetch si la query está activa
        });
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [queryClient]);  // Sin dependencia de channelFilter
```

### Cambio 2: Agregar Suscripción a `messaging_messages` para Detectar Nuevos Mensajes

Cuando llega un mensaje nuevo, también debemos refrescar la lista de conversaciones porque `last_message_preview` y `unread_count` cambian:

```typescript
// Agregar segunda suscripción para mensajes entrantes
useEffect(() => {
  const messagesChannel = supabase
    .channel('messaging-messages-for-conversations')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messaging_messages'
      },
      () => {
        // Refrescar lista de conversaciones cuando llega un mensaje nuevo
        queryClient.invalidateQueries({ 
          queryKey: ['messaging-conversations'],
          refetchType: 'active'
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(messagesChannel);
  };
}, [queryClient]);
```

### Cambio 3: Optimización para Evitar Parpadeo

Para evitar que la UI parpadee durante los refetches, configurar la query con `staleTime` y usar `placeholderData`:

```typescript
const { data: conversations, isLoading, error } = useQuery({
  queryKey: ['messaging-conversations', channelFilter],
  queryFn: async () => {
    // ... fetch logic existente
  },
  staleTime: 1000 * 30,  // 30 segundos - evita refetches inmediatos
  refetchOnWindowFocus: false,  // No refrescar al cambiar de pestaña
  placeholderData: (previousData) => previousData,  // Mantener datos anteriores mientras carga
});
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useMessagingConversations.ts` | Reescribir suscripciones realtime + agregar opciones de query |

## Flujo de Datos Resultante

```text
+------------------+     +-------------------+     +----------------------+
| WhatsApp Message | --> | meta-webhook-     | --> | messaging_messages   |
|    (Inbound)     |     | openai            |     | (INSERT)             |
+------------------+     +-------------------+     +----------------------+
                                  |                          |
                                  v                          |
                         +-------------------+               |
                         | messaging_        |               |
                         | conversations     |               |
                         | (UPDATE)          |               |
                         +-------------------+               |
                                  |                          |
                                  v                          v
                         +------------------------------------------+
                         |        Supabase Realtime                 |
                         | (postgres_changes broadcast)             |
                         +------------------------------------------+
                                           |
                                           v
                         +------------------------------------------+
                         |   useMessagingConversations              |
                         |   - Recibe evento                        |
                         |   - Invalida query                       |
                         |   - Refetch automático con relaciones    |
                         +------------------------------------------+
                                           |
                                           v
                         +------------------------------------------+
                         |   ConversationsList                      |
                         |   - UI actualizada con nuevos datos      |
                         +------------------------------------------+
```

## Consideraciones Técnicas

- **Rendimiento**: El uso de `invalidateQueries` con `refetchType: 'active'` asegura que solo se refresquen queries actualmente visibles
- **Consistencia**: Usar refetch en lugar de actualizaciones optimistas garantiza que siempre tengamos las relaciones completas (tags, channel info)
- **Debounce implícito**: React Query agrupa invalidaciones rápidas automáticamente
- **Sin parpadeo**: `placeholderData: previousData` mantiene la UI estable durante la carga

## Resultado Esperado

Una vez implementado, cuando llegue un nuevo mensaje de WhatsApp:
1. El webhook guardará el mensaje y actualizará la conversación
2. Supabase Realtime notificará a la suscripción
3. La query se invalidará y refrescará automáticamente
4. La lista mostrará la conversación actualizada sin necesidad de refrescar manualmente
