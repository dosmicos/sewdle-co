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
  Radio,
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useMetaAdsConnection } from '@/hooks/useMetaAdsConnection';
import { toast } from 'sonner';

interface MetaAdsConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MetaAdAccountOption {
  id: string;
  fullId: string;
  name: string;
  status: number;
  currency: string;
  timezone: string;
}

interface OAuthResult {
  accessToken: string;
  tokenExpiresAt: string;
  accounts: MetaAdAccountOption[];
  organizationId: string;
}

const MetaAdsConnectionModal: React.FC<MetaAdsConnectionModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { currentOrganization } = useOrganization();
  const { isConnected, account, disconnect, refreshConnection } = useMetaAdsConnection();

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

    const storedResult = sessionStorage.getItem('meta_oauth_result');
    if (storedResult) {
      try {
        const result: OAuthResult = JSON.parse(storedResult);
        setOauthResult(result);
        setStep('select');
        sessionStorage.removeItem('meta_oauth_result');
      } catch {
        sessionStorage.removeItem('meta_oauth_result');
      }
    } else {
      setStep('connect');
    }
  }, [open, isConnected]);

  // Start OAuth flow - redirect to Facebook
  const startOAuth = useCallback(async () => {
    if (!currentOrganization) {
      toast.error('No hay organización seleccionada');
      return;
    }

    setLoading(true);

    try {
      // Get the Meta App ID from the server (safe to expose)
      const { data, error } = await supabase.functions.invoke('meta-ads-oauth', {
        body: { action: 'get_app_id' },
      });

      if (error) throw error;

      if (!data.appId) {
        toast.error('META_APP_ID no está configurado en el servidor');
        return;
      }

      const redirectUri = `${window.location.origin}/meta-callback`;
      const state = currentOrganization.id;
      const scopes = 'ads_read,ads_management,read_insights,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights';

      const authUrl =
        `https://www.facebook.com/v21.0/dialog/oauth` +
        `?client_id=${data.appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&response_type=code`;

      // Redirect to Facebook OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Error starting OAuth:', error);
      toast.error('Error al iniciar la conexión con Meta');
      setLoading(false);
    }
  }, [currentOrganization]);

  // Save selected ad account
  const saveAccount = useCallback(async () => {
    if (!oauthResult || !selectedAccount || !currentOrganization) return;

    setSaving(true);

    try {
      const selected = oauthResult.accounts.find((a) => a.id === selectedAccount);

      const { data, error } = await supabase.functions.invoke('meta-ads-oauth', {
        body: {
          action: 'save_account',
          organizationId: currentOrganization.id,
          accessToken: oauthResult.accessToken,
          selectedAccountId: selectedAccount,
          selectedAccountName: selected?.name || `Meta Ads ${selectedAccount}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Cuenta de Meta Ads conectada exitosamente');
        refreshConnection();
        setStep('connected');
        onSuccess?.();
      } else {
        throw new Error(data.error || 'Error al guardar la cuenta');
      }
    } catch (error: any) {
      console.error('Error saving ad account:', error);
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"
                fill="#1877F2"
              />
            </svg>
            Conectar Meta Ads
          </DialogTitle>
          <DialogDescription>
            Conecta tu cuenta de Meta (Facebook/Instagram) Ads para ver métricas reales en el
            dashboard.
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
                  Una cuenta de Meta Business con acceso a cuentas publicitarias
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  Permisos de administrador o anunciante en la cuenta de ads
                </li>
              </ul>
            </div>

            <div className="text-sm text-gray-500 space-y-2">
              <p>
                Al hacer clic en "Conectar", serás redirigido a Facebook para autorizar acceso
                a tus métricas publicitarias.
              </p>
              <p className="text-xs text-gray-400">
                Solo solicitamos permisos de lectura de tus campañas y métricas.
              </p>
            </div>

            <Button
              onClick={startOAuth}
              disabled={loading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Conectar con Meta
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
                  No se encontraron cuentas publicitarias. Verifica que tu cuenta de Meta
                  Business tenga acceso a cuentas de ads.
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
                        <p className="text-xs text-gray-500">
                          ID: {acc.id} · {acc.currency} · {acc.timezone}
                        </p>
                      </div>
                      {selectedAccount === acc.id && (
                        <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                      {acc.status !== 1 && (
                        <Badge variant="secondary" className="text-xs">
                          Inactiva
                        </Badge>
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
                <span>Meta Ads conectado</span>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Activo</Badge>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Cuenta</span>
                <span className="text-sm font-medium">{account.accountName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ID</span>
                <span className="text-sm font-mono text-gray-700">{account.accountId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Token expira</span>
                <span className="text-sm text-gray-700">
                  {account.tokenExpiresAt
                    ? new Date(account.tokenExpiresAt).toLocaleDateString('es-CO')
                    : '-'}
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

export default MetaAdsConnectionModal;
