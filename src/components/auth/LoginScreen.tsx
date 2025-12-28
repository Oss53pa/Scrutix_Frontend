import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

// Mot de passe d'accès (peut être changé ici)
const ACCESS_PASSWORD = 'Scrutix2024!';
const AUTH_KEY = 'scrutix_authenticated';

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate a small delay for UX
    setTimeout(() => {
      if (password === ACCESS_PASSWORD) {
        localStorage.setItem(AUTH_KEY, 'true');
        onSuccess();
      } else {
        setError('Mot de passe incorrect');
        setPassword('');
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <span className="text-4xl font-bold text-white">S</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Scrutix</h1>
          <p className="text-primary-200 mt-2">Audit Bancaire Intelligent</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-3">
              <Lock className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Accès sécurisé</h2>
            <p className="text-gray-500 text-sm mt-1">Entrez le mot de passe pour continuer</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez le mot de passe"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-12"
                  autoFocus
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

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!password || isLoading}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Vérification...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-300 text-sm mt-6">
          Application réservée aux utilisateurs autorisés
        </p>
      </div>
    </div>
  );
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}
