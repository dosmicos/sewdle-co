# Automatización Sewdle - Quick Start (5 Pasos)

Guía paso-a-paso para implementar las 3 automatizaciones más impactantes en 1 semana.

---

## 🎯 Objetivo
Implementar 3 automatizaciones que resuelven los pain points más comunes:
1. **Pre-commit Checks** → Evitar errores TS/Linting
2. **Sync Shopify Diario** → Datos frescos automáticamente
3. **Monitoreo de Logs** → Alertas tempranas de fallos

**Tiempo total**: ~5 horas distribuidas en la semana

---

## ✅ Automatización #1: Pre-commit Checks (Fácil - 1 hora)

### Por qué
Evita que commits con errores de TypeScript lleguen a main.

### Paso 1: Editar settings.json
```bash
# Abre o crea .claude/settings.json
cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "pre-commit": "npx tsc --noEmit && npx eslint ."
  }
}
EOF
```

### Paso 2: Test el hook
```bash
# Intenta hacer un pequeño cambio y commit
echo "// test" >> src/index.tsx
git add src/index.tsx
git commit -m "test: hook verification"
# Debería fallar si hay errores TS
```

### Paso 3: Revert test
```bash
git reset HEAD~1
git checkout src/index.tsx
```

**✅ Resultado**: Ahora todos los commits son validados automáticamente.

---

## ✅ Automatización #2: Sync Shopify Diario (Medio - 2 horas)

### Por qué
Datos frescos de Shopify sin ejecutar manualmente `sync-shopify-sales`.

### Paso 1: Crear Edge Function Wrapper
```bash
# Crear nueva función que orqueste múltiples syncs
mkdir -p supabase/functions/sync-shopify-daily
cat > supabase/functions/sync-shopify-daily/index.ts << 'EOF'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('🔄 Starting daily Shopify sync...')

    // Sync 1: Orders and Sales
    console.log('📦 Syncing orders...')
    const ordersResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-shopify-sales`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ scheduled: true })
    })
    const ordersResult = await ordersResponse.json()
    console.log('✅ Orders synced:', ordersResult.message)

    // Sync 2: Inventory
    console.log('📊 Syncing inventory...')
    const inventoryResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-inventory-shopify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ scheduled: true })
    })
    const inventoryResult = await inventoryResponse.json()
    console.log('✅ Inventory synced:', inventoryResult.message)

    // Sync 3: All Products
    console.log('🛍️ Syncing products...')
    const productsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-all-shopify-products`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ scheduled: true })
    })
    const productsResult = await productsResponse.json()
    console.log('✅ Products synced:', productsResult.message)

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily Shopify sync completed',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ Sync failed:', error.message)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
EOF
```

### Paso 2: Configurar en supabase/config.toml
```bash
# Agregar al archivo supabase/config.toml
cat >> supabase/config.toml << 'EOF'

[functions.sync-shopify-daily]
verify_jwt = false
EOF
```

### Paso 3: Desplegar la función
```bash
npx supabase functions deploy sync-shopify-daily
```

### Paso 4: Crear Schedule en Claude
```
/schedule "0 2 * * *" "Ejecutar sync-shopify-daily"
```

Esto ejecutará automáticamente cada día a las 2 AM.

**✅ Resultado**: Shopify se sincroniza automáticamente diariamente sin intervención manual.

---

## ✅ Automatización #3: Monitoreo de Logs (Medio - 2 horas)

### Por qué
Detectar fallos en edge functions antes de que impacten a usuarios.

### Paso 1: Crear Script de Verificación
```bash
# Crear script de monitoreo
cat > scripts/monitor-edge-functions.sh << 'EOF'
#!/bin/bash

# Funciones críticas a monitorear
CRITICAL_FUNCTIONS=(
  "meta-webhook-openai"
  "sync-shopify-sales"
  "whatsapp-webhook"
  "sync-google-ads"
)

echo "🔍 Checking critical edge functions for errors..."

for func in "${CRITICAL_FUNCTIONS[@]}"; do
  echo ""
  echo "📝 Checking $func..."

  # Get last 30 logs
  npx supabase functions logs "$func" --limit 30 | grep -E "error|Error|ERROR|failed|Failed" || echo "✅ No errors found"
done

echo ""
echo "✅ Monitoring complete"
EOF

chmod +x scripts/monitor-edge-functions.sh
```

