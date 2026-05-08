import { Menu } from 'lucide-react';
import { Button } from '../ui';
import { AIQuotaIndicator } from './AIQuotaIndicator';
import { NotificationsDropdown } from './NotificationsDropdown';
import { ProfileDropdown } from './ProfileDropdown';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-canvas-50/70 dark:bg-ink-900/70 backdrop-blur-xl border-b border-primary-200/50 dark:border-ink-700/50">
      {/* Subtle gold hairline at the very bottom of the header */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-300/40 to-transparent"
      />

      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Spacer for desktop */}
          <div className="hidden lg:block" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* AI quota indicator */}
            <AIQuotaIndicator />

            {/* Vertical hairline divider */}
            <div className="hidden sm:block h-6 w-px bg-primary-200/70 dark:bg-ink-700/70 mx-1" />

            {/* Notifications dropdown */}
            <NotificationsDropdown />

            {/* Profile dropdown */}
            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
