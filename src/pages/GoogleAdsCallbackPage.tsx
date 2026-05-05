import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * This page handles the Google Ads OAuth callback.
 * After Google redirects back with ?code=XXX&state=ORG_ID,
 * it exchanges the code for tokens via the google-ads-oauth edge function,
 * stores the result in sessionStorage, and redirects to the finance dashboard.
 */
const GoogleAdsCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando autenticación con Google Ads...');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state'); // organizationId
    const errorParam = searchParams.get('error');

    // Handle user denied access
    if (errorParam) {
      setStatus('error');
      setMessage(
        errorParam === 'access_denied'
          ? 'El usuario canceló la autorización de Google Ads'
          : `Error de autenticación: ${errorParam}`
      );
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
    const hostname = window.location.hostname;
    const isGrowthSubdomain =
      hostname === 'finance.sewdle.co' || hostname === 'growth.sewdle.co' ||
      hostname.startsWith('finance.') || hostname.startsWith('growth.');

    navigate(isGrowthSubdomain ? '/' : '/finance-dashboard', { replace: true });
  };

  const exchangeToken = async (code: string, organizationId: string) => {
    try {
      setMessage('Intercambiando código por token...');

      const redirectUri = `${window.location.origin}/google-ads-callback`;

      // Use fetch directly instead of supabase.functions.invoke
      // because invoke() swallows error details on non-2xx responses
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-ads-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: 'exchange_token',
          code,
          redirectUri,
          organizationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error || `HTTP ${res.status}`;
        const details = data?.details || '';
        throw new Error(details ? `${errorMsg}: ${details}` : errorMsg);
      }

      if (!data.success) {
        throw new Error(data.error ? `${data.error}: ${data.details || ''}` : 'Error al intercambiar token');
      }

      // Store tokens + accounts in sessionStorage for the modal to pick up
      sessionStorage.setItem(
        'google_ads_oauth_result',
        JSON.stringify({
          refreshToken: data.refreshToken,
          accessToken: data.accessToken,
          accounts: data.accounts,
          organizationId,
        })
      );

      setStatus('success');
      setMessage('Autenticación exitosa. Redirigiendo...');

      setTimeout(() => navigateBack(), 1500);
    } catch (error: any) {
      console.error('Google Ads OAuth exchange error:', error);
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
              Conectando Google Ads
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

export default GoogleAdsCallbackPage;
