# Claude Code Hooks - Automatizaciones para Desarrollo Local

Guía para configurar automatizaciones locales en Claude Code que ejecutan acciones automáticamente durante el desarrollo.

---

## Introducción a Hooks

Los hooks en Claude Code (configurados en `settings.json`) permiten ejecutar comandos automáticamente en respuesta a eventos:
- Después de hacer commit
- Antes de deployar
- Cuando se guarda un archivo
- Cuando ocurre un error

**Ubicación de configuración**: `/Users/juliancastro/.claude/projects/-Users-juliancastro-Desktop-sewdle-co/settings.json`

---

## 1. Hook: Validar Tipos después de cada Commit

**Propósito**: Evitar hacer push de código con errores TypeScript.

**Configuración**:
```json
{
  "hooks": {
    "after-commit": {
      "run": "npx tsc --noEmit",
      "halt_on_error": true,
      "message": "Validación TypeScript fallida. Hay errores de tipos."
    }
  }
}
```

**Cómo funciona**:
1. Después de que hagas commit, ejecuta automáticamente `npx tsc --noEmit`
2. Si hay errores TypeScript, detiene todo y te muestra el error
3. Tienes que arreglarlo antes de continuar

**Uso**:
```bash
# En Claude Code
git add src/pages/NewPage.tsx
/commit "feat: add new page"

# Automáticamente:
# 1. Crea el commit
# 2. Ejecuta `npx tsc --noEmit`
# 3. Si hay errores, te los muestra
```

---

## 2. Hook: Lint automático antes de deploy

**Propósito**: Asegurar que el código cumple con estándares antes de deployer a Vercel.

**Configuración**:
```json
{
  "hooks": {
    "before-deploy": {
      "run": "npm run lint",
      "halt_on_error": true,
      "message": "ESLint encontró problemas. Ejecuta: npm run lint -- --fix"
    }
  }
}
```

**Cómo funciona**:
1. Cuando se intenta deployar, primero corre `npm run lint`
2. Si hay problemas, detiene el deploy
3. Necesitas arreglar los warnings/errors antes de continuar

**Uso**:
```bash
# En Claude Code
/deploy

# Automáticamente:
# 1. Ejecuta `npm run lint`
# 2. Si hay errores, muestra mensaje
# 3. No deploya hasta arreglarlo
```

---

## 3. Hook: Sincronizar base de datos después de cambios de schema

**Propósito**: Después de crear una migración, deployarla automáticamente a Supabase local.

**Configuración**:
```json
{
  "hooks": {
    "on-file-save": {
      "pattern": "supabase/migrations/*.sql",
      "run": "npx supabase db push",
      "ignore_errors": false,
      "message": "Migración desplegada a Supabase"
    }
  }
}
```

**Cómo funciona**:
1. Cuando guardes un archivo `.sql` en `supabase/migrations/`
2. Automáticamente ejecuta `npx supabase db push`
3. Tu esquema local se sincroniza inmediatamente

**Uso**:
```bash
# Creas o editas un archivo de migración en VS Code/editor
# Guardas el archivo (Ctrl+S o Cmd+S)
# Automáticamente:
# - Valida la migración
# - Si es válida, la aplica a Supabase local
# - Si falla, te muestra el error
```

---

## 4. Hook: Actualizar tipos después de cambios en Schema

**Propósito**: Generar tipos TypeScript automáticamente cuando el schema de Supabase cambia.

**Configuración**:
```json
{
  "hooks": {
    "on-file-save": {
      "pattern": "supabase/migrations/*.sql",
      "run": "npx supabase gen types typescript --local > src/types/database.ts",
      "ignore_errors": true,
      "message": "Tipos database.ts actualizados"
    }
  }
}
```

**Cómo funciona**:
1. Después de aplicar una migración
2. Automáticamente regenera `src/types/database.ts`
3. Los tipos están siempre sincronizados con el schema

**Uso**:
```bash
# Editas una migración
# Guardas
# Automáticamente:
# - Se aplica la migración
# - Se regeneran los tipos
# - Puedes usarlos en componentes sin que TypeScript reclame
```

---

## 5. Hook: Deployar funciones edge cuando cambian

**Propósito**: Cuando editas una función edge, deployarla automáticamente a Supabase.

