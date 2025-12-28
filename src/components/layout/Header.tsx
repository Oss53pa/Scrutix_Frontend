import { Menu } from 'lucide-react';
import { Button } from '../ui';
import { NotificationsDropdown } from './NotificationsDropdown';
import { ProfileDropdown } from './ProfileDropdown';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-primary-200">
      <div className="w-full px-4 sm:px-6">
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
          <div className="flex items-center gap-3">
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
