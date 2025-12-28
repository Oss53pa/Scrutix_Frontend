import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantConfig = {
  info: {
    containerClass: 'bg-blue-50 border-blue-200',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-800',
    textClass: 'text-blue-700',
    Icon: Info,
  },
  success: {
    containerClass: 'bg-green-50 border-green-200',
    iconClass: 'text-green-500',
    titleClass: 'text-green-800',
    textClass: 'text-green-700',
    Icon: CheckCircle,
  },
  warning: {
    containerClass: 'bg-amber-50 border-amber-200',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-800',
    textClass: 'text-amber-700',
    Icon: AlertCircle,
  },
  error: {
    containerClass: 'bg-red-50 border-red-200',
    iconClass: 'text-red-500',
    titleClass: 'text-red-800',
    textClass: 'text-red-700',
    Icon: XCircle,
  },
};

export function Alert({ variant = 'info', title, children, onClose, className = '' }: AlertProps) {
  const config = variantConfig[variant];
  const Icon = config.Icon;

  return (
    <div className={`rounded-md border p-4 ${config.containerClass} ${className}`} role="alert">
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconClass}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          {title && <h3 className={`text-sm font-medium ${config.titleClass}`}>{title}</h3>}
          <div className={`text-sm ${config.textClass} ${title ? 'mt-1' : ''}`}>{children}</div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex rounded-md p-1.5 ${config.textClass} hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              <span className="sr-only">Fermer</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Toast notification component
interface ToastProps {
  id: string;
  variant?: AlertVariant;
  title?: string;
  message: string;
  onClose: (id: string) => void;
  duration?: number;
}

export function Toast({ id, variant = 'info', title, message, onClose }: ToastProps) {
  const config = variantConfig[variant];
  const Icon = config.Icon;

  return (
    <div
      className={`max-w-sm w-full bg-white shadow-dropdown rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-slide-up`}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${config.iconClass}`} aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1">
            {title && <p className="text-sm font-medium text-primary-900">{title}</p>}
            <p className={`text-sm text-primary-500 ${title ? 'mt-1' : ''}`}>{message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="rounded-md inline-flex text-primary-400 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => onClose(id)}
            >
              <span className="sr-only">Fermer</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
