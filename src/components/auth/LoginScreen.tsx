import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Mail, User, Building2, Briefcase } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <span className="font-display text-5xl text-white">S</span>
          </div>
          <h1 className="font-display text-4xl text-white">AtlasBanx</h1>
          <p className="font-display text-xl text-primary-200 mt-2">Audit Bancaire Intelligent</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Login View */}
          {view === 'login' && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-3">
                  <Lock className="w-6 h-6 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Connexion</h2>
                <p className="text-gray-500 text-sm mt-1">Connectez-vous à votre compte</p>
              </div>

              {message && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg mb-4">
                  <span className="text-sm">{message}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Votre mot de passe"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-12"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!email || !password || isLoading}
                  className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Se connecter
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 flex justify-between text-sm">
                <button
                  onClick={() => { setView('register'); clearError(); setMessage(''); }}
                  className="text-primary-600 hover:text-primary-800"
                >
                  Créer un compte
                </button>
                <button
                  onClick={() => { setView('reset'); clearError(); setMessage(''); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </>
          )}

          {/* Register View */}
          {view === 'register' && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-3">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Inscription</h2>
                <p className="text-gray-500 text-sm mt-1">Créez votre compte AtlasBanx</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de compte
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType('enterprise')}
                      disabled={isLoading}
                      className={`flex items-start gap-3 p-3 border-2 rounded-lg text-left transition-colors ${
                        accountType === 'enterprise'
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        accountType === 'enterprise' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          accountType === 'enterprise' ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          Entreprise
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          J'audite les transactions de ma société
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('cabinet')}
                      disabled={isLoading}
                      className={`flex items-start gap-3 p-3 border-2 rounded-lg text-left transition-colors ${
                        accountType === 'cabinet'
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        accountType === 'cabinet' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          accountType === 'cabinet' ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          Cabinet
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          J'audite plusieurs sociétés clientes
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={isLoading}
                  />
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!email || !password || isLoading}
                  className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "S'inscrire"
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setView('login'); clearError(); }}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  Déjà un compte ? Se connecter
                </button>
              </div>
            </>
          )}

          {/* Reset Password View */}
          {view === 'reset' && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-3">
                  <Mail className="w-6 h-6 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Réinitialisation</h2>
                <p className="text-gray-500 text-sm mt-1">Entrez votre email pour réinitialiser</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!email || isLoading}
                  className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isLoading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setView('login'); clearError(); }}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  Retour à la connexion
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-primary-300 text-sm mt-6">
          Application réservée aux utilisateurs autorisés
        </p>
      </div>
    </div>
  );
}
