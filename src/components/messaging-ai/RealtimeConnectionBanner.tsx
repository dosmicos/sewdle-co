import React from 'react';
import { AlertCircle, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from '@/hooks/useMessagingRealtime';

interface RealtimeConnectionBannerProps {
  status: ConnectionStatus;
  onReconnect: () => void;
}

export const RealtimeConnectionBanner = ({ status, onReconnect }: RealtimeConnectionBannerProps) => {
  // Don't show anything when connected
  if (status === 'connected') return null;

  const config = {
    connecting: {
      icon: Loader2,
      text: 'Conectando...',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      iconClassName: 'animate-spin',
      showRetry: false,
    },
    reconnecting: {
      icon: Loader2,
      text: 'Reconectando...',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      iconClassName: 'animate-spin',
      showRetry: false,
    },
    disconnected: {
      icon: WifiOff,
      text: 'Conexión perdida. Los mensajes pueden no actualizarse en tiempo real.',
      className: 'bg-red-50 text-red-700 border-red-200',
      iconClassName: '',
      showRetry: true,
    },
  }[status];

  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2 text-sm border-b",
        config.className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.iconClassName)} />
        <span>{config.text}</span>
      </div>
      {config.showRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs hover:bg-red-100"
          onClick={onReconnect}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reintentar
        </Button>
      )}
    </div>
  );
};
