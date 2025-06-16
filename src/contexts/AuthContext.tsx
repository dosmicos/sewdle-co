
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'workshop';
  name?: string;
  workshopId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
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
    
    try {
      // Verificar si el usuario ya tiene un perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      // Si no existe perfil, crearlo
      if (!profile) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email,
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
        }
      }

      // Verificar si el usuario ya tiene rol
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching user role:', roleError);
      }

      let role = userRole?.role || 'admin';

      // Si no tiene rol, asignar admin por defecto
      if (!userRole) {
        console.log('Assigning admin role to user:', session.user.id);
        const { error: roleInsertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: session.user.id,
            role: 'admin'
          });

        if (roleInsertError) {
          console.error('Error assigning role:', roleInsertError);
          role = 'admin'; // Fallback
        } else {
          role = 'admin';
        }
      }

      return {
        id: session.user.id,
        email: session.user.email || '',
        role: role as 'admin' | 'workshop',
        name: profile?.name || session.user.user_metadata?.name || session.user.email,
      };
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      // Fallback profile
      return {
        id: session.user.id,
        email: session.user.email || '',
        role: 'admin',
        name: session.user.user_metadata?.name || session.user.email,
      };
    }
  }, []);

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
          role: 'admin',
          name: session.user.email,
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
    <AuthContext.Provider value={{ user, session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
