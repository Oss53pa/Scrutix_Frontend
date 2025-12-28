import { useState, useCallback } from 'react';

interface UseTabNavigationOptions {
  defaultTab: string;
  onTabChange?: (tabId: string) => void;
}

interface UseTabNavigationReturn {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  isActive: (tabId: string) => boolean;
}

export function useTabNavigation({
  defaultTab,
  onTabChange,
}: UseTabNavigationOptions): UseTabNavigationReturn {
  const [activeTab, setActiveTabState] = useState(defaultTab);

  const setActiveTab = useCallback(
    (tabId: string) => {
      setActiveTabState(tabId);
      onTabChange?.(tabId);
    },
    [onTabChange]
  );

  const isActive = useCallback(
    (tabId: string) => activeTab === tabId,
    [activeTab]
  );

  return {
    activeTab,
    setActiveTab,
    isActive,
  };
}
