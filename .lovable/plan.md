
# Nuevas funciones para Mensajeria IA: No leido, Fijar y Carpetas

## Resumen

Se agregaran 3 funciones al modulo de Mensajeria IA:

1. **Marcar como no leido** - Seleccionar uno o varios chats y marcarlos como no leidos
2. **Fijar chats** - Fijar/desfijar chats para que aparezcan siempre arriba en la lista
3. **Carpetas** - Crear carpetas personalizadas, mover chats a carpetas y sacarlos

---

## 1. Cambios en la base de datos

Se necesitan 2 cambios:

### a) Agregar columnas a `messaging_conversations`
- `is_pinned` (BOOLEAN, default false) - indica si el chat esta fijado
- `folder_id` (UUID, nullable, FK) - referencia a la carpeta donde esta el chat

### b) Nueva tabla `messaging_folders`
- `id` (UUID, PK)
- `organization_id` (UUID, FK a organizations)
- `name` (TEXT, nombre de la carpeta)
- `color` (TEXT, color opcional para identificar visualmente)
- `sort_order` (INTEGER, para ordenar las carpetas)
- `created_at`, `updated_at`
- Politicas RLS por organizacion (igual patron que messaging_conversation_tags)

---

## 2. Marcar como no leido

### Comportamiento
- Click derecho o boton contextual en cada chat para "Marcar como no leido"
- Se podra hacer en un chat individual desde el listado
- Actualiza `unread_count` a 1 (si estaba en 0) para que el chat aparezca con indicador de no leido

### Archivos a modificar
- **`src/hooks/useMessagingConversations.ts`**: Agregar mutacion `markAsUnread` que haga UPDATE de `unread_count = GREATEST(unread_count, 1)` en la conversacion
- **`src/components/messaging-ai/ConversationsList.tsx`**: Agregar opcion "Marcar como no leido" en el menu contextual de cada chat (junto al boton de eliminar que ya existe)

---

## 3. Fijar chats

### Comportamiento
- Boton/opcion para fijar y desfijar un chat
- Los chats fijados aparecen siempre arriba de la lista, separados visualmente con un icono de pin
- No hay limite de chats fijados

### Archivos a modificar
- **`src/hooks/useMessagingConversations.ts`**: Agregar mutacion `togglePin` con optimistic update
- **`src/components/messaging-ai/ConversationsList.tsx`**: 
  - Agregar opcion de fijar/desfijar en el menu contextual
  - Separar la lista visualmente: primero los fijados (con icono de pin), luego los demas
  - Los fijados se ordenan por `last_message_at` entre ellos

---

## 4. Carpetas

### Comportamiento
- En el sidebar izquierdo, debajo de "Bandeja" y arriba de "Etiquetas", aparece una seccion "Carpetas"
- Boton para crear nueva carpeta (nombre + color)
- Al seleccionar una carpeta en el sidebar, se filtran los chats que pertenecen a esa carpeta
- En el menu contextual de cada chat: "Mover a carpeta" con submenu de carpetas disponibles + opcion "Sacar de carpeta"
- Una carpeta se puede eliminar (los chats vuelven a sin carpeta)

### Archivos a crear
- **`src/hooks/useMessagingFolders.ts`**: Hook con CRUD de carpetas + mutaciones para mover/sacar chats de carpetas

### Archivos a modificar
- **`src/components/messaging-ai/MessagingSidebar.tsx`**: Agregar seccion de carpetas con conteo, boton para crear nueva carpeta
- **`src/components/messaging-ai/ConversationsList.tsx`**: Agregar opcion "Mover a carpeta" en el menu contextual
- **`src/pages/MessagingAIPage.tsx`**: Agregar estado de carpeta activa, filtrar conversaciones por carpeta, pasar props de carpetas al sidebar y lista
- **`src/hooks/useMessagingConversations.ts`**: Incluir `is_pinned` y `folder_id` en la query y tipos

---

## 5. Menu contextual unificado

Las 3 acciones (no leido, fijar, mover a carpeta) se agruparan en un menu contextual (DropdownMenu) que aparece al hacer hover sobre cada chat, reemplazando el boton individual de eliminar actual. El menu tendra:

- Marcar como no leido / Marcar como leido
- Fijar / Desfijar
- Mover a carpeta (submenu con carpetas)
- Sacar de carpeta (si esta en una)
- Eliminar (con confirmacion, ya existente)

---

## Detalles tecnicos

### Migracion SQL

```text
-- Tabla de carpetas
CREATE TABLE public.messaging_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Columnas nuevas en messaging_conversations
ALTER TABLE public.messaging_conversations
  ADD COLUMN is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN folder_id UUID REFERENCES messaging_folders(id) ON DELETE SET NULL;

-- RLS para messaging_folders
ALTER TABLE public.messaging_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage folders in their org"
  ON public.messaging_folders FOR ALL
  USING (organization_id = get_current_organization_safe());
```

### Ordenamiento de la lista de chats

La lista se ordenara asi:
1. Chats fijados (ordenados por `last_message_at` DESC)
2. Chats normales (ordenados por `last_message_at` DESC)

### Flujo de la interfaz de carpetas

El sidebar mostrara las carpetas con un contador de chats en cada una. Al hacer clic en una carpeta, la lista principal se filtra para mostrar solo los chats de esa carpeta. Un clic en "Todos los chats" vuelve a mostrar todos.

### Tipos actualizados

La interfaz `Conversation` se extendera con:
- `is_pinned: boolean`
- `folder_id: string | null`
- `folder_name: string | null`
