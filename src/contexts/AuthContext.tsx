
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'workshop';
  name?: string;
  workshopId?: string;
}

interface AuthContextType {
  user: User | null;
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

// Mock users for development
const mockUsers: Record<string, User> = {
  'admin@textilflow.com': {
    id: '1',
    email: 'admin@textilflow.com',
    role: 'admin',
    name: 'Administrador'
  },
  'taller1@ejemplo.com': {
    id: '2',
    email: 'taller1@ejemplo.com',
    role: 'workshop',
    name: 'Taller Principal',
    workshopId: '1'
  }
};

const mockPasswords: Record<string, string> = {
  'admin@textilflow.com': 'admin123456',
  'taller1@ejemplo.com': 'password123'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check for stored auth data
    const storedUser = localStorage.getItem('textilflow_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const normalizedEmail = email.toLowerCase();
    const expectedPassword = mockPasswords[normalizedEmail];
    
    if (!expectedPassword || password !== expectedPassword) {
      setLoading(false);
      throw new Error('Credenciales inválidas');
    }
    
    const userData = mockUsers[normalizedEmail];
    setUser(userData);
    localStorage.setItem('textilflow_user', JSON.stringify(userData));
    
    toast({
      title: "Inicio de sesión exitoso",
      description: `Bienvenido ${userData.name || userData.email}`,
    });
    
    setLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('textilflow_user');
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente",
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
