-- Crear 4 nuevos roles del sistema sin modificar los existentes

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