**Configuración**:
```json
{
  "hooks": {
    "on-file-save": {
      "pattern": "supabase/functions/*/index.ts",
      "run": "bash -c 'FUNC_NAME=$(basename $(dirname \"$FILE\")); npx supabase functions deploy \"$FUNC_NAME\"'",
      "ignore_errors": true,
      "message": "Función edge desplegada"
    }
  }
}
```

**Cómo funciona**:
1. Editas un archivo en `supabase/functions/nombre-funcion/index.ts`
2. Guardas
3. Automáticamente: se detecta la carpeta de la función
4. La función se deploya a Supabase inmediatamente

**Uso**:
```bash
# Editas supabase/functions/send-hotdays-campaign/index.ts
# Guardas (Cmd+S)
# Automáticamente:
# - Ejecuta: npx supabase functions deploy send-hotdays-campaign
# - La función está lista para usar en segundos
```

---

## 6. Hook: Limpiar archivos temporales antes de commit

**Propósito**: Evitar commitear archivos temporales o archivos de debug.

**Configuración**:
```json
{
  "hooks": {
    "before-commit": {
      "run": "bash -c 'rm -f src/**/*.bak src/**/*.tmp /tmp/*.json 2>/dev/null; true'",
      "ignore_errors": true,
      "message": "Archivos temporales limpiados"
    }
  }
}
```

**Cómo funciona**:
1. Antes de crear un commit, ejecuta limpieza
2. Elimina archivos `.bak`, `.tmp`, y archivos de JSON temporales
3. Asegura que solo código importante se commitea

---

## 7. Hook: Validar que las variables de entorno estén configuradas

**Propósito**: Evitar deployar si falta configurar variables de entorno en Vercel.

**Configuración**:
```json
{
  "hooks": {
    "before-deploy": {
      "run": "bash -c 'if [ ! -f .env ]; then echo \"Error: .env no existe\"; exit 1; fi'",
      "halt_on_error": true,
      "message": "Asegúrate de que .env existe y tiene las variables necesarias"
    }
  }
}
```

---

## 8. Hook: Generar changelog automáticamente

**Propósito**: Actualizar `CHANGELOG.md` automáticamente con cada commit.

**Configuración**:
```json
{
  "hooks": {
    "after-commit": {
      "run": "bash -c 'echo \"- $(git log -1 --pretty=%B)\" >> CHANGELOG.md'",
      "ignore_errors": true,
      "message": "CHANGELOG.md actualizado"
    }
  }
}
```

**Cómo funciona**:
1. Después de cada commit
2. Toma el mensaje del commit
3. Lo agrega al final de `CHANGELOG.md`

---

## 9. Hook: Verificar Shopify API antes de sync

**Propósito**: Probar conectividad a Shopify antes de hacer sync.

**Configuración**:
```json
{
  "hooks": {
    "before-sync": {
      "run": "npx supabase functions invoke sync-shopify-sales --body '{\"test\": true}'",
      "halt_on_error": true,
      "message": "Conectividad Shopify fallida. Verifica credenciales."
    }
  }
}
```

---

## 10. Hook: Alertar si commiteas secrets

**Propósito**: Prevenir que accidentalmente commitees tokens o claves.

**Configuración**:
```json
{
  "hooks": {
    "before-commit": {
      "run": "bash -c 'if git diff --cached | grep -iE \"(password|token|secret|key|api_key|Bearer)\"; then echo \"ALERTA: Detectados posibles secrets\"; exit 1; fi'",
      "halt_on_error": true,
      "message": "Puede haber secrets en el commit. Revisa antes de continuar."
    }
  }
}
```

---

## Cómo Instalar/Actualizar Hooks

### Opción A: Editar settings.json manualmente

```bash
# 1. Abre el archivo
open /Users/juliancastro/.claude/projects/-Users-juliancastro-Desktop-sewdle-co/settings.json

# 2. Agrega la sección "hooks" (ejemplo)
# 3. Guarda
# 4. Los hooks estarán activos inmediatamente
```

### Opción B: Usar skill update-config

```bash
# En Claude Code, ejecuta:
/update-config

# Esto abre un editor para settings.json
# Agrega tus hooks ahí
```

### Opción C: Programáticamente (No recomendado)

```bash
# Si necesitas agregar hooks por terminal
cat >> /Users/juliancastro/.claude/projects/-Users-juliancastro-Desktop-sewdle-co/settings.json << 'EOF'
,
  "hooks": {
    "after-commit": {
      "run": "npx tsc --noEmit",
      "halt_on_error": true
    }
  }
EOF
```

---

## Plantilla de Configuración Recomendada

