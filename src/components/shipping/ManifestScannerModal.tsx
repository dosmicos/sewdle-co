import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useShippingManifests, ManifestWithItems, ManifestItem } from '@/hooks/useShippingManifests';
import { cn } from '@/lib/utils';

interface ManifestScannerModalProps {
  open: boolean;
  onClose: () => void;
  manifest: ManifestWithItems;
  onUpdate: () => void;
}

type ScanFeedback = {
  type: 'success' | 'warning' | 'error';
  message: string;
  trackingNumber: string;
};

export const ManifestScannerModal: React.FC<ManifestScannerModalProps> = ({
  open,
  onClose,
  manifest,
  onUpdate,
}) => {
  const { scanTrackingNumber, fetchManifestWithItems } = useShippingManifests();
  
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanHistory, setScanHistory] = useState<ScanFeedback[]>([]);
  const [items, setItems] = useState<ManifestItem[]>(manifest.items);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const successAudio = useRef<HTMLAudioElement | null>(null);
  const errorAudio = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    successAudio.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+fn5+fnp6enZubmZeVk5GPjoiCfXdxbGllY2JjZmpxe4aMlJmdn6GhoaKioaGgnpuYlI+LhYB6dG9qaGdoa22Ah5CXm5+hoqOko6OioaCempmVkIuGgHpzb2tpaGlrbXSDipKYnaCio6OjoqKhoJ6cmpmVkYyGgXx2cWxqaGlrbXOAh46Vm56goqOjo6KioaCenZqWko2IhIB6dXFsaWdnamxyfIWMk5idoKGio6OioqGgnpyamJSTj4uGgXx3c29saWlqbHB4gIaOlJmdoKGioqKioKGfnZuZl5STkIyIhIB7d3Jua2pqa25zeICGjpOYnaCho6OjoqKhoJ6cmpmXlJGNiYWBfXhzbm1rbG1wdX2DipGWm56goqOjo6KioaCenJqYlpOQjYmFgXx4c29tbGxucXZ9g4qRlpueoKKjo6OioqGgnp2bmJaUkY2JhYF9eHRwbmxtb3J3foWLkZabnqChoqOjoqKhn56cm5mXlJKPi4iEgH15dXJwb3Bydnx+hIqQlZqdoKGio6OioqGgnpybmZeTkY6KhoKAfHh1cnFwcXN3fIKHjZKXm56goqKjoqKhoJ+enJqYlpORjoqGg398eHVycHBxc3d8gYaLkJWZnaCho6OjoqKhoJ6cm5mXlZKPjImFgn56d3Rybm5vcnV6f4WKj5SYnJ+hoqOjoqKhoJ+enJqYlpSSj4uHhIB9end0cXBwcXR4fYKHjJGWmp2goKKjoqOioaCfnZuZl5WTkI2KhoOAfXp3dHJxcHJ0d3yAhYqPlJeanaCioqOioqGgoJ6cmpmXlZKPjImGg397eHVzcXBxc3Z6foOIjZGVmZyfoaKjoqKhoaCfnZuZmJaUko+Mi4eDf3x5dnRycHFzdnh8gYaKj5OXm56goaKjoqKhoaCenJuZl5WTkI2KhoOAfHl2dHJxcnR3e3+EiI2Rl5qdn6GioqOioaGgn52bmZeVk5CPjIqGg398eXZ0c3JydHd7f4OHjJCUmJueoKGio6KioaCfnZyamJaUkpCOi4eDgH15d3V0c3N0dnh8gISIjJCUl5qdoKGioqKioaCfnZyamJaUko+Ni4iEgX56eHZ0c3R1d3p9gYWJjZGVmJudn6GioqKioaCfnpyamJaVk5COjIqHhIB9enl3dXR0dXd5fICDh4uPlJeZnJ6goaKioqGhoJ6dnJqYlpSTkY+Mi4eDgH16eHZ1dHV2eHuAgYaKjpGVmJudoKGhoqKhoaCfnpyamJaVk5GPjYqHhIF+e3l4dnV1dXd5fH+DhouOkZWYmp2foKGioqGgoKCenZuZl5WTkY+NioeEgX57eXd2dXV2eHp9gIOGio2Qlpibm56goaKioaCgoJ6dnJqYlpSSkI6Mi4eDgX57eXd2dXZ3eXt+gYOHi46Rlpibm56foaGioaGgoJ6dnJqYl5WTkY+Ni4qHhIB+e3l4dnV2d3l7foGEiIuPlJeZnJ6foKGioaGgoJ+dnJqYl5WTkY+NioeEgX57enh2dXZ3eXx+gYSHi46SlZibnp+goaGhoaGgnp2cmpmXlZSSkI6LiYeFgn97enh2dXV2eHp8f4KFiIyPkpaZm52foKGhoaGgoJ+dnJqYl5WTkZCOjIqHhIJ/fHp4dnV1dnh6fX+ChYmMj5OWmZudn6ChoaGhoKCfnpyamJaVk5GPjYuJh4SBf3x6eHZ1dXZ4eny/gYSHio6RlZibnZ+goaGhoaGgn56cmpiXlZSSj42LiYaEgX98enh2dXZ2eHt9gIOFiYyPk5aYm52foKGhoaGgoJ+enJuZl5WUkpCOjIqIhYKAfXt5d3Z1dXd5e36Ag4aJjI+SlZibnZ+goKGhoKCgn56cm5mXlZSTkY+NjImHhIF+fHp4dXR1dnh6fYCDh4qMj5KVmJudnp+goaGhoKCfnpybmZeVlJKQjoqJh4WCgH16eHZ1dHV3eXuAgYWIi46QlJeam52foKCgoKCgoZ+enJqYl5WTkY6MioeEgX97eXd2dXV2eHp9gIOGiYyPkpWYm52fn6CgoKCgn5+dnJqYlpWTkY+MioeDgH56eHZ1dXV2eHp9gIOGiYyPlJaZm52en6CgoKCgn56dnJqYlpWTkY6LiYeCf3x6eHZ1dXV3eXyAgoWIi4+Sk5eZnJ6fn6CgoKCfnpybmpqXlZSTkI6MiYaDgH16eHZ1dHV2eHqAgIWHio2QkpWYm52en6CgoKCfnpybmpmXlZSTkI6MioeDgH56eHZ1dHV2eHp9gIOGiYyPlJaZm52en6CgoKCfnpybmpmXlZSTkI6MiYaDgH56eHZ1dHV2eHp9gIOGiYyPkpWYm52en6CgoKCfnpybmpmXlZSTkI6MioeDgH56eHZ1dXV2eHp9gIOGiYyPkpWYm52en6CgoKCfnpybmpmXlZSSj42LiYeDgH17eXd2dXZ2eHp9gIOGiYyPkpWYm52en6CgoKCfnpybmpmXlZSSj42LiYeDgH17eXd2dXZ2eHt9gIOGiYyPkpWYm52en6CgoKCfnpybmpmXlZSSj42LiYeDgH17eXd2dXZ2eHt9gIOGiYyPkpWYm52en6CgoKCfnpybmpmXlZSSj42LiYeDgH17eXd2dXZ2eHt9gIOGiYyOkJKTlQ==');
    errorAudio.current = new Audio('data:audio/wav;base64,UklGRigCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQCAAD+/wIA/v8CAP7/AgD+/wIA/v8EAPz/BgD6/wgA+P8KAPb/DAD0/w4A8v8QAPD/EgDu/xQA7P8WAOr/GADo/xoA5v8cAOT/HgDi/yAA4P8iAN7/JADc/yYA2v8oANj/KgDW/ywA1P8uANL/MADQPzIA0P8yAM7/NADM/zYAyv84AMj/OgDI/zoAxv88AMT/PgDC/0AAwP9CAMD/QgC+/0QAvP9GALr/SAC4/0oAtv9MALb/TAC0/04Asv9QALD/UgCu/1QArP9WAKz/VgCq/1gAqP9aAKb/XACk/14Aov9gAKL/YACg/2IAnv9kAJz/ZgCa/2gAmv9oAJj/agCW/2wAlP9uAJL/cACQ/3IAkP9yAI7/dACM/3YAiv94AIj/egCI/3oAhv98AIT/fgCC/4AAf/+CAID/ggB+/4QAfP+GAHr/iAB4/4oAdv+MAHb/jAB0/44Acv+QAHD/kgBu/5QAbP+WAGz/lgBq/5gAaP+aAGb/nABk/54AZP+eAGL/oABg/6IAXv+kAFz/pgBa/6gAWv+oAFj/qgBW/6wAVP+uAFL/sABQ/7IAUP+yAE7/tABM/7YATP+2AEr/uABI/7oARv+8AET/vgBE/74AQv/AAED/wgA+/8QAPP/GADz/xgA6/8gAOP/KADb/zAA0/84AMP/QADL/0AAw/9IAMf/SAD');
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Refresh items when manifest changes
  useEffect(() => {
    setItems(manifest.items);
  }, [manifest.items]);

  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    const audio = type === 'success' ? successAudio.current : errorAudio.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const handleScan = useCallback(async () => {
    const trackingNumber = scanInput.trim().toUpperCase();
    if (!trackingNumber || scanning) return;

    setScanning(true);
    setScanInput('');

    const result = await scanTrackingNumber(manifest.id, trackingNumber);

    const feedback: ScanFeedback = {
      type: result.success ? 'success' : result.status === 'already_scanned' ? 'warning' : 'error',
      message: result.message,
      trackingNumber,
    };

    setScanHistory(prev => [feedback, ...prev.slice(0, 49)]); // Keep last 50

    if (result.success) {
      playSound('success');
      // Update local items state
      setItems(prev => prev.map(item =>
        item.tracking_number === trackingNumber
          ? { ...item, scanned_at: new Date().toISOString(), scan_status: 'verified' }
          : item
      ));
    } else {
      playSound('error');
    }

    setScanning(false);
    inputRef.current?.focus();
  }, [scanInput, scanning, manifest.id, scanTrackingNumber, playSound]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  // Calculate stats
  const totalItems = items.length;
  const verifiedItems = items.filter(i => i.scan_status === 'verified').length;
  const pendingItems = items.filter(i => i.scan_status === 'pending').length;
  const progress = totalItems > 0 ? (verifiedItems / totalItems) * 100 : 0;

  const handleClose = () => {
    onUpdate();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Escanear Guías - {manifest.manifest_number}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso de verificación</span>
              <span className="font-medium">{verifiedItems} / {totalItems} ({Math.round(progress)}%)</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" /> {verifiedItems} verificados
              </span>
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertCircle className="h-4 w-4" /> {pendingItems} pendientes
              </span>
            </div>
          </div>

          {/* Scan input */}
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escanear o escribir número de guía..."
              className="pl-10 h-14 text-lg font-mono"
              autoFocus
              disabled={scanning}
            />
            {scanning && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />
            )}
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Scan history */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Historial de escaneos</h3>
              <ScrollArea className="h-64 border rounded-md">
                {scanHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <ScanLine className="h-8 w-8 mb-2" />
                    <p>Escanea una guía para comenzar</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {scanHistory.map((scan, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-md text-sm',
                          scan.type === 'success' && 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                          scan.type === 'warning' && 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
                          scan.type === 'error' && 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        )}
                      >
                        {scan.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        {scan.type === 'warning' && <AlertCircle className="h-4 w-4 shrink-0" />}
                        {scan.type === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{scan.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Pending items */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Guías pendientes ({pendingItems})</h3>
              <ScrollArea className="h-64 border rounded-md">
                {pendingItems === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-green-600 p-4">
                    <CheckCircle2 className="h-8 w-8 mb-2" />
                    <p>¡Todas las guías verificadas!</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {items
                      .filter(i => i.scan_status === 'pending')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
                        >
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm">{item.tracking_number}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              #{item.order_number} • {item.recipient_name}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
