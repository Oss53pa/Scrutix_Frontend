import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Mail, User, Building2, Briefcase, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { AccountType } from '../../lib/database.types';

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const {
    isLoading,
    error: authError,
    signInWithEmail,
    signUp,
    resetPassword,
    clearError,
  } = useAuthStore();

  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('enterprise');
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<'login' | 'register' | 'reset'>('login');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await signInWithEmail(email, password);
    if (success) {
      onSuccess();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await signUp(email, password, fullName, accountType);
    if (success) {
      setMessage('Vérifiez votre email pour confirmer votre compte.');
      setView('login');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await resetPassword(email);
    if (success) {
      setMessage('Un email de réinitialisation a été envoyé.');
      setView('login');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-ink-950">
      {/* Cinematic ambient layers */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-950 to-black" />
        <div className="absolute -top-40 -left-40 h-[700px] w-[700px] rounded-full bg-accent-700/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[700px] w-[700px] rounded-full bg-ink-700/40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-accent-500/8 blur-3xl animate-breathe" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-accent-400/60" />
            <span className="text-[10px] font-semibold text-accent-300 uppercase tracking-[0.22em]">
              Audit bancaire intelligent
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-accent-400/60" />
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-white tracking-tight leading-none">
            Atlas<span className="text-gradient-gold">Banx</span>
          </h1>
          <p className="font-serif italic text-lg text-white/60 mt-3">
            CEMAC <span className="mx-2">·</span> UEMOA
          </p>
        </div>

        {/* Glass card */}
        <div className="relative rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/10 overflow-hidden">
          {/* Top gold rule */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400 to-transparent" />

          <div className="p-8 sm:p-10">
            {/* Login View */}
            {view === 'login' && (
              <>
                <div className="text-center mb-7">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-canvas-200 to-canvas-300/60 border border-primary-200/60 mb-4 shadow-card">
                    <Lock className="w-5 h-5 text-ink-700" />
                  </div>
                  <h2 className="text-xl font-bold text-ink-900 tracking-tight">Connexion</h2>
                  <p className="text-ink-500 text-sm mt-1">Accédez à votre espace sécurisé</p>
                </div>

                {message && (
                  <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-3 py-2.5 rounded-lg mb-4">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{message}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="label">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className="input pl-10"
                        autoFocus
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="label">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        className="input pl-10 pr-12"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200/70 px-3 py-2.5 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!email || !password || isLoading}
                    className="btn btn-primary w-full py-3 text-sm tracking-tight"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        Se connecter
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-primary-100 flex justify-between text-sm">
                  <button
                    onClick={() => { setView('register'); clearError(); setMessage(''); }}
                    className="text-ink-700 hover:text-accent-700 font-medium transition-colors"
                  >
                    Créer un compte
                  </button>
                  <button
                    onClick={() => { setView('reset'); clearError(); setMessage(''); }}
                    className="text-ink-500 hover:text-ink-800 transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </>
            )}

            {/* Register View */}
            {view === 'register' && (
              <>
                <div className="text-center mb-7">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-canvas-200 to-canvas-300/60 border border-primary-200/60 mb-4 shadow-card">
                    <User className="w-5 h-5 text-ink-700" />
                  </div>
                  <h2 className="text-xl font-bold text-ink-900 tracking-tight">Inscription</h2>
                  <p className="text-ink-500 text-sm mt-1">Rejoignez la plateforme AtlasBanx</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="label">Type de compte</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountType('enterprise')}
                        disabled={isLoading}
                        className={`flex items-start gap-3 p-3.5 border-2 rounded-xl text-left transition-all duration-200 ease-premium ${
                          accountType === 'enterprise'
                            ? 'border-ink-900 bg-canvas-100 shadow-card'
                            : 'border-primary-200 hover:border-primary-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          accountType === 'enterprise' ? 'bg-ink-900 text-white' : 'bg-canvas-200 text-ink-500'
                        }`}>
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold tracking-tight ${
                            accountType === 'enterprise' ? 'text-ink-900' : 'text-ink-700'
                          }`}>
                            Entreprise
                          </p>
                          <p className="text-xs text-ink-500 mt-0.5">
                            J'audite les transactions de ma société
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('cabinet')}
                        disabled={isLoading}
                        className={`flex items-start gap-3 p-3.5 border-2 rounded-xl text-left transition-all duration-200 ease-premium ${
                          accountType === 'cabinet'
                            ? 'border-ink-900 bg-canvas-100 shadow-card'
                            : 'border-primary-200 hover:border-primary-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          accountType === 'cabinet' ? 'bg-ink-900 text-white' : 'bg-canvas-200 text-ink-500'
                        }`}>
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold tracking-tight ${
                            accountType === 'cabinet' ? 'text-ink-900' : 'text-ink-700'
                          }`}>
                            Cabinet
                          </p>
                          <p className="text-xs text-ink-500 mt-0.5">
                            J'audite plusieurs sociétés clientes
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-name" className="label">Nom complet</label>
                    <input
                      id="reg-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="input"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="label">Email</label>
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="input"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="label">Mot de passe</label>
                    <input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="input"
                      disabled={isLoading}
                    />
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200/70 px-3 py-2.5 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!email || !password || isLoading}
                    className="btn btn-primary w-full py-3 text-sm tracking-tight"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>S'inscrire <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-primary-100 text-center">
                  <button
                    onClick={() => { setView('login'); clearError(); }}
                    className="text-sm text-ink-700 hover:text-accent-700 font-medium transition-colors"
                  >
                    Déjà un compte ? Se connecter
                  </button>
                </div>
              </>
            )}

            {/* Reset Password View */}
            {view === 'reset' && (
              <>
                <div className="text-center mb-7">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-canvas-200 to-canvas-300/60 border border-primary-200/60 mb-4 shadow-card">
                    <Mail className="w-5 h-5 text-ink-700" />
                  </div>
                  <h2 className="text-xl font-bold text-ink-900 tracking-tight">Réinitialisation</h2>
                  <p className="text-ink-500 text-sm mt-1">Recevez un lien sur votre email</p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="label">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className="input pl-10"
                        autoFocus
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200/70 px-3 py-2.5 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!email || isLoading}
                    className="btn btn-primary w-full py-3 text-sm tracking-tight"
                  >
                    {isLoading ? 'Envoi...' : 'Envoyer le lien'}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-primary-100 text-center">
                  <button
                    onClick={() => { setView('login'); clearError(); }}
                    className="text-sm text-ink-700 hover:text-accent-700 font-medium transition-colors"
                  >
                    ← Retour à la connexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6 tracking-wide">
          <ShieldCheck className="inline w-3 h-3 mr-1 mb-0.5" />
          Plateforme sécurisée — Réservée aux utilisateurs autorisés
        </p>
      </div>
    </div>
  );
}
