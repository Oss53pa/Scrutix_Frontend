import { ReactNode } from 'react';
import { FileQuestion, Search, Upload, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

type EmptyStateVariant = 'default' | 'search' | 'upload' | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const defaultIcons: Record<EmptyStateVariant, ReactNode> = {
  default: <FileQuestion className="w-16 h-16" />,
  search: <Search className="w-16 h-16" />,
  upload: <Upload className="w-16 h-16" />,
  error: <AlertTriangle className="w-16 h-16" />,
};

export function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const displayIcon = icon || defaultIcons[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <div className="text-primary-300 mb-4">{displayIcon}</div>
      <h3 className="text-lg font-medium text-primary-900 mb-2">{title}</h3>
      {description && <p className="text-primary-500 max-w-md mb-6">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Specific empty states
export function NoDataEmptyState({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      variant="default"
      title="Aucune donnée"
      description="Importez des relevés bancaires pour commencer l'analyse."
      action={onAction ? { label: 'Importer des données', onClick: onAction } : undefined}
    />
  );
}

export function NoSearchResultsEmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      variant="search"
      title="Aucun résultat"
      description={`Aucun résultat trouvé pour "${query}". Essayez avec d'autres termes.`}
      action={{ label: 'Effacer la recherche', onClick: onClear }}
    />
  );
}

export function NoAnomaliesEmptyState() {
  return (
    <EmptyState
      variant="default"
      icon={
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      }
      title="Aucune anomalie détectée"
      description="Les relevés bancaires analysés ne présentent aucune anomalie."
    />
  );
}

export function ErrorEmptyState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Une erreur s'est produite"
      description={message}
      action={onRetry ? { label: 'Réessayer', onClick: onRetry } : undefined}
    />
  );
}
