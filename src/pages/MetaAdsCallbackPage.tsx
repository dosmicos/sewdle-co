import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * This page handles the Meta OAuth callback.
 * After Facebook redirects back with ?code=XXX&state=ORG_ID,
 * it exchanges the code for a token via the meta-ads-oauth edge function,
 * stores the result in sessionStorage, and redirects to the finance dashboard.
 */
const MetaAdsCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando autenticación con Meta...');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state'); // organizationId
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle user denied access
    if (errorParam) {
      setStatus('error');
      setMessage(errorDescription || 'El usuario canceló la autorización de Meta Ads');
      setTimeout(() => navigateBack(), 3000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Faltan parámetros de autenticación (code o state)');
      setTimeout(() => navigateBack(), 3000);
      return;
    }

    exchangeToken(code, state);
  }, [searchParams]);

  const navigateBack = () => {
    const isFinanceSubdomain =
      window.location.hostname === 'finance.sewdle.co' ||
      window.location.hostname.startsWith('finance.');

    navigate(isFinanceSubdomain ? '/' : '/finance-dashboard', { replace: true });
  };

  const exchangeToken = async (code: string, organizationId: string) => {
    try {
      setMessage('Intercambiando código por token...');

      // Build the redirect URI (must match what was sent to Facebook)
      const redirectUri = `${window.location.origin}/meta-callback`;

      const { data, error } = await supabase.functions.invoke('meta-ads-oauth', {
        body: {
          action: 'exchange_token',
          code,
          redirectUri,
          organizationId,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Error al intercambiar token');
      }

      // Store token + accounts in sessionStorage for the modal to pick up
      sessionStorage.setItem(
        'meta_oauth_result',
        JSON.stringify({
          accessToken: data.accessToken,
          tokenExpiresAt: data.tokenExpiresAt,
          accounts: data.accounts,
          organizationId,
        })
      );

      setStatus('success');
      setMessage('Autenticación exitosa. Redirigiendo...');

      // Redirect back to dashboard (the modal will auto-open to select account)
      setTimeout(() => navigateBack(), 1500);
    } catch (error: any) {
      console.error('Meta OAuth exchange error:', error);
      setStatus('error');
      setMessage(error.message || 'Error al procesar la autenticación');
      setTimeout(() => navigateBack(), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Conectando Meta Ads
            </h2>
            <p className="text-sm text-gray-500">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Conexión exitosa!
            </h2>
            <p className="text-sm text-gray-500">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Error de conexión
            </h2>
            <p className="text-sm text-gray-500">{message}</p>
            <p className="text-xs text-gray-400 mt-2">Redirigiendo al dashboard...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default MetaAdsCallbackPage;
