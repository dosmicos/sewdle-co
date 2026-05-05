import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useTikTokConnection } from '@/hooks/useTikTokConnection';
import { toast } from 'sonner';

interface TikTokConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface OAuthResult {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  tiktokUserId: string;
  displayName: string;
  organizationId: string;
}

const TikTokLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.85 4.85 0 01-1-.15z"
      fill="#000000"
    />
  </svg>
);

const TikTokConnectionModal: React.FC<TikTokConnectionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { currentOrganization } = useOrganization();
  const { isConnected, connection, disconnect, refreshConnection } = useTikTokConnection();

  const [step, setStep] = useState<'connect' | 'confirming' | 'connected'>('connect');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [oauthResult, setOauthResult] = useState<OAuthResult | null>(null);

  useEffect(() => {
    if (!open) return;

    if (isConnected) {
      setStep('connected');
      return;
    }

    const storedResult = sessionStorage.getItem('tiktok_oauth_result');
    if (storedResult) {
      try {
        const result: OAuthResult = JSON.parse(storedResult);
        setOauthResult(result);
        setStep('confirming');
        sessionStorage.removeItem('tiktok_oauth_result');
      } catch {
        sessionStorage.removeItem('tiktok_oauth_result');
      }
    } else {
      setStep('connect');
    }
  }, [open, isConnected]);

  const startOAuth = useCallback(async () => {
    if (!currentOrganization) {
      toast.error('No hay organización seleccionada');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('tiktok-oauth', {
        body: { action: 'get_auth_url' },
      });

      if (error) throw error;

      if (!data.clientKey) {
        toast.error('TIKTOK_CLIENT_KEY no está configurado en el servidor');
        return;
      }

      const redirectUri = `${window.location.origin}/tiktok-callback`;
      const state = currentOrganization.id;
      const scope = 'user.info.basic,video.list,video.insights';

      const authUrl =
        `https://www.tiktok.com/v2/auth/authorize/` +
        `?client_key=${data.clientKey}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&state=${state}`;

      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Error starting TikTok OAuth:', error);
      toast.error('Error al iniciar la conexión con TikTok');
      setLoading(false);
    }
  }, [currentOrganization]);

  const confirmConnection = useCallback(async () => {
    if (!oauthResult || !currentOrganization) return;

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('tiktok-oauth', {
        body: {
          action: 'save_connection',
          organizationId: currentOrganization.id,
          accessToken: oauthResult.accessToken,
          refreshToken: oauthResult.refreshToken,
          tokenExpiresAt: oauthResult.tokenExpiresAt,
          tiktokUserId: oauthResult.tiktokUserId,
          displayName: oauthResult.displayName,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Cuenta de TikTok conectada exitosamente');
        refreshConnection();
        setStep('connected');
        onSuccess?.();
      } else {
        throw new Error(data.error || 'Error al guardar la conexión');
      }
    } catch (error: any) {
      console.error('Error saving TikTok connection:', error);
      toast.error(error.message || 'Error al guardar la conexión');
    } finally {
      setSaving(false);
    }
  }, [oauthResult, currentOrganization, refreshConnection, onSuccess]);

  const handleDisconnect = async () => {
    await disconnect();
    setStep('connect');
    setOauthResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TikTokLogo />
            Conectar TikTok
          </DialogTitle>
          <DialogDescription>
            Conecta tu cuenta de TikTok Business para analizar el rendimiento de tus videos.
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step: Connect ───────────────────────────────────────────── */}
        {step === 'connect' && (
          <div className="space-y-4 pt-2">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">¿Qué necesitas?</p>
              <ul className="text-sm text-gray-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Una cuenta de TikTok Business o Creator
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Al menos 1 video publicado en la cuenta
                </li>
              </ul>
            </div>

            <div className="text-sm text-gray-500 space-y-2">
              <p>
                Al hacer clic en "Conectar", serás redirigido a TikTok para autorizar acceso
                a tus videos y métricas.
              </p>
              <p className="text-xs text-gray-400">
                Solo solicitamos permisos de lectura de tus videos y estadísticas.
              </p>
            </div>

            <Button
              onClick={startOAuth}
              disabled={loading}
              className="w-full bg-black hover:bg-gray-800 text-white"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Conectar con TikTok
            </Button>
          </div>
        )}

        {/* ─── Step: Confirming ───────────────────────────────────────── */}
        {step === 'confirming' && oauthResult && (
          <div className="space-y-4 pt-2">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Autenticación exitosa. Confirma la conexión con tu cuenta de TikTok.
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Cuenta</span>
                <span className="text-sm font-medium">{oauthResult.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ID</span>
                <span className="text-sm font-mono text-gray-700">{oauthResult.tiktokUserId}</span>
              </div>
            </div>

            <Button
              onClick={confirmConnection}
              disabled={saving}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar conexión
            </Button>
          </div>
        )}

        {/* ─── Step: Connected ─────────────────────────────────────────── */}
        {step === 'connected' && connection && (
          <div className="space-y-4 pt-2">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="flex items-center justify-between">
                <span>TikTok conectado</span>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Activo</Badge>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Cuenta</span>
                <span className="text-sm font-medium">{connection.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ID</span>
                <span className="text-sm font-mono text-gray-700">{connection.tiktokUserId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Token expira</span>
                <span className="text-sm text-gray-700">
                  {connection.tokenExpiresAt
                    ? new Date(connection.tokenExpiresAt).toLocaleDateString('es-CO')
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Última sync</span>
                <span className="text-sm text-gray-700">
                  {connection.updatedAt
                    ? new Date(connection.updatedAt).toLocaleString('es-CO')
                    : '-'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                className="flex-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep('connect');
                  setOauthResult(null);
                }}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconectar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TikTokConnectionModal;
