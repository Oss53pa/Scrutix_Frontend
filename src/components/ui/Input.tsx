import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);

    const inputClasses = `
      w-full px-3 py-2 rounded-md border bg-white
      text-primary-900 placeholder:text-primary-400
      transition-colors duration-200
      hover:border-primary-300
      focus:outline-none focus:ring-2 focus:border-transparent
      disabled:bg-primary-50 disabled:cursor-not-allowed
      ${leftIcon ? 'pl-10' : ''}
      ${rightIcon ? 'pr-10' : ''}
      ${hasError ? 'border-error focus:ring-error' : 'border-primary-200 focus:ring-primary-900'}
      ${className}
    `;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-primary-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary-400">
              {leftIcon}
            </div>
          )}
          <input ref={ref} id={inputId} className={inputClasses} {...props} />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-primary-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-error mt-1">{error}</p>}
        {!error && helperText && <p className="text-sm text-primary-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea component
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);

    const textareaClasses = `
      w-full px-3 py-2 rounded-md border bg-white
      text-primary-900 placeholder:text-primary-400
      transition-colors duration-200
      hover:border-primary-300
      focus:outline-none focus:ring-2 focus:border-transparent
      disabled:bg-primary-50 disabled:cursor-not-allowed
      resize-none
      ${hasError ? 'border-error focus:ring-error' : 'border-primary-200 focus:ring-primary-900'}
      ${className}
    `;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-primary-700 mb-1">
            {label}
          </label>
        )}
        <textarea ref={ref} id={textareaId} className={textareaClasses} {...props} />
        {error && <p className="text-sm text-error mt-1">{error}</p>}
        {!error && helperText && <p className="text-sm text-primary-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
