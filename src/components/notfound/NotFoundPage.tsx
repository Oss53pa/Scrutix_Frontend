import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Code 404 */}
        <div className="mb-6">
          <span className="font-display text-8xl font-bold text-primary-200">404</span>
        </div>

        {/* Icône */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
          <Search className="w-8 h-8 text-primary-400" />
        </div>

        {/* Message */}
        <h1 className="text-2xl font-semibold text-primary-900 mb-2">
          Page introuvable
        </h1>
        <p className="text-primary-500 mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-5 py-2.5 border border-primary-300 text-primary-700 font-medium rounded-lg hover:bg-primary-100 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Tableau de bord
          </button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-xs text-primary-400">
          <span className="font-display">AtlasBanx</span> — Audit Bancaire Intelligent
        </p>
      </div>
    </div>
  );
}
