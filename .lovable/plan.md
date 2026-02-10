
# Reemplazar "Verificar Guia" por "Registrar Guia Manual"

## Resumen
Quitar el boton "Verificar Guia" (que no funciona correctamente) y reemplazarlo por un boton para registrar manualmente el numero de guia. El boton "Cotizar Envio" se mantiene.

## Cambios en EnviaShippingButton.tsx

### Estado inicial (lineas ~709-741)
- Reemplazar el boton "Verificar Guia" por un boton "Guia Manual" que abre el formulario de registro manual (setShowManualEntry(true))
- Mantener el boton "Cotizar Envio" tal cual

### Estado de carga (lineas ~745-781)
- Quitar la referencia al modo "verifying" del boton izquierdo
- Reemplazar por el boton "Guia Manual" deshabilitado mientras se cotiza

### Estado de error (lineas ~784-817)
- Quitar el boton "Verificar Guia" de la seccion de error
- Reemplazar por "Guia Manual"

### Estado "no se encontro guia" (lineas ~821-846)
- Quitar el boton "Verificar Guia"
- Reemplazar por "Guia Manual"

### Logica de busyMode (linea ~706)
- Simplificar: ya no necesita el modo 'verifying' porque no se verifica automaticamente

## Lo que NO se cambia
- El formulario de registro manual (lineas 934-991) ya existe y funciona perfectamente
- La funcion handleSaveManualLabel ya guarda en shipping_labels
- El boton "Cotizar Envio" se mantiene igual
- Toda la logica de creacion de guia via Envia.com se mantiene
- El historial de guias se mantiene

## Resultado visual

```text
Antes:                          Despues:
[Verificar Guia] [Cotizar]     [Guia Manual] [Cotizar Envio]
```

Al hacer click en "Guia Manual", se muestra el formulario existente con campo de tracking, selector de transportadora, y botones Cancelar/Guardar.
