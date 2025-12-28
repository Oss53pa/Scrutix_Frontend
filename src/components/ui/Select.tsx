import { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, className = '', id, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);

    const selectClasses = `
      w-full px-3 py-2 rounded-md border bg-white
      text-primary-900
      transition-colors duration-200
      hover:border-primary-300
      focus:outline-none focus:ring-2 focus:border-transparent
      disabled:bg-primary-50 disabled:cursor-not-allowed
      appearance-none cursor-pointer pr-10
      ${hasError ? 'border-error focus:ring-error' : 'border-primary-200 focus:ring-primary-900'}
      ${className}
    `;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-primary-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select ref={ref} id={selectId} className={selectClasses} {...props}>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
            {options && options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-primary-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        {error && <p className="text-sm text-error mt-1">{error}</p>}
        {!error && helperText && <p className="text-sm text-primary-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Multi-select with checkboxes
interface MultiSelectProps {
  label?: string;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  helperText?: string;
}

export function MultiSelect({ label, options, value, onChange, error, helperText }: MultiSelectProps) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-primary-700 mb-2">{label}</label>}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors
              ${value.includes(option.value) ? 'border-primary-900 bg-primary-50' : 'border-primary-200 hover:border-primary-300'}
              ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={() => handleToggle(option.value)}
              disabled={option.disabled}
              className="h-4 w-4 rounded border-primary-300 text-primary-900 focus:ring-primary-500"
            />
            <span className="text-sm text-primary-900">{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-error mt-1">{error}</p>}
      {!error && helperText && <p className="text-sm text-primary-500 mt-1">{helperText}</p>}
    </div>
  );
}
