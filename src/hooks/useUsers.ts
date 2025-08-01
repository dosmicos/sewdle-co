
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  workshopId?: string;
  workshopName?: string;
  status: 'active' | 'inactive';
  requiresPasswordChange: boolean;
  createdAt: string;
  lastLogin?: string;
  createdBy: string;
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar que tengamos una organización seleccionada
      if (!currentOrganization?.id) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Paso 1: Obtener usuarios de la organización actual
      console.log('🔍 DEBUGGING: Current organization:', currentOrganization);
      const { data: orgUsers, error: orgUsersError } = await supabase
        .from('organization_users')
        .select('user_id')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'active');

      console.log('🔍 DEBUGGING: Organization users query result:', { orgUsers, orgUsersError });

      if (orgUsersError) {
        logger.error('Error fetching organization users', orgUsersError);
        throw orgUsersError;
      }

      const userIds = orgUsers?.map(ou => ou.user_id) || [];
      console.log('🔍 DEBUGGING: User IDs found:', userIds, 'Count:', userIds.length);
      
      if (userIds.length === 0) {
        console.log('🔍 DEBUGGING: No user IDs found, returning empty');
        setUsers([]);
        setLoading(false);
        return;
      }

      // Paso 2: Obtener perfiles de usuarios de la organización
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      console.log('🔍 DEBUGGING: Profiles query result:', { profiles, profilesError });
      console.log('🔍 DEBUGGING: Profiles count:', profiles?.length);

      if (profilesError) {
        logger.error('Error fetching profiles', profilesError);
        throw profilesError;
      }

      // Paso 3: Obtener roles de usuarios de la organización (LEFT JOIN para incluir usuarios sin rol)
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          workshop_id,
          roles (
            name
          )
        `)
        .in('user_id', userIds);

      console.log('🔍 DEBUGGING: User roles query result:', { userRoles, rolesError });
      console.log('🔍 DEBUGGING: User roles count:', userRoles?.length);

      if (rolesError) {
        logger.error('Error fetching user roles', rolesError);
        throw rolesError;
      }

      // Paso 4: Obtener información de talleres si hay IDs de talleres
      const workshopIds = userRoles
        ?.filter(ur => ur.workshop_id)
        .map(ur => ur.workshop_id) || [];

      console.log('🔍 DEBUGGING: Workshop IDs found:', workshopIds);

      let workshops: any[] = [];
      if (workshopIds.length > 0) {
        const { data: workshopsData, error: workshopsError } = await supabase
          .from('workshops')
          .select('id, name')
          .in('id', workshopIds);

        console.log('🔍 DEBUGGING: Workshops query result:', { workshopsData, workshopsError });

        if (workshopsError) {
          logger.warn('Error fetching workshops', workshopsError);
          // No lanzar error aquí, solo log
        } else {
          workshops = workshopsData || [];
        }
      }

      // Paso 5: Combinar los datos
      console.log('🔍 DEBUGGING: Starting data combination...');
      console.log('🔍 DEBUGGING: Profiles to process:', profiles?.length);
      
      const formattedUsers: User[] = profiles?.map((profile: any) => {
        console.log('🔍 DEBUGGING: Processing profile:', profile.id, profile.email);
        
        // Buscar rol del usuario
        const userRole = userRoles?.find(ur => ur.user_id === profile.id);
        console.log('🔍 DEBUGGING: Found user role for', profile.id, ':', userRole);
        
        const roleName = userRole?.roles?.name || 'Sin Rol';
        
        // Buscar información del taller
        const workshopId = userRole?.workshop_id;
        const workshop = workshops.find(w => w.id === workshopId);
        const workshopName = workshop?.name;
        
        const formattedUser = {
          id: profile.id,
          name: profile.name || profile.email,
          email: profile.email,
          role: roleName,
          workshopId: workshopId,
          workshopName: workshopName,
          status: 'active' as const, // Por defecto activo
          requiresPasswordChange: profile.requires_password_change || false,
          createdAt: profile.created_at,
          lastLogin: undefined, // TODO: Implementar seguimiento de último login
          createdBy: 'system' // TODO: Implementar tracking de quién creó el usuario
        };
        
        console.log('🔍 DEBUGGING: Formatted user:', formattedUser);
        return formattedUser;
      }) || [];

      console.log('🔍 DEBUGGING: Final formatted users count:', formattedUsers.length);
      console.log('🔍 DEBUGGING: Final formatted users:', formattedUsers);

      setUsers(formattedUsers);
    } catch (err: any) {
      logger.error('Error fetching users', err);
      setError(err.message || 'Error al cargar usuarios');
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: {
    name: string;
    email: string;
    role: string;
    workshopId?: string;
    requiresPasswordChange?: boolean;
  }) => {
    try {
      logger.info('Creating user', userData.email);
      console.log('useUsers: Starting user creation with data:', userData);

      // Llamar a la Edge Function para crear el usuario
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          ...userData,
          organizationId: currentOrganization?.id
        }
      });
      
      console.log('useUsers: Raw response from edge function:', { data, error });

      if (error) {
        logger.error('Error in Edge Function', error);
        throw new Error(error.message || 'Error al crear usuario');
      }

      if (!data.success) {
        console.log('useUsers: Edge function returned error:', data.error);
        throw new Error(data.error || 'Error desconocido al crear usuario');
      }

      console.log('useUsers: User created successfully, temp password:', data.tempPassword);
      await fetchUsers();
      
      const successResult = { success: true, tempPassword: data.tempPassword };
      console.log('useUsers: Returning success result:', successResult);
      
      // No mostrar toast aquí - se maneja en UserModal para mejor UX
      return successResult;
    } catch (err: any) {
      console.log('useUsers: Error in createUser:', err);
      logger.error('Error creating user', err);
      toast({
        title: "Error al crear usuario",
        description: err.message || "Hubo un problema al crear el usuario",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      // Actualizar perfil
      if (updates.name || updates.email || updates.requiresPasswordChange !== undefined) {
        await supabase
          .from('profiles')
          .update({
            name: updates.name,
            email: updates.email,
            requires_password_change: updates.requiresPasswordChange
          })
          .eq('id', userId);
      }

      // Actualizar rol si es necesario
      if (updates.role && updates.role !== 'Sin Rol') {
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', updates.role)
          .single();

        if (role) {
          // Verificar si ya existe un rol para este usuario
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .single();

          if (existingRole) {
            // Actualizar rol existente
            await supabase
              .from('user_roles')
              .update({
                role_id: role.id,
                workshop_id: updates.workshopId || null,
                organization_id: currentOrganization?.id
              })
              .eq('user_id', userId);
          } else {
            // Crear nuevo rol para el usuario
            await supabase
              .from('user_roles')
              .insert({
                user_id: userId,
                role_id: role.id,
                workshop_id: updates.workshopId || null,
                organization_id: currentOrganization?.id
              });
          }
        }
      }

      await fetchUsers();
      
      toast({
        title: "Usuario actualizado",
        description: "Los cambios han sido guardados correctamente",
      });

      return { success: true };
    } catch (err: any) {
      logger.error('Error updating user', err);
      toast({
        title: "Error al actualizar usuario",
        description: err.message || "Hubo un problema al actualizar el usuario",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Eliminar rol del usuario
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Eliminar perfil
      await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      // Eliminar usuario de auth usando Edge Function (se podría crear otra función para esto)
      // Por ahora, como es una operación menos frecuente, podríamos mantenerlo manual
      
      await fetchUsers();
      
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente",
      });

      return { success: true };
    } catch (err: any) {
      logger.error('Error deleting user', err);
      toast({
        title: "Error al eliminar usuario",
        description: err.message || "Hubo un problema al eliminar el usuario. Para eliminación completa, contacte al administrador del sistema.",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentOrganization?.id]);

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers
  };
};
