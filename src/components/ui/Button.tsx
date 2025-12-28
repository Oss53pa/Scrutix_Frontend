import { forwardRef, ButtonHTMLAttributes, ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
  primary: 'bg-primary-900 text-white hover:bg-primary-800 active:bg-primary-950 focus:ring-primary-500',
  secondary: 'bg-primary-100 text-primary-900 border border-primary-200 hover:bg-primary-200 active:bg-primary-300 focus:ring-primary-400',
  ghost: 'bg-transparent text-primary-700 hover:bg-primary-100 active:bg-primary-200 focus:ring-primary-400',
  danger: 'bg-error text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
  icon: 'p-2',
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

    // Cleanup on unmount
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
      'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

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
