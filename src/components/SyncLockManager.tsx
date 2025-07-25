import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Unlock, RefreshCw } from 'lucide-react';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SyncLockManagerProps {
  deliveryId: string;
  isLocked?: boolean;
  lockAgeMinutes?: number;
  onLockCleared?: () => void;
  onAutoRetry?: () => void;
}

export const SyncLockManager = ({ 
  deliveryId, 
  isLocked = false, 
  lockAgeMinutes = 0,
  onLockCleared,
  onAutoRetry 
}: SyncLockManagerProps) => {
  const [isClearing, setIsClearing] = useState(false);
  const [hasAutoCleared, setHasAutoCleared] = useState(false);
  const { clearSyncLock, clearAllStaleLocks } = useInventorySync();
  const { toast } = useToast();

  // Auto-clear logic based on lock age
  useEffect(() => {
    if (!isLocked || hasAutoCleared) return;

    const autoHandleLock = async () => {
      try {
        // Auto-clear locks under 2 minutes silently
        if (lockAgeMinutes < 2) {
          console.log(`Auto-clearing lock for delivery ${deliveryId} (${lockAgeMinutes} minutes old)`);
          await clearSyncLock(deliveryId);
          setHasAutoCleared(true);
          onLockCleared?.();
          
          // Auto-retry after clearing
          if (onAutoRetry) {
            setTimeout(() => {
              onAutoRetry();
            }, 1000);
          }
          return;
        }

        // Show toast for locks 2-5 minutes and auto-clear
        if (lockAgeMinutes >= 2 && lockAgeMinutes <= 5) {
          toast({
            title: "Limpiando bloqueo automáticamente",
            description: `Detectado bloqueo de ${lockAgeMinutes} minutos. Limpiando y reintentando...`,
          });
          
          await clearSyncLock(deliveryId);
          setHasAutoCleared(true);
          onLockCleared?.();
          
          // Auto-retry after clearing
          if (onAutoRetry) {
            setTimeout(() => {
              onAutoRetry();
            }, 1000);
          }
          
          toast({
            title: "Bloqueo limpiado",
            description: "Se limpió el bloqueo automáticamente y se reinició la sincronización.",
          });
          return;
        }

        // For locks > 5 minutes, show the full card (current behavior)
        
      } catch (error) {
        console.error('Error in auto-clearing lock:', error);
        toast({
          title: "Error al limpiar bloqueo",
          description: "No se pudo limpiar el bloqueo automáticamente. Use el botón manual.",
          variant: "destructive",
        });
      }
    };

    // Only auto-handle if we haven't done it already
    autoHandleLock();
  }, [isLocked, lockAgeMinutes, deliveryId, hasAutoCleared, clearSyncLock, onLockCleared, onAutoRetry, toast]);

  const handleClearLock = async () => {
    setIsClearing(true);
    try {
      await clearSyncLock(deliveryId);
      onLockCleared?.();
      toast({
        title: "Bloqueo limpiado",
        description: "Se limpió el bloqueo manualmente.",
      });
    } catch (error) {
      console.error('Error clearing lock:', error);
      toast({
        title: "Error",
        description: "No se pudo limpiar el bloqueo.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllStaleLocks = async () => {
    setIsClearing(true);
    try {
      await clearAllStaleLocks();
      onLockCleared?.();
      toast({
        title: "Bloqueos limpiados",
        description: "Se limpiaron todos los bloqueos antiguos.",
      });
    } catch (error) {
      console.error('Error clearing stale locks:', error);
      toast({
        title: "Error",
        description: "No se pudieron limpiar todos los bloqueos.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Only show the intrusive card for locks older than 5 minutes
  if (!isLocked || lockAgeMinutes < 5) {
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