
# Eliminar columnas "Contactado" y "Negociando" del Kanban de Campanas y mejorar layout

## Problema
El Kanban de campanas muestra 7 columnas (Contactado, Negociando, Aceptado, Producto Enviado, Producto Recibido, Video en Revision, Completado). Las dos primeras siempre estan vacias porque las campanas se crean directamente en estado "aceptado". Ademas, con tantas columnas se requiere scroll horizontal.

## Cambios

### 1. Eliminar columnas del array `KANBAN_COLUMNS` (`src/types/ugc.ts`)
Quitar `contactado` y `negociando` del array, dejando solo 5 columnas:
- Aceptado
- Producto Enviado
- Producto Recibido
- Video en Revision
- Completado

### 2. Hacer columnas responsivas (`src/components/ugc/UgcKanbanBoard.tsx`)
- Cambiar el ancho fijo `w-[280px]` por `flex-1 min-w-[200px]`
- Quitar `min-w-max` del contenedor flex para que las columnas se distribuyan en el espacio disponible sin forzar scroll horizontal
- Con 5 columnas y ancho flexible, todo cabe en pantalla sin scroll lateral

## Resultado
- 5 columnas que se reparten el ancho disponible
- Sin scroll horizontal
- Sin columnas vacias innecesarias
