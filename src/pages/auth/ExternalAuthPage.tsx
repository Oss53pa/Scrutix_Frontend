import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

type Status = 'loading' | 'error';

export default function ExternalAuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage("Aucun token fourni dans l'URL.");
      return;
    }
    // Strip token from URL immediately to prevent leaks in history/logs
    window.history.replaceState({}, '', window.location.pathname);
    exchangeToken(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function exchangeToken(token: string) {
    try {
      setStatus('loading');
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase non configuré');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/atlas-sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur de validation du token');

      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });
      if (otpError) throw new Error(otpError.message);

      await initialize();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('External auth error:', message);
      setStatus('error');
      setErrorMessage(message);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ maxWidth: 400, width: '100%', padding: 24, textAlign: 'center' }}>
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 40, border: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#818cf8', marginBottom: 8 }}>AtlasBanx</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>Audit Bancaire Intelligent</p>

          {status === 'loading' && (
            <div>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(129,140,248,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#64748b', fontSize: 12 }}>Validation de votre session Atlas Studio</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {status === 'error' && (
            <div>
              <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Connexion impossible</p>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>{errorMessage}</p>
              <a href="https://atlas-studio.org/portal" style={{ display: 'inline-block', background: '#818cf8', color: '#fff', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 500, fontSize: 13 }}>
                Retour a Atlas Studio
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
