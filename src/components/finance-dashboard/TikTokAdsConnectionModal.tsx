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
import { useTikTokAdsConnection } from '@/hooks/useTikTokAdsConnection';
import { toast } from 'sonner';

interface TikTokAdsConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface TikTokAdvertiserOption {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
  company?: string;
}

interface OAuthResult {
  accessToken: string;
  tokenExpiresAt: string | null;
  accounts: TikTokAdvertiserOption[];
  organizationId: string;
}

const TikTokIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.55a4.85 4.85 0 0 1-1.84-.13z"
      fill="#000"
    />
  </svg>
);

const TikTokAdsConnectionModal: React.FC<TikTokAdsConnectionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { currentOrganization } = useOrganization();
  const { isConnected, account, disconnect, refreshConnection } =
    useTikTokAdsConnection();

  const [step, setStep] = useState<'connect' | 'select' | 'connected'>('connect');
  const [loading, setLoading] = useState(false);
  const [oauthResult, setOauthResult] = useState<OAuthResult | null>(null);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (isConnected) {
      setStep('connected');
      return;
    }

    const storedResult = sessionStorage.getItem('tiktok_ads_oauth_result');
    if (storedResult) {
      try {
        const result: OAuthResult = JSON.parse(storedResult);
        setOauthResult(result);
        setStep('select');
        sessionStorage.removeItem('tiktok_ads_oauth_result');
      } catch {
        sessionStorage.removeItem('tiktok_ads_oauth_result');
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
      const { data, error } = await supabase.functions.invoke('tiktok-ads-oauth', {
        body: { action: 'get_client_key' },
      });

      if (error) throw error;

      if (!data.clientKey) {
        toast.error('TIKTOK_ADS_CLIENT_KEY no está configurado en el servidor');
        return;
      }

      const redirectUri = `${window.location.origin}/tiktok-ads-callback`;
      const state = currentOrganization.id;

      const authUrl =
        `https://business-api.tiktok.com/portal/auth` +
        `?app_id=${data.clientKey}` +
        `&state=${encodeURIComponent(state)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;

      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Error starting TikTok Ads OAuth:', error);
      toast.error('Error al iniciar la conexión con TikTok Ads');
      setLoading(false);
    }
  }, [currentOrganization]);

  const saveAccount = useCallback(async () => {
    if (!oauthResult || !selectedAdvertiser || !currentOrganization) return;

    setSaving(true);

    try {
      const selected = oauthResult.accounts.find(
        (a) => a.id === selectedAdvertiser
      );

      const { data, error } = await supabase.functions.invoke('tiktok-ads-oauth', {
        body: {
          action: 'save_account',
          organizationId: currentOrganization.id,
          accessToken: oauthResult.accessToken,
          selectedAdvertiserId: selectedAdvertiser,
          selectedAdvertiserName:
            selected?.name || `TikTok Ads ${selectedAdvertiser}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Cuenta de TikTok Ads conectada exitosamente');
        refreshConnection();
        setStep('connected');
        onSuccess?.();
      } else {
        throw new Error(data.error || 'Error al guardar la cuenta');
      }
    } catch (error: any) {
      console.error('Error saving TikTok advertiser:', error);
      toast.error(error.message || 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  }, [oauthResult, selectedAdvertiser, currentOrganization, refreshConnection, onSuccess]);

  const handleDisconnect = async () => {
    await disconnect();
    setStep('connect');
    setOauthResult(null);
    setSelectedAdvertiser(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TikTokIcon />
            Conectar TikTok Ads
          </DialogTitle>
          <DialogDescription>
            Conecta tu cuenta de TikTok Ads (Marketing API) para ver métricas reales y
            desglose por creativo en el dashboard.
          </DialogDescription>
        </DialogHeader>

        {step === 'connect' && (
          <div className="space-y-4 pt-2">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">¿Qué necesitas?</p>
              <ul className="text-sm text-gray-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Una cuenta de TikTok Business con acceso a un advertiser
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Permisos de administrador o anunciante en la cuenta de ads
                </li>
              </ul>
            </div>

            <div className="text-sm text-gray-500 space-y-2">
              <p>
                Al hacer clic en "Conectar", serás redirigido a TikTok Business para
                autorizar acceso a tus métricas publicitarias.
              </p>
              <p className="text-xs text-gray-400">
                Solo solicitamos permisos de lectura de tus campañas, ads y métricas.
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

        {step === 'select' && oauthResult && (
          <div className="space-y-4 pt-2">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Autenticación exitosa. Selecciona el advertiser a conectar.
              </AlertDescription>
            </Alert>

            {oauthResult.accounts.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  No se encontraron advertisers autorizados. Verifica que tu Business
                  Center tenga acceso al advertiser y que hayas seleccionado al menos
                  uno durante el flujo de autorización.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setStep('connect')}
                  className="mt-4"
                >
                  Intentar de nuevo
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {oauthResult.accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedAdvertiser(acc.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                        selectedAdvertiser === acc.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-500">
                          ID: {acc.id} · {acc.currency} · {acc.timezone}
                        </p>
                      </div>
                      {selectedAdvertiser === acc.id && (
                        <CheckCircle className="h-5 w-5 text-black flex-shrink-0" />
                      )}
                      {acc.status && acc.status !== 'STATUS_ENABLE' && (
                        <Badge variant="secondary" className="text-xs">
                          {acc.status}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={saveAccount}
                  disabled={!selectedAdvertiser || saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Conectar advertiser seleccionado
                </Button>
              </>
            )}
          </div>
        )}

        {step === 'connected' && account && (
          <div className="space-y-4 pt-2">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="flex items-center justify-between">
                <span>TikTok Ads conectado</span>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Activo
                </Badge>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Advertiser</span>
                <span className="text-sm font-medium">{account.accountName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ID</span>
                <span className="text-sm font-mono text-gray-700">
                  {account.accountId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Última sync</span>
                <span className="text-sm text-gray-700">
                  {account.updatedAt
                    ? new Date(account.updatedAt).toLocaleString('es-CO')
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

export default TikTokAdsConnectionModal;
