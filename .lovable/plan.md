
# Plan: Crear Nuevos Roles del Sistema

## Resumen
Agregaremos 4 nuevos roles al sistema sin modificar los roles existentes (Administrador, Diseñador, Líder QC, Taller). También agregaremos el módulo "Mensajería IA" que actualmente falta en el sistema de permisos.

---

## Cambios Requeridos

### 1. Agregar Módulo "Mensajería IA" al Sistema de Permisos

**Archivos a modificar:**
- `src/hooks/useRoles.ts` - Agregar mapeo del módulo
- `src/components/RoleModal.tsx` - Agregar módulo a la lista

El módulo se llamará internamente `messaging` en la base de datos y `Mensajería IA` en la interfaz.

### 2. Crear los 4 Nuevos Roles en la Base de Datos

**Migración SQL para crear los roles:**

| Rol | Descripción | Módulos con Acceso |
|-----|-------------|-------------------|
| **Calidad** | Control de calidad de productos y entregas | Dashboard (ver), Órdenes (ver/editar), Entregas (ver/editar) |
| **Atención al Cliente** | Gestión de consultas y soporte al cliente | Dashboard (ver), Órdenes (ver/editar), Entregas (ver/editar), Mensajería IA (ver/crear/editar) |
| **Reclutamiento** | Gestión de talleres y prospección | Dashboard (ver), Órdenes (ver/editar), Entregas (ver/editar), Insumos (ver), Talleres (ver/editar), Reclutamiento (ver/crear/editar) |
| **Producción** | Supervisión de producción y materiales | Dashboard (ver), Órdenes (ver/crear/editar), Entregas (ver/editar), Productos (ver/editar), Insumos (ver/editar), Talleres (ver/editar), Reclutamiento (ver) |

### 3. Actualizar el Sidebar para Respetar Permisos del Nuevo Módulo

**Archivo a modificar:** `src/components/AppSidebar.tsx`

Agregar verificación de permisos para "Mensajería IA" en los menús correspondientes.

---

## Detalle Técnico

### Paso 1: Actualizar Mapeo de Módulos

```typescript
// useRoles.ts - MODULE_MAPPING
const MODULE_MAPPING = {
  // ... existing modules
  'messaging': 'Mensajería IA'  // NUEVO
};
```

### Paso 2: Agregar Módulo al Modal de Roles

```typescript
// RoleModal.tsx - modules array
const modules = [
  'Dashboard',
  'Órdenes',
  'Talleres',
  'Productos',
  'Insumos',
  'Entregas',
  'Picking y Packing',
  'Usuarios',
  'Finanzas',
  'Reposición IA',
  'Shopify',
  'Reclutamiento',
  'Mensajería IA'  // NUEVO
];
```

### Paso 3: Migración SQL para Crear Roles

```sql
-- Rol: Calidad
INSERT INTO roles (name, description, permissions, is_system) VALUES (
  'Calidad',
  'Control de calidad de productos y entregas',
  '{
    "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
    "orders": {"view": true, "create": false, "edit": true, "delete": false},
    "deliveries": {"view": true, "create": false, "edit": true, "delete": false}
  }'::jsonb,
  true
);

-- Rol: Atención al Cliente
INSERT INTO roles (name, description, permissions, is_system) VALUES (
  'Atención al Cliente',
  'Gestión de consultas y soporte al cliente',
  '{
    "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
    "orders": {"view": true, "create": false, "edit": true, "delete": false},
    "deliveries": {"view": true, "create": false, "edit": true, "delete": false},
    "messaging": {"view": true, "create": true, "edit": true, "delete": false}
  }'::jsonb,
  true
);

-- Rol: Reclutamiento
INSERT INTO roles (name, description, permissions, is_system) VALUES (
  'Reclutamiento',
  'Gestión de talleres y prospección',
  '{
    "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
    "orders": {"view": true, "create": false, "edit": true, "delete": false},
    "deliveries": {"view": true, "create": false, "edit": true, "delete": false},
    "insumos": {"view": true, "create": false, "edit": false, "delete": false},
    "workshops": {"view": true, "create": false, "edit": true, "delete": false},
    "prospects": {"view": true, "create": true, "edit": true, "delete": false}
  }'::jsonb,
  true
);

-- Rol: Producción
INSERT INTO roles (name, description, permissions, is_system) VALUES (
  'Producción',
  'Supervisión de producción y materiales',
  '{
    "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
    "orders": {"view": true, "create": true, "edit": true, "delete": false},
    "deliveries": {"view": true, "create": false, "edit": true, "delete": false},
    "products": {"view": true, "create": false, "edit": true, "delete": false},
    "insumos": {"view": true, "create": false, "edit": true, "delete": false},
    "workshops": {"view": true, "create": false, "edit": true, "delete": false},
    "prospects": {"view": true, "create": false, "edit": false, "delete": false}
  }'::jsonb,
  true
);
```

### Paso 4: Actualizar Sidebar para Mensajería IA

Agregar verificación de permisos para el menú de Mensajería IA similar a como se hace con otros módulos.

---

## Resumen de Permisos por Rol

| Módulo | Calidad | Atención Cliente | Reclutamiento | Producción |
|--------|---------|------------------|---------------|------------|
| Dashboard | ✅ Ver | ✅ Ver | ✅ Ver | ✅ Ver |
| Órdenes | ✅ Ver/Editar | ✅ Ver/Editar | ✅ Ver/Editar | ✅ Ver/Crear/Editar |
| Entregas | ✅ Ver/Editar | ✅ Ver/Editar | ✅ Ver/Editar | ✅ Ver/Editar |
| Productos | ❌ | ❌ | ❌ | ✅ Ver/Editar |
| Insumos | ❌ | ❌ | ✅ Ver | ✅ Ver/Editar |
| Talleres | ❌ | ❌ | ✅ Ver/Editar | ✅ Ver/Editar |
| Reclutamiento | ❌ | ❌ | ✅ Ver/Crear/Editar | ✅ Ver |
| Mensajería IA | ❌ | ✅ Ver/Crear/Editar | ❌ | ❌ |

---

## Archivos a Modificar

1. `src/hooks/useRoles.ts` - Agregar mapeo de módulo "messaging"
2. `src/components/RoleModal.tsx` - Agregar "Mensajería IA" a la lista de módulos
3. `src/components/AppSidebar.tsx` - Agregar verificación de permisos para Mensajería IA
4. **Migración SQL** - Insertar los 4 nuevos roles en la tabla `roles`

---

## Notas Importantes

- Los roles existentes (Administrador, Diseñador, Líder QC, Taller) **NO serán modificados**
- Los nuevos roles se crean como `is_system: true` para que sean roles predefinidos del sistema
- Los usuarios podrán ser asignados a estos nuevos roles desde la página de Usuarios & Roles
- El módulo "Mensajería IA" se agregará al sistema de permisos para que pueda ser configurado en cualquier rol
