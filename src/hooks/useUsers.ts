
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

      // Obtener usuarios de auth junto con sus perfiles y roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          created_at,
          user_roles!inner (
            workshop_id,
            roles!inner (
              name
            )
          )
        `);

      if (profilesError) {
        throw profilesError;
      }

      // Obtener talleres para mapear nombres
      const { data: workshops } = await supabase
        .from('workshops')
        .select('id, name');

      const workshopMap = workshops?.reduce((acc, workshop) => {
        acc[workshop.id] = workshop.name;
        return acc;
      }, {} as Record<string, string>) || {};

      // Transformar datos al formato esperado
      const formattedUsers: User[] = profiles?.map((profile: any) => ({
        id: profile.id,
        name: profile.name || profile.email,
        email: profile.email,
        role: profile.user_roles[0]?.roles?.name || 'Sin Rol',
        workshopId: profile.user_roles[0]?.workshop_id,
        workshopName: profile.user_roles[0]?.workshop_id 
          ? workshopMap[profile.user_roles[0].workshop_id] 
          : undefined,
        status: 'active' as const,
        requiresPasswordChange: false, // TODO: Implementar lógica real
        createdAt: profile.created_at,
        lastLogin: undefined, // TODO: Implementar seguimiento de último login
        createdBy: 'system' // TODO: Implementar tracking de quién creó el usuario
      })) || [];

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
      // Generar contraseña temporal
      const tempPassword = generatePassword();
      
      // Crear usuario en auth usando admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          requiresPasswordChange: userData.requiresPasswordChange
        }
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Actualizar perfil
        await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            name: userData.name,
            email: userData.email
          });

        // Obtener el ID del rol
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', userData.role)
          .single();

        if (role) {
          // Asignar rol al usuario
          await supabase
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role_id: role.id,
              workshop_id: userData.workshopId || null
            });
        }

        await fetchUsers();
        
        toast({
          title: "Usuario creado exitosamente",
          description: `Usuario ${userData.email} creado. Contraseña temporal: ${tempPassword}`,
        });

        return { success: true, tempPassword };
      }
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
      if (updates.role) {
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', updates.role)
          .single();

        if (role) {
          await supabase
            .from('user_roles')
            .update({
              role_id: role.id,
              workshop_id: updates.workshopId || null
            })
            .eq('user_id', userId);
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

      // Eliminar usuario de auth (requiere permisos de admin)
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) {
        throw error;
      }

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
        description: err.message || "Hubo un problema al eliminar el usuario",
        variant: "destructive",
      });
      return { success: false, error: err.message };
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
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
