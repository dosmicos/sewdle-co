
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Paso 1: Obtener todos los perfiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('Profiles data received:', profiles);

      // Paso 2: Obtener roles de usuarios
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          workshop_id,
          roles!inner (
            name
          )
        `);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      console.log('User roles data received:', userRoles);

      // Paso 3: Obtener información de talleres si hay IDs de talleres
      const workshopIds = userRoles
        ?.filter(ur => ur.workshop_id)
        .map(ur => ur.workshop_id) || [];

      let workshops: any[] = [];
      if (workshopIds.length > 0) {
        const { data: workshopsData, error: workshopsError } = await supabase
          .from('workshops')
          .select('id, name')
          .in('id', workshopIds);

        if (workshopsError) {
          console.error('Error fetching workshops:', workshopsError);
          // No lanzar error aquí, solo log
        } else {
          workshops = workshopsData || [];
        }
      }

      console.log('Workshops data received:', workshops);

      // Paso 4: Combinar los datos
      const formattedUsers: User[] = profiles?.map((profile: any) => {
        console.log('Processing profile:', profile);
        
        // Buscar rol del usuario
        const userRole = userRoles?.find(ur => ur.user_id === profile.id);
        const roleName = userRole?.roles?.name || 'Sin Rol';
        
        // Buscar información del taller
        const workshopId = userRole?.workshop_id;
        const workshop = workshops.find(w => w.id === workshopId);
        const workshopName = workshop?.name;
        
        console.log('User role info:', { userRole, roleName, workshop, workshopId, workshopName });
        
        return {
          id: profile.id,
          name: profile.name || profile.email,
          email: profile.email,
          role: roleName,
          workshopId: workshopId,
          workshopName: workshopName,
          status: 'active' as const, // Por defecto activo
          requiresPasswordChange: false, // TODO: Implementar lógica real
          createdAt: profile.created_at,
          lastLogin: undefined, // TODO: Implementar seguimiento de último login
          createdBy: 'system' // TODO: Implementar tracking de quién creó el usuario
        };
      }) || [];

      console.log('Formatted users:', formattedUsers);
      setUsers(formattedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
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
      console.log('Creando usuario:', userData);

      // Llamar a la Edge Function para crear el usuario
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: userData
      });

      if (error) {
        console.error('Error en Edge Function:', error);
        throw new Error(error.message || 'Error al crear usuario');
      }

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido al crear usuario');
      }

      await fetchUsers();
      
      toast({
        title: "Usuario creado exitosamente",
        description: `Usuario ${userData.email} creado. Contraseña temporal: ${data.tempPassword}`,
      });

      return { success: true, tempPassword: data.tempPassword };
    } catch (err: any) {
      console.error('Error creating user:', err);
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
      if (updates.name || updates.email) {
        await supabase
          .from('profiles')
          .update({
            name: updates.name,
            email: updates.email
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
                workshop_id: updates.workshopId || null
              })
              .eq('user_id', userId);
          } else {
            // Crear nuevo rol para el usuario
            await supabase
              .from('user_roles')
              .insert({
                user_id: userId,
                role_id: role.id,
                workshop_id: updates.workshopId || null
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
      console.error('Error updating user:', err);
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
      console.error('Error deleting user:', err);
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
  }, []);

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
