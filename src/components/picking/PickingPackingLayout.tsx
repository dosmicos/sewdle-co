import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface PickingPackingLayoutProps {
  children: React.ReactNode;
}

export const PickingPackingLayout: React.FC<PickingPackingLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-primary">Sewdle</h1>
            <span className="text-lg font-semibold text-muted-foreground">/ Picking & Packing</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6">
        {children}
      </main>
    </div>
  );
};