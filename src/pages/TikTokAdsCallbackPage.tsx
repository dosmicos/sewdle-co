import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const TikTokAdsCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando autenticación con TikTok Ads...');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    // TikTok Marketing API redirige con `auth_code` (no `code`) y `state`
    const code = searchParams.get('auth_code') || searchParams.get('code');
    const state = searchParams.get('state'); // organizationId
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setMessage(errorDescription || 'El usuario canceló la autorización de TikTok Ads');
      setTimeout(() => navigateBack(), 3000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Faltan parámetros de autenticación (auth_code o state)');
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

      const { data, error } = await supabase.functions.invoke('tiktok-ads-oauth', {
        body: {
          action: 'exchange_token',
          code,
          organizationId,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Error al intercambiar token');
      }

      sessionStorage.setItem(
        'tiktok_ads_oauth_result',
        JSON.stringify({
          accessToken: data.accessToken,
          tokenExpiresAt: data.tokenExpiresAt,
          accounts: data.accounts,
          organizationId,
        })
      );

      setStatus('success');
      setMessage('Autenticación exitosa. Redirigiendo...');

      setTimeout(() => navigateBack(), 1500);
    } catch (error: any) {
      console.error('TikTok Ads OAuth exchange error:', error);
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
            <Loader2 className="h-12 w-12 text-black animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Conectando TikTok Ads
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

export default TikTokAdsCallbackPage;
