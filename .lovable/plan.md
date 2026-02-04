
# Plan: Corregir Verificación de WhatsApp y Agregar APIs de IA

## Problema Identificado

### 1. WhatsApp muestra "Sin conexión" incorrectamente
La función actual verifica que `webhook_verified = true`, pero este campo está en `false` en la base de datos aunque el webhook funciona correctamente. 

**Solución**: Cambiar la lógica de verificación para hacer una llamada real a la API de Meta Graph para validar que el token es válido, en lugar de depender del campo `webhook_verified`.

### 2. Faltan las APIs de Inteligencia Artificial
El sistema usa:
- **OpenAI (GPT-4o-mini)** - Para respuestas automáticas en Mensajería IA

---

## Cambios a Realizar

### 1. Mejorar la Verificación de WhatsApp

Cambiar la función `checkWhatsAppAPI` para verificar:
1. Que exista el canal en la base de datos con `is_active = true`
2. Hacer una llamada real al endpoint de Meta Graph API para validar las credenciales

```typescript
// Nueva lógica
const checkWhatsAppAPI = useCallback(async (): Promise<APIStatus> => {
  // 1. Verificar que existe canal activo en DB
  const { data: channel } = await supabase
    .from('messaging_channels')
    .select('id, is_active, meta_phone_number_id')
    .eq('organization_id', currentOrganization.id)
    .eq('channel_type', 'whatsapp')
    .eq('is_active', true)
    .maybeSingle();

  if (!channel) {
    return { status: 'error', error: 'Canal no configurado' };
  }

  // 2. Probar conexión real enviando un test message (sin destinatario)
  // O verificar a través de una edge function que valide el token
  const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
    body: { action: 'test-connection', organizationId: currentOrganization.id }
  });

  // Evaluar resultado...
});
```

### 2. Agregar API de OpenAI

Nueva tarjeta para verificar que OpenAI está configurado y funcionando:

| Propiedad | Valor |
|-----------|-------|
| ID | `openai` |
| Nombre | OpenAI (ChatGPT) |
| Descripción | Inteligencia artificial para respuestas automáticas |
| Icono | `Brain` (de lucide-react) |
| Verificación | Llamar a `messaging-ai-openai` con un mensaje simple de prueba |

```typescript
const checkOpenAIAPI = useCallback(async (): Promise<APIStatus> => {
  const startTime = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke('messaging-ai-openai', {
      body: { 
        action: 'test-connection',
        organizationId: currentOrganization.id 
      }
    });

    const responseTime = Math.round(performance.now() - startTime);

    if (error?.message?.includes('OPENAI_API_KEY')) {
      return { status: 'error', responseTime, error: 'API Key no configurada' };
    }

    if (error) {
      return { status: 'error', responseTime, error: error.message };
    }

    return { status: 'connected', responseTime };
  } catch (err: any) {
    // Manejar error
  }
});
```

---

## Estructura Final de APIs

El panel mostrará **6 APIs** organizadas en dos categorías:

### Integraciones Externas
| API | Descripción | Verificación |
|-----|-------------|--------------|
| Supabase | Base de datos | Query simple |
| Shopify | E-commerce | `test-shopify-connection` |
| Envia.com | Envíos | `envia-quote` (test quote) |
| Alegra | Facturación | `alegra-api` (test-connection) |
| WhatsApp/Meta | Mensajería | Verificar canal activo + credenciales |

### Inteligencia Artificial
| API | Descripción | Verificación |
|-----|-------------|--------------|
| OpenAI | ChatGPT para IA | `messaging-ai-openai` (test-connection) |

---

## Archivos a Modificar

1. **`src/pages/ApisStatusPage.tsx`**
   - Corregir lógica de `checkWhatsAppAPI`
   - Agregar función `checkOpenAIAPI`
   - Agregar nueva tarjeta de OpenAI al array `apiConfigs`
   - Importar icono `Brain` de lucide-react

2. **`supabase/functions/messaging-ai-openai/index.ts`** (opcional)
   - Agregar manejo de `action: 'test-connection'` que solo valide que el API key existe sin gastar tokens

---

## Opción Alternativa para WhatsApp

Si prefieres no modificar la edge function, podemos:
1. Considerar "conectado" si `is_active = true` (ignorar `webhook_verified`)
2. Mostrar el estado del webhook como información adicional, no como error

---

## Vista Final

```
┌─────────────────────────────────────────────────────────────┐
│  Estado de APIs                          [Verificar Todas]  │
├─────────────────────────────────────────────────────────────┤
│  Total: 6  │  Conectadas: 6  │  Con errores: 0             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 🗄️ Supabase         │  │ 🛒 Shopify          │          │
│  │ ✅ Conectado  254ms │  │ ✅ Conectado 1156ms │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 🚚 Envia.com        │  │ 🧾 Alegra           │          │
│  │ ✅ Conectado 4365ms │  │ ✅ Conectado  639ms │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 💬 WhatsApp / Meta  │  │ 🧠 OpenAI (ChatGPT) │          │
│  │ ✅ Conectado  237ms │  │ ✅ Conectado  892ms │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
