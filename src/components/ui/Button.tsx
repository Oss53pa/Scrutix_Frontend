import { forwardRef, ButtonHTMLAttributes, ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
  /** Debounce delay in ms to prevent double-clicks (default: 300) */
  debounce?: number;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-gradient-to-b from-ink-800 to-ink-950 ' +
    'shadow-[0_1px_0_0_rgb(255_255_255/0.08)_inset,0_2px_8px_-2px_rgb(7_11_31/0.4)] ' +
    'hover:from-ink-700 hover:to-ink-900 ' +
    'hover:shadow-[0_1px_0_0_rgb(255_255_255/0.12)_inset,0_4px_12px_-2px_rgb(7_11_31/0.45)] ' +
    'active:from-ink-900 active:to-ink-950 ' +
    'focus:ring-accent-500/50',
  secondary:
    'bg-white text-ink-900 border border-primary-200 ' +
    'shadow-[0_1px_2px_rgb(15_14_10/0.04)] ' +
    'hover:bg-canvas-50 hover:border-primary-300 hover:shadow-card ' +
    'active:bg-canvas-100 ' +
    'focus:ring-accent-500/40',
  ghost:
    'bg-transparent text-ink-700 hover:bg-canvas-200 hover:text-ink-900 ' +
    'active:bg-canvas-300/60 focus:ring-accent-500/40',
  accent:
    'text-ink-950 bg-gradient-to-b from-accent-300 to-accent-500 ' +
    'shadow-[0_1px_0_0_rgb(255_255_255/0.4)_inset,0_2px_10px_-2px_rgb(176_124_60/0.35)] ' +
    'hover:from-accent-400 hover:to-accent-600 hover:text-white ' +
    'focus:ring-accent-500/60',
  danger:
    'text-white bg-gradient-to-b from-red-500 to-red-700 ' +
    'shadow-[0_1px_0_0_rgb(255_255_255/0.1)_inset,0_2px_8px_-2px_rgb(220_38_38/0.35)] ' +
    'hover:from-red-600 hover:to-red-800 ' +
    'focus:ring-red-500/50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
  icon: 'p-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      debounce = 300,
      onClick,
      ...props
    },
    ref
  ) => {
    const [isDebouncing, setIsDebouncing] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDebouncing || isLoading || disabled) return;

        if (onClick) {
          setIsDebouncing(true);
          onClick(e);

          timeoutRef.current = setTimeout(() => {
            setIsDebouncing(false);
          }, debounce);
        }
      },
      [onClick, isDebouncing, isLoading, disabled, debounce]
    );

    const baseClasses =
      'inline-flex items-center justify-center gap-2 font-medium tracking-tight ' +
      'transition-all duration-200 ease-premium cursor-pointer ' +
      'focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
      'disabled:opacity-50 disabled:cursor-not-allowed ' +
      'active:scale-[0.985]';

    const isDisabled = disabled || isLoading || isDebouncing;

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={isDisabled}
        onClick={handleClick}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
