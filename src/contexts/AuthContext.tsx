import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const isProcessingAuth = useRef(false);

  const createUserProfile = useCallback(async (session: Session): Promise<UserProfile> => {
    let requiresPasswordChange = session.user.user_metadata?.requires_password_change || false;
    let profileName = session.user.user_metadata?.name || session.user.email;
    
    try {
      // Obtener información del rol usando RPC (esto funciona con RLS)
      const { data: roleInfo } = await supabase
        .rpc('get_user_role_info', { user_uuid: session.user.id });

      let role = 'Administrador';
      let workshopId = undefined;

      if (roleInfo && roleInfo.length > 0) {
        role = roleInfo[0].role_name;
        workshopId = roleInfo[0].workshop_id;
      }

      return {
        id: session.user.id,
        email: session.user.email || '',
        role,
        name: profileName,
        workshopId,
        requiresPasswordChange
      };
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      return {
        id: session.user.id,
        email: session.user.email || '',
        role: 'Administrador',
        name: profileName,
        requiresPasswordChange
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
      // 1. Actualizar user_metadata en Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: { requires_password_change: false }
      });

      if (authError) {
        console.error('Error updating user metadata:', authError);
        throw authError;
      }

      // 2. Actualizar tabla profiles (mantener sincronizado)
      const { error: rpcError } = await supabase.rpc('mark_password_changed', {
        user_uuid: user.id
      });

      if (rpcError) {
        console.error('Error marking password as changed:', rpcError);
        throw rpcError;
      }

      // 3. Actualizar el estado local
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

  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    // TOKEN_REFRESHED: Solo actualizar sesión, NO re-crear perfil
    if (event === 'TOKEN_REFRESHED') {
      setSession(newSession);
      return;
    }
    
    // SIGNED_OUT: Limpiar todo
    if (event === 'SIGNED_OUT' || !newSession?.user) {
      setSession(null);
      setUser(null);
      isProcessingAuth.current = false;
      setLoading(false);
      return;
    }
    
    // CRÍTICO: Verificar que el access_token esté presente
    if (!newSession.access_token) {
      return;
    }
    
    // Actualizar sesión siempre
    setSession(newSession);
    
    // Si ya estamos procesando o ya tenemos usuario para este session ID, skip
    if (isProcessingAuth.current) {
      return;
    }
    
    // Procesar solo si es INITIAL_SESSION o SIGNED_IN sin usuario actual
    isProcessingAuth.current = true;
    try {
      const userProfile = await createUserProfile(newSession);
      setUser(userProfile);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setUser({
        id: newSession.user.id,
        email: newSession.user.email || '',
        role: 'Administrador',
        name: newSession.user.email,
        requiresPasswordChange: false
      });
    } finally {
      setLoading(false);
      // Mantener isProcessingAuth true para evitar re-procesamiento
      // Solo resetear en SIGNED_OUT
    }
  }, [createUserProfile]);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange ya dispara INITIAL_SESSION con la sesión almacenada
    // NO necesitamos llamar getSession() manualmente - eso causa duplicados
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      // setTimeout(0) evita deadlocks con Supabase según docs
      setTimeout(() => {
        if (mounted) {
          handleAuthStateChange(event, session);
        }
      }, 0);
    });

    // Timeout de seguridad: si no hay sesión después de 2s, marcar como no-loading
    const timeoutId = setTimeout(() => {
      setLoading(prev => {
        // Solo cambiar si aún está loading (no hubo sesión)
        return prev ? false : prev;
      });
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
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
