import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  name?: string;
  workshopId?: string;
  requiresPasswordChange?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAdmin: () => boolean;
  isDesigner: () => boolean;
  isQCLeader: () => boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  markPasswordChanged: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const createUserProfile = useCallback(async (session: Session): Promise<UserProfile> => {
    console.log('Creating user profile for:', session.user.id);
    
    let requiresPasswordChange = false;
    let profile = null;
    
    try {
      // Intentar obtener perfil de la BD
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        // Solo loguear errores inesperados (42501 es permiso denegado durante setup inicial)
        if (profileError.code === '42501') {
          console.info('Profile access denied - using metadata fallback');
        } else if (profileError.code !== 'PGRST116') {
          console.warn('Error fetching profile from DB:', profileError);
        }
        // Fallback: leer desde user_metadata
        requiresPasswordChange = session.user.user_metadata?.requires_password_change || false;
        console.log('Using user_metadata for requiresPasswordChange:', requiresPasswordChange);
      } else {
        profile = profileData;
        requiresPasswordChange = profile?.requires_password_change || false;
        console.log('Using profile DB for requiresPasswordChange:', requiresPasswordChange);
      }

      // Si no existe perfil, crearlo
      if (!profile) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email,
            requires_password_change: session.user.user_metadata?.requires_password_change || false
          });

        if (insertError) {
          // Solo loguear si no es error de permisos durante setup
          if (insertError.code !== '42501') {
            console.error('Error creating profile:', insertError);
          }
        }
      }

      // Obtener información del rol usando la nueva función
      const { data: roleInfo, error: roleError } = await supabase
        .rpc('get_user_role_info', { user_uuid: session.user.id });

      if (roleError) {
        console.error('Error fetching user role:', roleError);
      }

      let role = 'Administrador';
      let workshopId = undefined;

      if (roleInfo && roleInfo.length > 0) {
        role = roleInfo[0].role_name;
        workshopId = roleInfo[0].workshop_id;
        
        console.log('🔍 DEBUG AuthContext - Rol cargado:', { role, workshopId });
      } else {
        // Si no tiene rol, asignar admin por defecto
        console.log('Assigning admin role to user:', session.user.id);
        const { data: adminRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'Administrador')
          .single();

        if (adminRole) {
          // Get current organization
          const { data: orgData } = await supabase
            .from('organization_users')
            .select('organization_id')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .single();

          const { error: roleInsertError } = await supabase
            .from('user_roles')
            .insert({
              user_id: session.user.id,
              role_id: adminRole.id,
              organization_id: orgData?.organization_id
            });

          if (!roleInsertError) {
            role = 'Administrador';
          }
        }
      }

      return {
        id: session.user.id,
        email: session.user.email || '',
        role,
        name: profile?.name || session.user.user_metadata?.name || session.user.email,
        workshopId,
        requiresPasswordChange
      };
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      // Fallback profile con user_metadata
      return {
        id: session.user.id,
        email: session.user.email || '',
        role: 'Administrador',
        name: session.user.user_metadata?.name || session.user.email,
        requiresPasswordChange: session.user.user_metadata?.requires_password_change || false
      };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user) {
      throw new Error('No user authenticated');
    }

    try {
      // Verificar contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Cambiar contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente",
      });
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }, [user, toast]);

  const markPasswordChanged = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('mark_password_changed', {
        user_uuid: user.id
      });

      if (error) {
        console.error('Error marking password as changed:', error);
        throw error;
      }

      // Actualizar el estado local
      setUser(prev => prev ? { ...prev, requiresPasswordChange: false } : null);
    } catch (error) {
      console.error('Error in markPasswordChanged:', error);
      throw error;
    }
  }, [user]);

  const isAdmin = useCallback((): boolean => {
    return user?.role === 'Administrador';
  }, [user]);

  const isDesigner = useCallback((): boolean => {
    return user?.role === 'Diseñador';
  }, [user]);

  const isQCLeader = useCallback((): boolean => {
    return user?.role === 'Líder QC';
  }, [user]);

  const handleAuthStateChange = useCallback(async (event: string, session: Session | null) => {
    console.log('Auth state changed:', event, session?.user?.id);
    setSession(session);
    
    if (session?.user) {
      try {
        const userProfile = await createUserProfile(session);
        setUser(userProfile);
        console.log('User profile set:', userProfile);
      } catch (error) {
        console.error('Error creating user profile:', error);
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          role: 'Administrador',
          name: session.user.email,
          requiresPasswordChange: false
        });
      }
    } else {
      setUser(null);
    }
    
    setLoading(false);
  }, [createUserProfile]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setTimeout(() => {
          if (mounted) {
            handleAuthStateChange(event, session);
          }
        }, 0);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) {
        setTimeout(() => {
          if (mounted) {
            handleAuthStateChange('SIGNED_IN', session);
          }
        }, 0);
      } else if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      console.log('Attempting login with:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        console.error('Login error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido ${data.user.email}`,
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      
      setUser(null);
      setSession(null);
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [toast]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      login, 
      logout, 
      loading, 
      isAdmin,
      isDesigner,
      isQCLeader,
      changePassword,
      markPasswordChanged
    }}>
      {children}
    </AuthContext.Provider>
  );
};
