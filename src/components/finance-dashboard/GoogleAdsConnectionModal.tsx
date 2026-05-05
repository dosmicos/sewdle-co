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
import { useGoogleAdsConnection } from '@/hooks/useGoogleAdsConnection';
import { toast } from 'sonner';

interface GoogleAdsConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface GoogleAdAccountOption {
  id: string;
  name: string;
}

interface OAuthResult {
  refreshToken: string;
  accessToken: string;
  accounts: GoogleAdAccountOption[];
  organizationId: string;
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GoogleAdsConnectionModal: React.FC<GoogleAdsConnectionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { currentOrganization } = useOrganization();
  const { isConnected, account, disconnect, refreshConnection } =
    useGoogleAdsConnection();

  const [step, setStep] = useState<'connect' | 'select' | 'connected'>('connect');
  const [loading, setLoading] = useState(false);
  const [oauthResult, setOauthResult] = useState<OAuthResult | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // When modal opens, check for OAuth result in sessionStorage
  useEffect(() => {
    if (!open) return;

    if (isConnected) {
      setStep('connected');
      return;
    }

    const storedResult = sessionStorage.getItem('google_ads_oauth_result');
    if (storedResult) {
      try {
        const result: OAuthResult = JSON.parse(storedResult);
        setOauthResult(result);
        setStep('select');
        sessionStorage.removeItem('google_ads_oauth_result');
      } catch {
        sessionStorage.removeItem('google_ads_oauth_result');
      }
    } else {
      setStep('connect');
    }
  }, [open, isConnected]);

  // Start OAuth flow - redirect to Google
  const startOAuth = useCallback(async () => {
    if (!currentOrganization) {
      toast.error('No hay organización seleccionada');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('google-ads-oauth', {
        body: { action: 'get_client_id' },
      });

      if (error) throw error;

      if (!data.clientId) {
        toast.error('GOOGLE_ADS_CLIENT_ID no está configurado en el servidor');
        return;
      }

      const redirectUri = `${window.location.origin}/google-ads-callback`;
      const state = currentOrganization.id;
      const scope = 'https://www.googleapis.com/auth/adwords';

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${data.clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;

      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Error starting Google OAuth:', error);
      toast.error('Error al iniciar la conexión con Google Ads');
      setLoading(false);
    }
  }, [currentOrganization]);

  // Save selected ad account
  const saveAccount = useCallback(async () => {
    if (!oauthResult || !selectedAccount || !currentOrganization) return;

    setSaving(true);

    try {
      const selected = oauthResult.accounts.find((a) => a.id === selectedAccount);

      const { data, error } = await supabase.functions.invoke('google-ads-oauth', {
        body: {
          action: 'save_account',
          organizationId: currentOrganization.id,
          refreshToken: oauthResult.refreshToken,
          selectedAccountId: selectedAccount,
          selectedAccountName: selected?.name || `Google Ads ${selectedAccount}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Cuenta de Google Ads conectada exitosamente');
        refreshConnection();
        setStep('connected');
        onSuccess?.();
      } else {
        throw new Error(data.error || 'Error al guardar la cuenta');
      }
    } catch (error: any) {
      console.error('Error saving Google Ads account:', error);
      toast.error(error.message || 'Error al guardar la cuenta');
    } finally {
      setSaving(false);
    }
  }, [oauthResult, selectedAccount, currentOrganization, refreshConnection, onSuccess]);

  // Handle disconnect
  const handleDisconnect = async () => {
    await disconnect();
    setStep('connect');
    setOauthResult(null);
    setSelectedAccount(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GoogleIcon />
            Conectar Google Ads
          </DialogTitle>
          <DialogDescription>
            Conecta tu cuenta de Google Ads para ver métricas reales en el dashboard.
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step: Connect ───────────────────────────────────────────── */}
        {step === 'connect' && (
          <div className="space-y-4 pt-2">
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-900">¿Qué necesitas?</p>
              <ul className="text-sm text-blue-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Una cuenta de Google Ads activa
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Acceso de lectura a la cuenta publicitaria
                </li>
              </ul>
            </div>

            <div className="text-sm text-gray-500 space-y-2">
              <p>
                Al hacer clic en "Conectar", serás redirigido a Google para autorizar
                acceso a tus métricas publicitarias.
              </p>
              <p className="text-xs text-gray-400">
                Solo solicitamos permisos de lectura de tus campañas y métricas.
              </p>
            </div>

            <Button
              onClick={startOAuth}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span className="ml-2">Conectar con Google</span>
            </Button>
          </div>
        )}

        {/* ─── Step: Select Account ────────────────────────────────────── */}
        {step === 'select' && oauthResult && (
          <div className="space-y-4 pt-2">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Autenticación exitosa. Selecciona la cuenta publicitaria a conectar.
              </AlertDescription>
            </Alert>

            {oauthResult.accounts.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  No se encontraron cuentas de Google Ads. Verifica que tu cuenta de
                  Google tenga acceso a cuentas publicitarias.
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
                      onClick={() => setSelectedAccount(acc.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                        selectedAccount === acc.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-500">ID: {acc.id}</p>
                      </div>
                      {selectedAccount === acc.id && (
                        <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={saveAccount}
                  disabled={!selectedAccount || saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Conectar cuenta seleccionada
                </Button>
              </>
            )}
          </div>
        )}

        {/* ─── Step: Connected ─────────────────────────────────────────── */}
        {step === 'connected' && account && (
          <div className="space-y-4 pt-2">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="flex items-center justify-between">
                <span>Google Ads conectado</span>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Activo
                </Badge>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Cuenta</span>
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

export default GoogleAdsConnectionModal;
