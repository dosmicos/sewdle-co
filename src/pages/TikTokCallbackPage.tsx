import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const TikTokCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando autenticación con TikTok...');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state'); // organizationId
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setMessage(errorDescription || 'El usuario canceló la autorización de TikTok');
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

    navigate(isGrowthSubdomain ? '/social-analytics' : '/social-analytics', { replace: true });
  };

  const exchangeToken = async (code: string, organizationId: string) => {
    try {
      setMessage('Intercambiando código por token...');

      const redirectUri = `${window.location.origin}/tiktok-callback`;

      const { data, error } = await supabase.functions.invoke('tiktok-oauth', {
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

      sessionStorage.setItem(
        'tiktok_oauth_result',
        JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiresAt: data.tokenExpiresAt,
          tiktokUserId: data.tiktokUserId,
          displayName: data.displayName,
          organizationId,
        })
      );

      setStatus('success');
      setMessage('Autenticación exitosa. Redirigiendo...');

      setTimeout(() => navigateBack(), 1500);
    } catch (error: any) {
      console.error('TikTok OAuth exchange error:', error);
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
              Conectando TikTok
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
            <p className="text-xs text-gray-400 mt-2">Redirigiendo...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default TikTokCallbackPage;
