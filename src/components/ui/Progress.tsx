import { HTMLAttributes } from 'react';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const variantClasses = {
  default: 'bg-primary-900',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

export function Progress({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  variant = 'default',
  className = '',
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`} {...props}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-primary-700">Progression</span>
          <span className="text-sm text-primary-500">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-primary-100 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}

// Circular progress
interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const circularVariantClasses = {
  default: 'text-primary-900',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

export function CircularProgress({
  value,
  size = 48,
  strokeWidth = 4,
  showLabel = true,
  variant = 'default',
}: CircularProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-primary-100"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${circularVariantClasses[variant]} transition-all duration-500 ease-out`}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-semibold text-primary-900">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

// Step progress
interface Step {
  label: string;
  description?: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

export function StepProgress({ steps, currentStep, className = '' }: StepProgressProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${
                    index < currentStep
                      ? 'bg-primary-900 text-white'
                      : index === currentStep
                        ? 'bg-primary-900 text-white ring-4 ring-primary-100'
                        : 'bg-primary-100 text-primary-500'
                  }`}
              >
                {index < currentStep ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={`text-sm font-medium ${
                    index <= currentStep ? 'text-primary-900' : 'text-primary-400'
                  }`}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-primary-500 mt-0.5">{step.description}</p>
                )}
              </div>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-4 transition-colors ${
                  index < currentStep ? 'bg-primary-900' : 'bg-primary-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
