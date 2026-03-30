# ✅ Checklist: Implementación de Automatizaciones

Use este checklist para cada automatización que implemente. Marque casillas a medida que avanza.

---

## Automatización #1: _____________________ (Nombre)

**Descripción**:
**Frecuencia**:
**Función a usar**:
**Creador**: _________________ **Fecha**: _________

---

### Fase 1: Preparación

- [ ] Leí GUIAS_AUTOMATIZACIONES.md o QUICK_START.md
- [ ] Verifiqué que la función existe en `/supabase/functions/`
  ```bash
  npx supabase functions list | grep "nombre-funcion"
  ```
- [ ] Probé la función manualmente para confirmar que funciona
  ```bash
  npx supabase functions invoke nombre-funcion
  ```
- [ ] Decidí el horario (ejemplo: "0 2 * * *" = 2 AM UTC)
- [ ] Convertí el horario a mi zona (Colombia UTC-5)
  - UTC 2 AM → 21:00 Colombia
- [ ] Obtuve la URL correcta de la función
  - Formato: `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/nombre-funcion`

---

### Fase 2: Crear Migración

- [ ] Crear archivo de migración
  ```bash
  npx supabase migration create nombre_descriptivo_de_mi_tarea
  ```

- [ ] Anoté el nombre del archivo generado
  - Archivo: `supabase/migrations/20260327_______.sql`

- [ ] Edité el archivo con la configuración Cron:
  ```sql
  SELECT cron.schedule(
    'mi-nombre-unico',
    '0 2 * * *',  -- Tu horario aquí
    $$
    SELECT net.http_post(
        url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/nombre',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
        body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
    );
    $$
  );
  ```

- [ ] Verifiqué sintaxis SQL (sin errores obvios)

---

### Fase 3: Deploy a Supabase

- [ ] Ejecuté:
  ```bash
  npx supabase db push
  ```

- [ ] Confirmé que salió: `✅ Database push successful`

- [ ] **Si falló**: Revisé el error y lo arreglé
  - [ ] Error de sintaxis: revisé comillas y puntuación
  - [ ] Error de conexión: verifiqué token Supabase
  - [ ] Otro: ______________________________

---

### Fase 4: Verificación Inmediata

- [ ] El job existe en Supabase:
  ```sql
  -- En Supabase Dashboard → SQL Editor
  SELECT * FROM cron.job WHERE jobname = 'mi-nombre-unico';
  ```

- [ ] Resultado esperado:
  - [ ] Veo una fila con mi jobname
  - [ ] El `schedule` es correcto (ej: `0 2 * * *`)
  - [ ] El estado `enabled` es `true`

- [ ] **Si no existe**: Ejecuté `npx supabase db push` de nuevo

---

### Fase 5: Testing

- [ ] Probé la función manualmente una última vez
  ```bash
  npx supabase functions invoke nombre-funcion --body '{"scheduled": true}'
  ```

- [ ] Resultado esperado: ✅ `{"success": true, ...}`

- [ ] Si falló, lo arreglé antes de continuar

---

### Fase 6: Monitoreo de Primera Ejecución

- [ ] Anotaré la próxima hora de ejecución:
  - Horario UTC: __________
  - Horario Colombia: __________
  - Fecha/hora aproximada: __________________

- [ ] **A la hora programada**: Revisaré los logs
  ```bash
  npx supabase functions logs nombre-funcion --limit 5
  ```

- [ ] Buscaré:
  - [ ] Status code 200 (éxito)
  - [ ] Timestamp que coincide con la hora agendada
  - [ ] No hay error messages

- [ ] **Si falló**:
  - [ ] Anotaré el error
  - [ ] Revisaré TROUBLESHOOTING en GUIAS_AUTOMATIZACIONES.md
  - [ ] Haré fixing
  - [ ] Esperaré la próxima ejecución

---

### Fase 7: Validar que Funciona (Post-Ejecución)

Según el tipo de automatización, verificar diferente:

#### Si es Sync de Datos (Shopify, Ads, etc):
- [ ] Revisé la tabla correspondiente
  - Tabla: ___________________
  - Comando: `SELECT * FROM tabla ORDER BY created_at DESC LIMIT 5;`
- [ ] Verifiqué que hay datos nuevos/actualizados
- [ ] Timestamp de actualización coincide con ejecución

#### Si es Notificación/Email:
- [ ] Revisé que se envió
  - [ ] Email recibido en inbox
  - [ ] WhatsApp mensaje enviado
  - [ ] Notification en app

#### Si es Cálculo (Reposición, Stock, etc):
- [ ] Revisé tabla de resultados
  - Tabla: ___________________
- [ ] Verificaré que hay nuevos registros
- [ ] Valores tienen sentido (no NaN, no NULL inesperados)

#### Si es Limpieza/Archivo:
- [ ] Conteo antes: _____ registros
- [ ] Conteo después: _____ registros
- [ ] Diferencia: _____ (archiviados/eliminados)

---

### Fase 8: Mantenimiento Continuo

**Semanal (Cada viernes)**:
- [ ] Revisé logs de la última ejecución
  - Archivo de log: _________________
- [ ] ¿Hay errores? SÍ / NO
- [ ] Si hay errores, anotaré:
  - Error: ______________________________
  - Impacto: ______________________________

**Mensual (Primer viernes del mes)**:
- [ ] Verifiqué que la tarea se ejecutó todas las veces
  - [ ] Contar ejecutiones en logs (esperadas: _____)
  - [ ] Ejecutiones observadas: _____
