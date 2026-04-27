import { useEffect, useRef } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface SessionTimeoutModalProps {
  remainingMs: number;
  onExtend: () => void;
}

export function SessionTimeoutModal({ remainingMs, onExtend }: SessionTimeoutModalProps) {
  const { signOut } = useAuthStore();
  const extendButtonRef = useRef<HTMLButtonElement>(null);

  const minutes = Math.floor(Math.max(0, remainingMs) / 60_000);
  const seconds = Math.floor((Math.max(0, remainingMs) % 60_000) / 1_000);
  const isUrgent = remainingMs < 30_000;

  // Focus trap : focus le bouton "Prolonger" à l'ouverture
  useEffect(() => {
    extendButtonRef.current?.focus();
  }, []);

  // Intercepter Escape → prolonger la session
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExtend();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onExtend]);

  const handleLogout = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
        {/* Icône */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isUrgent ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <Clock className={`w-8 h-8 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
          </div>
        </div>

        {/* Titre */}
        <h2
          id="session-timeout-title"
          className="text-xl font-semibold text-gray-900 text-center"
        >
          Session bientôt expirée
        </h2>

        {/* Description */}
        <p
          id="session-timeout-desc"
          className="text-sm text-gray-500 text-center mt-2"
        >
          Votre session expirera en raison d'inactivité.
        </p>

        {/* Countdown */}
        <div className={`text-center mt-4 py-3 rounded-lg ${
          isUrgent ? 'bg-red-50' : 'bg-amber-50'
        }`}>
          <span className={`text-3xl font-mono font-bold tabular-nums ${
            isUrgent ? 'text-red-600' : 'text-amber-600'
          }`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        {/* Boutons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleLogout}
            className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
          <button
            ref={extendButtonRef}
            onClick={onExtend}
            className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Prolonger
          </button>
        </div>
      </div>
    </div>
  );
}
