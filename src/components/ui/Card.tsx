import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export function Card({ children, hover = false, className = '', ...props }: CardProps) {
  const baseClasses =
    'bg-white dark:bg-ink-800 rounded-card shadow-card border border-primary-100/70 dark:border-ink-700/70 transition-all duration-300 ease-premium';
  const hoverClasses = hover ? 'hover:shadow-card-hover hover:border-primary-200 hover:-translate-y-0.5' : '';

  return (
    <div className={`${baseClasses} ${hoverClasses} ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ children, action, className = '', ...props }: CardHeaderProps) {
  return (
    <div
      className={`px-6 py-4 border-b border-primary-100/70 dark:border-ink-700/70 flex items-center justify-between ${className}`}
      {...props}
    >
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export function CardTitle({ children, className = '', ...props }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-ink-900 dark:text-ink-50 tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function CardDescription({ children, className = '', ...props }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-ink-500 dark:text-ink-400 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ children, className = '', ...props }: CardBodyProps) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div
      className={`px-6 py-4 border-t border-primary-100/70 dark:border-ink-700/70 bg-canvas-50/50 dark:bg-ink-900/40 rounded-b-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
