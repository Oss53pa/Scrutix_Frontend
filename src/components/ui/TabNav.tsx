import { LucideIcon } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export function TabNav({
  tabs,
  activeTab,
  onTabChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
}: TabNavProps) {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const getTabStyles = (isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) {
      return 'text-primary-300 cursor-not-allowed';
    }

    switch (variant) {
      case 'pills':
        return isActive
          ? 'bg-primary-900 text-white'
          : 'text-primary-600 hover:bg-primary-100';
      case 'underline':
        return isActive
          ? 'text-primary-900 border-b-2 border-primary-900'
          : 'text-primary-500 hover:text-primary-700 border-b-2 border-transparent';
      default:
        return isActive
          ? 'bg-white text-primary-900 shadow-sm'
          : 'text-primary-600 hover:bg-primary-50';
    }
  };

  const containerStyles = {
    default: 'bg-primary-100 p-1 rounded-lg',
    pills: 'gap-2',
    underline: 'border-b border-primary-200',
  };

  return (
    <div
      className={`flex ${fullWidth ? 'w-full' : 'w-fit'} ${containerStyles[variant]} ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`
              flex items-center justify-center font-medium rounded-md transition-all
              ${sizeStyles[size]}
              ${fullWidth ? 'flex-1' : ''}
              ${getTabStyles(isActive, !!tab.disabled)}
            `}
          >
            {Icon && <Icon className={iconSizes[size]} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`
                  px-1.5 py-0.5 text-xs rounded-full
                  ${isActive ? 'bg-white/20 text-white' : 'bg-primary-200 text-primary-700'}
                `}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  tabId: string;
  activeTab: string;
  className?: string;
}

export function TabPanel({ children, tabId, activeTab, className = '' }: TabPanelProps) {
  if (tabId !== activeTab) return null;
  return <div className={className}>{children}</div>;
}
