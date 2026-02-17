
import { useState, useEffect, useCallback } from 'react';
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
  const organizationId = currentOrganization?.id;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar que tengamos una organización seleccionada
      if (!organizationId) {
        setUsers([]);
        setLoading(false);
        return;
      }

      console.log('🔍 DEBUGGING: Current organization id:', organizationId);
      
      // Usar la nueva función optimizada de base de datos
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_organization_users_detailed');

      console.log('🔍 DEBUGGING: RPC function result:', { usersData, usersError });

      if (usersError) {
        logger.error('Error fetching organization users with RPC', usersError);
        throw usersError;
      }

      console.log('🔍 DEBUGGING: Users data fetched:', usersData?.length || 0);

      // Transformar los datos al formato esperado
      const transformedUsers: User[] = (usersData || []).map(userData => {
        const transformedUser = {
          id: userData.id,
          name: userData.name || '',
          email: userData.email || '',
          role: userData.role || 'Sin Rol',
          workshopId: userData.workshop_id || undefined,
          workshopName: userData.workshop_name || undefined,
          status: userData.status as 'active' | 'inactive',
          requiresPasswordChange: userData.requires_password_change || false,
          createdAt: userData.created_at || new Date().toISOString(),
          lastLogin: userData.last_login || undefined,
          createdBy: userData.created_by || '',
        };
        
        console.log('🔍 DEBUGGING: Transformed user:', transformedUser);
        return transformedUser;
      });

      console.log('🔍 DEBUGGING: Final transformed users count:', transformedUsers.length);
      setUsers(transformedUsers);
    } catch (err: unknown) {
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
  }, [organizationId, toast]);

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
        const errorMessage = error.message || 'Error al crear usuario';
        throw new Error(errorMessage);
      }

      if (!data.success) {
        console.log('useUsers: Edge function returned error:', data.error);
        // Manejar específicamente el error de email duplicado
        const errorMessage = data.code === 'email_exists' 
          ? 'Este correo electrónico ya está registrado en el sistema'
          : data.error || 'Error desconocido al crear usuario';
        throw new Error(errorMessage);
      }

      console.log('useUsers: User created successfully, temp password:', data.tempPassword);
      await fetchUsers();
      
      const successResult = { success: true, tempPassword: data.tempPassword };
      console.log('useUsers: Returning success result:', successResult);
      
      // No mostrar toast aquí - se maneja en UserModal para mejor UX
      return successResult;
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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

      // Soft delete: Marcar como eliminado en organization_users
      await supabase
        .from('organization_users')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('organization_id', currentOrganization?.id);

      // Eliminar perfil
      await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      await fetchUsers();
      
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente de la organización",
      });

      return { success: true };
    } catch (err: unknown) {
      logger.error('Error deleting user', err);
      toast({
        title: "Error al eliminar usuario",
        description: err.message || "Hubo un problema al eliminar el usuario",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
