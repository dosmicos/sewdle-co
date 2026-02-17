
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';

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
  'picking y packing': 'Picking y Packing',
  'users': 'Usuarios',
  'finances': 'Finanzas',
  'replenishment': 'Reposición IA',
  'shopify': 'Shopify',
  'prospects': 'Reclutamiento',
  'messaging': 'Mensajería IA'
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
  const queryClient = useQueryClient();

  const fetchRoles = useCallback(async () => {
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
      const formattedRoles: Role[] = rolesData?.map((role: unknown) => {
        const permissions: Permission[] = [];
        
        if (role.permissions && typeof role.permissions === 'object') {
          // DEBUG: Log para ver qué recibimos de la BD
          console.log('🔍 DEBUG fetchRoles - Permisos de BD para rol:', role.name, {
            rawPermissions: role.permissions,
            moduleMapping: MODULE_MAPPING
          });
          
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
    } catch (err: unknown) {
      logger.error('Error fetching roles', err);
      setError(err.message || 'Error al cargar roles');
      toast({
        title: "Error",
        description: "No se pudieron cargar los roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createRole = async (roleData: {
    name: string;
    description: string;
    permissions: Permission[];
  }) => {
    try {
      // Transformar permisos al formato JSONB usando mapeo inverso
      const permissionsJson: Record<string, unknown> = {};
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
    } catch (err: unknown) {
      logger.error('Error creating role', err);
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
      const updateData: unknown = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      
      if (updates.permissions) {
        // SIMPLIFICACIÓN: Como RoleModal ahora envía TODOS los módulos,
        // no necesitamos hacer merge. Simplemente convertimos y filtramos.
        const permissionsJson: Record<string, unknown> = {};
        
        // Procesar cada módulo recibido
        updates.permissions.forEach(permission => {
          // Convertir nombre del módulo de UI a BD
          const dbModule = REVERSE_MODULE_MAPPING[permission.module] || 
                          permission.module.toLowerCase();
          
          // ✅ FASE 1: Siempre guardar módulos, incluso si todas las acciones están en false
          // Esto previene que los módulos desaparezcan de la BD
          permissionsJson[dbModule] = permission.actions;
          
          const hasAnyTrueAction = Object.values(permission.actions).some(v => v === true);
          console.log(`✅ Guardando módulo ${dbModule}:`, {
            actions: permission.actions,
            hasAnyTrueAction,
            willBeSaved: true
          });
        });
        
        updateData.permissions = permissionsJson;
        
        // 🔍 FASE 4: Logging mejorado
        console.log('🔍 DEBUG updateRole - Permisos finales para guardar:', {
          totalModulosEnviados: updates.permissions.length,
          totalModulosGuardados: Object.keys(permissionsJson).length,
          permisosFinales: JSON.stringify(permissionsJson, null, 2),
          moduleMapping: REVERSE_MODULE_MAPPING,
          // Verificaciones específicas de módulos críticos
          prospectsIncluido: 'prospects' in permissionsJson,
          prospectsValor: permissionsJson.prospects,
          todosLosModulos: Object.keys(permissionsJson)
        });
      }

      // 🔥 LOGGING EXHAUSTIVO PRE-UPDATE
      console.log('📤 ========== PRE-UPDATE SUPABASE ==========');
      console.log('📤 Role ID:', roleId);
      console.log('📤 Update Data COMPLETO:', JSON.stringify(updateData, null, 2));
      console.log('📤 Permisos en updateData.permissions:', updateData.permissions);
      console.log('📤 ¿prospects está en permissions?', 'prospects' in (updateData.permissions || {}));
      console.log('📤 Valor de prospects:', updateData.permissions?.prospects);
      console.log('📤 ==========================================');

      const { error, data: updateResponse } = await supabase
        .from('roles')
        .update(updateData)
        .eq('id', roleId)
        .select();

      // 🔥 LOGGING EXHAUSTIVO POST-UPDATE
      console.log('📥 ========== POST-UPDATE SUPABASE ==========');
      console.log('📥 Error:', error);
      console.log('📥 Update Response:', updateResponse);
      console.log('📥 ==========================================');

      if (error) {
        console.error('❌ ERROR EN UPDATE:', error);
        throw error;
      }

      // 🔥 VERIFICACIÓN POST-UPDATE: Leer inmediatamente de la BD
      console.log('🔍 ========== VERIFICACIÓN POST-UPDATE ==========');
      const { data: verifyRole, error: verifyError } = await supabase
        .from('roles')
        .select('permissions')
        .eq('id', roleId)
        .single();

      const permissions = verifyRole?.permissions as Record<string, unknown> | null;
      console.log('🔍 Role después del update:', verifyRole);
      console.log('🔍 ¿prospects existe en BD?', permissions?.prospects);
      console.log('🔍 Todos los módulos en BD:', Object.keys(permissions || {}));
      console.log('🔍 ================================================');

      if (verifyError) {
        console.error('❌ ERROR EN VERIFICACIÓN:', verifyError);
      }

      await fetchRoles();
      
      // 🔥 FASE 2: Invalidar caché de permisos de usuarios
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      console.log('✅ Caché de permisos invalidado - Los usuarios verán los cambios inmediatamente');
      
      toast({
        title: "Rol actualizado",
        description: "Los cambios han sido guardados correctamente",
      });

      return { success: true };
    } catch (err: unknown) {
      logger.error('Error updating role', err);
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
    } catch (err: unknown) {
      logger.error('Error deleting role', err);
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
  }, [fetchRoles]);

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