- [ ] ¿Faltó alguna? SÍ / NO
  - Si SÍ: investigar por qué
- [ ] ¿El resultado tiene sentido?
  - Comparar con mes anterior
  - ¿Más/menos/igual? ______________________

---

### Fase 9: Documentación

- [ ] Documenté esta automatización:
  - [ ] Nombre en el título
  - [ ] Descripción clara
  - [ ] Horario en UTC y Colombia
  - [ ] Función usada
  - [ ] Dónde se archivó (carpeta/migración)

- [ ] Actualicé AUTOMATIZACIONES_REGISTRY.md (si existe)
  - [ ] Nombre
  - [ ] Estado (Activa / Testing / Paused)
  - [ ] Última verificación
  - [ ] Responsable

---

### Fase 10: Completar

- [ ] Marqué todo arriba ✅
- [ ] Esta automatización está lista para producción
- [ ] Notifiqué al equipo en el commit/PR

**Commit message**:
```
feat: add scheduled task for {nombre-automatizacion}

- Executes every {horario} UTC ({horario-colombia} Colombia)
- Function: {nombre-funcion}
- Migration: {nombre-archivo.sql}
- Verified working on first execution
```

---

## Template para Automatizaciones Múltiples

Copiar esta sección para cada automatización nueva:

```markdown
## Automatización #__: _____________________

**Descripción**:
**Frecuencia**:
**Función**:
**Responsable**:

### Pasos Completados

- [ ] Fase 1: Preparación
- [ ] Fase 2: Crear Migración
- [ ] Fase 3: Deploy
- [ ] Fase 4: Verificación
- [ ] Fase 5: Testing
- [ ] Fase 6: Monitoreo
- [ ] Fase 7: Validación
- [ ] Fase 8: Mantenimiento
- [ ] Fase 9: Documentación
- [ ] Fase 10: Completar

**Status**: ⏳ En Progreso / ✅ Completada / ❌ Bloqueada

**Notas**:
```

---

## Troubleshooting Rápido (Durante Checklist)

### "La función no existe"
```bash
# Ver lista de funciones disponibles
npx supabase functions list

# Si no está: deployar
npx supabase functions deploy nombre-funcion
```

### "El job no aparece en cron.job"
```bash
# Verificar migración se ejecutó
npx supabase db show

# Ver todas las migraciones aplicadas
npx supabase migration list
```

### "La función falla al ejecutarse"
```bash
# Ver error detallado
npx supabase functions logs nombre-funcion --limit 20

# Ejecutar manualmente para debug
npx supabase functions invoke nombre-funcion
```

### "El horario no es el que esperaba"
- [ ] Revise tabla de conversión UTC → Colombia
- [ ] Recuerde: Colombia UTC-5
- [ ] Ejemplo: UTC 2 AM = 21:00 Colombia

---

## Registro Histórico de Automatizaciones

Mantén este registro actualizado:

| # | Nombre | Estado | Creada | Última Verificada | Responsable | Notas |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

---

## Escalas de Éxito

### ✅ Completada Exitosamente
- [ ] Job existe en `cron.job`
- [ ] Se ejecutó sin errores
- [ ] Los datos están actualizados
- [ ] Logs muestran `status 200`

### ⚠️ Completada pero con Avisos
- [ ] Job existe pero
- [ ] Se ejecutó pero lentamente (>5 min)
- [ ] Datos se actualizaron pero con warnings
- [ ] Revisar logs para optimizar

### ❌ No Completada
- [ ] Job no existe en `cron.job`
- [ ] Se ejecutó pero falló
- [ ] Los datos NO se actualizaron
- [ ] Logs muestran error

**Si está en ❌**: Regresa a Fase 1 y revisa TROUBLESHOOTING

---

## Notas Rápidas

**Nombre único**: Asegúrate que cada jobname es único
```sql
-- MAL:
SELECT cron.schedule('sync', '0 2 * * *', ...);  -- Nombre genérico

-- BIEN:
SELECT cron.schedule('sync-shopify-sales-daily', '0 2 * * *', ...);
```

**Formato de horario**: Sintaxis correcta es crítica
```
Minuto (0-59) Hour (0-23) Day (1-31) Month (1-12) Day of Week (0-6)
0            2            *          *            *
```

**Token**: Siempre usar `current_setting('app.settings.anon_key')`
```sql
-- NO hardcodees el token, úsalo así:
'Authorization': 'Bearer ' || current_setting('app.settings.anon_key') || '
```

---

## Próximo Paso Después de Completar

- [ ] Automatización #2
- [ ] Automatización #3
- [ ] Etc...

O:
- [ ] Documentar proceso para el equipo
- [ ] Crear dashboard de monitoreo
- [ ] Optimizar horarios

---

**Última actualización**: 2026-03-27
**Proyecto**: Sewdle
**Objetivo**: Garantizar que todas las automatizaciones estén correctamente implementadas y monitoreadas

---

## Tips Finales

1. **Copia este checklist** para cada nueva automatización
2. **Completa cada fase** antes de continuar
3. **No saltes fases** - parecerá que ralentiza pero evita problemas
4. **Documenta todo** - facilita debugging después
5. **Verifica logs** - la mejor forma de estar seguro que funciona
6. **Sé paciente** - algunos crons se ejecutan 1-2 min después de su horario

**¡Listo! Ya tienes todo lo que necesitas. ¡Adelante con tu automatización! 🚀**