### Paso 2: Crear Schedule para Verificación
```
/loop 1h "Ejecutar scripts/monitor-edge-functions.sh"
```

Esto ejecutará el monitoreo cada hora mientras Claude está activo.

### Paso 3: (Opcional) Crear Alert en GitHub
```bash
# Si encuentras errores, crear issue automáticamente
cat > scripts/create-alert-if-errors.sh << 'EOF'
#!/bin/bash

# Ejecutar monitoreo
ERRORS=$(npx supabase functions logs meta-webhook-openai --limit 30 | grep -c "error\|Error\|ERROR")

if [ $ERRORS -gt 0 ]; then
  echo "⚠️ Found $ERRORS errors in meta-webhook-openai"

  # Crear issue en GitHub
  gh issue create \
    --title "⚠️ Edge Function Alert: meta-webhook-openai errors" \
    --body "Found $ERRORS errors in the last 30 logs. Check logs for details." \
    --labels "🚨 urgent,bug"
fi
EOF

chmod +x scripts/create-alert-if-errors.sh
```

**✅ Resultado**: Monitoreo automático con alertas tempranas de problemas.

---

## 📋 Checklist de Implementación

### Semana 1
- [ ] Automatización #1 (Pre-commit) completada
- [ ] Automatización #2 (Sync Shopify) desplegada
- [ ] Automatización #3 (Monitoreo) iniciado

### Antes de Producción
- [ ] Testar pre-commit hook con código con errores
- [ ] Testar sync-shopify-daily en staging (24h)
- [ ] Verificar logs de monitoreo funcionan
- [ ] Documentar en equipo cómo reportar problemas

### Post-Implementación
- [ ] Entrenar equipo en nuevas automatizaciones
- [ ] Crear runbook de troubleshooting
- [ ] Revisar logs después de 1 semana
- [ ] Iterar sobre falsos positivos

---

## 🔧 Troubleshooting Rápido

### Hook pre-commit no funciona
```bash
# Verificar sintaxis de JSON
cat .claude/settings.json | python3 -m json.tool

# Verificar permisos
ls -la .claude/settings.json

# Revisar logs de Claude
# En Claude Code: Ver "Logs" tab
```

### Sync Shopify function falla
```bash
# Verificar deployment
npx supabase functions list

# Ver logs
npx supabase functions logs sync-shopify-daily --limit 100

# Test manual
curl -X POST https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-daily \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### Monitoreo no detecta errores
```bash
# Test manual
npx supabase functions logs meta-webhook-openai --limit 50

# Verificar que SERVICE_KEY tiene permisos
supabase projects list
```

---

## 📊 Impacto Esperado

| Automatización | Ahorro Tiempo/Semana | Reducción Errores | Detecta Problemas |
|---|---|---|---|
| Pre-commit Checks | 1h | 80% | Inmediato |
| Sync Shopify | 2h | 100% | ----- |
| Monitoreo Logs | 1h | 60% | <1 hora |
| **TOTAL** | **4 horas** | **~80%** | **Crítico** |

---

## 📚 Documentación Relacionada

- `AUTOMATION_PROPOSALS.md` - 14 propuestas detalladas
- `CLAUDE_AUTOMATION_TOOLKIT.md` - Referencia de herramientas
- `.claude/settings.json` - Configuración local
- `supabase/config.toml` - Configuración de backend

---

## 🚀 Próximos Pasos (Post-Week-1)

Una vez implementadas estas 3 automatizaciones, considerar:
1. **Sync de Ads** (Meta + Google) → Finance Dashboard actualizado
2. **Auto-Tagging de Órdenes Pegadas** → Operaciones más eficientes
3. **Reportes Semanales** → Data-driven decision making

---

**Tiempo total de implementación**: ~5 horas
**ROI**: 4+ horas ahorradas por semana
**Complejidad**: Básica (ideal para comenzar)

**Última actualización**: 2026-03-27
