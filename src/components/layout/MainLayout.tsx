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
    <div className="relative min-h-screen bg-canvas-100 dark:bg-ink-900">
      {/* Ambient gradient background — premium banking ambience */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-accent-200/30 blur-3xl dark:bg-accent-700/15" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-ink-200/40 blur-3xl dark:bg-ink-700/30" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-accent-100/40 blur-3xl dark:bg-accent-800/10" />
      </div>

      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-ink-900 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500"
      >
        Aller au contenu principal
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main
          id="main-content"
          className="flex-1 w-full p-4 sm:p-6 lg:p-8 animate-fade-in"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Floating ChatBot */}
      <ChatBot />
    </div>
  );
}
