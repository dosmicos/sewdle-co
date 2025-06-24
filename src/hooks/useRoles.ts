
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Permission {
  module: string;
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  usersCount: number;
}

// Diccionario bidireccional para mapeo de módulos
const MODULE_MAPPING = {
  // Base de datos → Interfaz
  'dashboard': 'Dashboard',
  'orders': 'Órdenes',
  'workshops': 'Talleres', 
  'products': 'Productos',
  'insumos': 'Insumos',
  'deliveries': 'Entregas',
  'users': 'Usuarios',
  'reports': 'Reportes',
  'qc': 'QC (Control de Calidad)'
};

// Mapeo inverso: Interfaz → Base de datos
const REVERSE_MODULE_MAPPING = Object.fromEntries(
  Object.entries(MODULE_MAPPING).map(([key, value]) => [value, key])
);

export const useRoles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener roles con conteo de usuarios
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(`
          id,
          name,
          description,
          permissions,
          is_system,
          user_roles(count)
        `);

      if (rolesError) {
        throw rolesError;
      }

      // Transformar permisos del formato JSONB al formato esperado
      const formattedRoles: Role[] = rolesData?.map((role: any) => {
        const permissions: Permission[] = [];
        
        if (role.permissions && typeof role.permissions === 'object') {
          Object.keys(role.permissions).forEach(dbModule => {
            const modulePerms = role.permissions[dbModule];
            // Usar el mapeo para convertir nombre del módulo de BD a UI
            const displayModule = MODULE_MAPPING[dbModule as keyof typeof MODULE_MAPPING] || 
                                  dbModule.charAt(0).toUpperCase() + dbModule.slice(1);
            
            permissions.push({
              module: displayModule,
              actions: {
                view: modulePerms.view || false,
                create: modulePerms.create || false,
                edit: modulePerms.edit || false,
                delete: modulePerms.delete || false
              }
            });
          });
        }

        return {
          id: role.id,
          name: role.name,
          description: role.description,
          permissions,
          isSystem: role.is_system,
          usersCount: role.user_roles?.[0]?.count || 0
        };
      }) || [];

      setRoles(formattedRoles);
    } catch (err: any) {
      console.error('Error fetching roles:', err);
      setError(err.message || 'Error al cargar roles');
      toast({
        title: "Error",
        description: "No se pudieron cargar los roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createRole = async (roleData: {
    name: string;
    description: string;
    permissions: Permission[];
  }) => {
    try {
      // Transformar permisos al formato JSONB usando mapeo inverso
      const permissionsJson: Record<string, any> = {};
      roleData.permissions.forEach(permission => {
        // Convertir nombre del módulo de UI a BD
        const dbModule = REVERSE_MODULE_MAPPING[permission.module] || 
                        permission.module.toLowerCase();
        permissionsJson[dbModule] = permission.actions;
      });

      const { error } = await supabase
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          permissions: permissionsJson,
          is_system: false
        });

      if (error) {
        throw error;
      }

      await fetchRoles();
      
      toast({
        title: "Rol creado",
        description: `El rol "${roleData.name}" ha sido creado exitosamente`,
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error creating role:', err);
      toast({
        title: "Error al crear rol",
        description: err.message || "Hubo un problema al crear el rol",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  const updateRole = async (roleId: string, updates: {
    name?: string;
    description?: string;
    permissions?: Permission[];
  }) => {
    try {
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      
      if (updates.permissions) {
        // Transformar permisos al formato JSONB usando mapeo inverso
        const permissionsJson: Record<string, any> = {};
        updates.permissions.forEach(permission => {
          // Convertir nombre del módulo de UI a BD
          const dbModule = REVERSE_MODULE_MAPPING[permission.module] || 
                          permission.module.toLowerCase();
          permissionsJson[dbModule] = permission.actions;
        });
        updateData.permissions = permissionsJson;
      }

      const { error } = await supabase
        .from('roles')
        .update(updateData)
        .eq('id', roleId);

      if (error) {
        throw error;
      }

      await fetchRoles();
      
      toast({
        title: "Rol actualizado",
        description: "Los cambios han sido guardados correctamente",
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast({
        title: "Error al actualizar rol",
        description: err.message || "Hubo un problema al actualizar el rol",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  const deleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) {
        throw error;
      }

      await fetchRoles();
      
      toast({
        title: "Rol eliminado",
        description: "El rol ha sido eliminado correctamente",
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting role:', err);
      toast({
        title: "Error al eliminar rol",
        description: err.message || "Hubo un problema al eliminar el rol",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return {
    roles,
    loading,
    error,
    createRole,
    updateRole,
    deleteRole,
    refetch: fetchRoles
  };
};
