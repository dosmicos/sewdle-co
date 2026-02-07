

# Eliminar "Interesado" y mostrar conteo de campanas en el Kanban de Prospectos

## Cambio 1: Quitar columna "Interesado" (respondio_si)

Actualmente el flujo en el Kanban de prospectos es:

```text
Prospecto -> Contactado -> Interesado (respondio_si) -> Negociando
```

Se cambiara a:

```text
Prospecto -> Contactado -> Negociando
```

- El boton "Si" en la columna "Contactado" cambiara el status directamente a `negociando` (en vez de `respondio_si`).
- Se eliminara `respondio_si` de la lista de columnas visibles en el Kanban (`PROSPECT_KANBAN_COLUMNS`).
- Los creadores que ya esten en `respondio_si` en la base de datos seguiran existiendo pero no apareceran en ninguna columna del Kanban visible. Para resolverlo, se puede: (a) mostrarlos en la columna de "Negociando" mapeandolos automaticamente en el frontend, o (b) dejarlos en la DB y que aparezcan al filtrar. La opcion (a) es mas limpia.
- El boton "+ Campana" que aparecia en `respondio_si` y `negociando` ahora solo aparecera en `negociando`.
- NO se eliminara `respondio_si` del CHECK constraint de la base de datos ni del tipo TypeScript, para no romper registros historicos.

## Cambio 2: Mostrar numero de campanas en las tarjetas del Kanban

Para cada creador en el Kanban de prospectos, se contara cuantas campanas tiene y se mostrara un badge en la tarjeta cuando tenga al menos 1.

Esto requiere pasar la lista de `campaigns` al componente `UgcProspectKanban` para poder hacer el conteo por `creator_id`.

---

## Archivos a modificar

### 1. `src/types/ugc.ts`
- Quitar `respondio_si` de `PROSPECT_KANBAN_COLUMNS` (solo quedan: prospecto, contactado, negociando).

### 2. `src/components/ugc/UgcProspectKanban.tsx`
- Agregar prop `campaigns` al componente.
- Cambiar el boton "Si" para que envie status `negociando` en vez de `respondio_si`.
- Eliminar el bloque de botones especifico para `status === 'respondio_si'`.
- Actualizar la condicion del boton "+ Campana" para que solo aparezca en `negociando`.
- Mapear creadores con status `respondio_si` a la columna `negociando` en `getCreatorsForColumn`.
- Agregar un badge con el conteo de campanas por creador (ej: "2 campanas") cuando sea mayor a 0.

### 3. `src/pages/UgcCreatorsPage.tsx`
- Pasar `campaigns` como nueva prop a `UgcProspectKanban`.