Aquí está una configuración completa y recomendada para el proyecto Sewdle:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run build:*)",
      "Bash(npm run lint:*)",
      "Bash(npx tsc:*)",
      "Bash(npx supabase:*)",
      "Bash(git:*)"
    ]
  },
  "hooks": {
    "before-commit": {
      "run": "npx tsc --noEmit",
      "halt_on_error": true,
      "message": "⚠️ TypeScript errors found. Fix and try again."
    },
    "before-deploy": {
      "run": "npm run build",
      "halt_on_error": true,
      "message": "Build failed. Check errors above."
    },
    "on-file-save": [
      {
        "pattern": "supabase/migrations/*.sql",
        "run": "npx supabase db push",
        "ignore_errors": true,
        "message": "✅ Migration deployed"
      },
      {
        "pattern": "supabase/functions/*/index.ts",
        "run": "bash -c 'FUNC=$(basename $(dirname \"$FILE\")); npx supabase functions deploy \"$FUNC\"'",
        "ignore_errors": true,
        "message": "✅ Function deployed"
      }
    ]
  }
}
```

---

## Monitoreo de Hooks

### Ver qué hooks se ejecutaron
```bash
# Revisar los logs de Claude Code
# En la interfaz: View → Output → Claude Code

# O desde terminal:
tail -f /tmp/claude-code.log 2>/dev/null || echo "No logs available"
```

### Deshabilitar un hook temporalmente
```json
{
  "hooks": {
    "before-commit": {
      "enabled": false,  // Agrega esto
      "run": "npx tsc --noEmit"
    }
  }
}
```

### Ver qué hooks existen
```bash
# En Claude Code
/update-config

# Se abre settings.json y ves todos los hooks definidos
```

---

## Troubleshooting

### Problema: Hook no se ejecuta
**Solución**:
1. Verifica que el hook está en settings.json
2. Comprueba que el `pattern` (si existe) coincide con el archivo
3. Verifica que el comando es válido (pruébalo manualmente)

### Problema: Hook causa error pero necesitas continuar
**Solución**:
- Cambia `halt_on_error: true` a `halt_on_error: false`
- O usa `ignore_errors: true`

### Problema: Hook ejecuta pero no ves el output
**Solución**:
- Agrega `"message": "Tu mensaje aquí"` para ver feedback
- Usa `npx supabase functions logs` para funciones edge
- Usa `npm run build` para ver output de build

### Problema: Variable $FILE no funciona en hook
**Solución**:
- Usa `bash -c 'comando'` para que shell interprete variables
- Ejemplo: `bash -c 'echo $FILE'`

---

## Casos de Uso Prácticos

### Flujo 1: Desarrollo con Sincronización Auto
```bash
# 1. Editas componente React
# 2. Editas migración SQL
# 3. Guardas el archivo SQL
# → Hook automáticamente aplica migración a DB local
# 4. Editas función edge
# → Hook automáticamente deploya a Supabase
# 5. Guardas componente
# → TypeScript se valida automáticamente
```

### Flujo 2: Pre-deployment Checks
```bash
# 1. Editas código
# 2. Haces commit
# → Hook valida tipos
# 3. Intentas deployar
# → Hook valida lint y build
# → Si todo OK, se deploya a Vercel
```

### Flujo 3: Prevención de Errores
```bash
# 1. Editas algo crítico (shipping, payments)
# 2. Haces commit
# → Hook ejecuta tests relacionados
# → Hook verifica cambios en schema
# 3. Si falla, te muestra qué arreglarlo
```

---

## Comparación: Hooks vs Crons vs Scripts

| Método | Cuándo | Dónde | Ventaja | Desventaja |
|---|---|---|---|---|
| **Hooks** | Eventos de desarrollo | Tu máquina | Inmediato, sin delay | Solo durante desarrollo |
| **Cron (pg_cron)** | Horarios fijos | Supabase | Automático 24/7 | Latencia de 1-2 min |
| **Scripts Bash** | Manual | Tu máquina | Flexible, sin deps | Requiere ejecutar manualmente |
| **GitHub Actions** | Eventos de repo | GitHub | CI/CD profesional | Más complejo de setup |

**Recomendación**:
- Usa **Hooks** durante desarrollo local
- Usa **Crons** para procesos sin attended
- Usa **GitHub Actions** para CI/CD serio

---

**Última actualización**: 2026-03-27
**Proyecto**: Sewdle
