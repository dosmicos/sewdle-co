import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Unlock, RefreshCw } from 'lucide-react';
import { useInventorySync } from '@/hooks/useInventorySync';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SyncLockManagerProps {
  deliveryId: string;
  isLocked?: boolean;
  lockAgeMinutes?: number;
  onLockCleared?: () => void;
}

export const SyncLockManager = ({ 
  deliveryId, 
  isLocked = false, 
  lockAgeMinutes = 0,
  onLockCleared 
}: SyncLockManagerProps) => {
  const [isClearing, setIsClearing] = useState(false);
  const { clearSyncLock, clearAllStaleLocks } = useInventorySync();

  const handleClearLock = async () => {
    setIsClearing(true);
    try {
      await clearSyncLock(deliveryId);
      onLockCleared?.();
    } catch (error) {
      console.error('Error clearing lock:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllStaleLocks = async () => {
    setIsClearing(true);
    try {
      await clearAllStaleLocks();
      onLockCleared?.();
    } catch (error) {
      console.error('Error clearing stale locks:', error);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isLocked) {
    return null;
  }

  return (
    <Card className="border-warning bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertCircle className="h-4 w-4" />
          Sincronización Bloqueada
        </CardTitle>
        <CardDescription>
          Esta entrega tiene un bloqueo de sincronización activo desde hace {lockAgeMinutes} minutos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription>
            Los bloqueos de sincronización previenen que múltiples procesos modifiquen el inventario al mismo tiempo.
            Si el proceso se interrumpió, puedes limpiar manualmente el bloqueo.
          </AlertDescription>
        </Alert>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLock}
            disabled={isClearing}
            className="flex items-center gap-2"
          >
            <Unlock className="h-4 w-4" />
            {isClearing ? 'Limpiando...' : 'Limpiar Bloqueo'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAllStaleLocks}
            disabled={isClearing}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {isClearing ? 'Limpiando...' : 'Limpiar Todos los Bloqueos Antiguos'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};