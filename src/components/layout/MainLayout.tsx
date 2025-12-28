import { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatBot } from '../chatbot/ChatBot';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-primary-50">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary-900 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        Aller au contenu principal
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main id="main-content" className="flex-1 w-full p-4 sm:p-6" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Floating ChatBot */}
      <ChatBot />
    </div>
  );
}
