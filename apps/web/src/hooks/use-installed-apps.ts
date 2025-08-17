import { useState, useEffect } from "react";
import type { MarketplaceItem } from "../data/marketplace.ts";

// Simple local storage-based state for demo purposes
// In production, this would be stored in the database and synced via API

const INSTALLED_APPS_KEY = "deco-installed-apps";

export function useInstalledApps() {
  const [installedApps, setInstalledApps] = useState<MarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load installed apps from localStorage on mount
    try {
      const stored = localStorage.getItem(INSTALLED_APPS_KEY);
      if (stored) {
        const apps = JSON.parse(stored);
        setInstalledApps(apps);
      }
    } catch (error) {
      console.error("Failed to load installed apps:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installApp = (app: MarketplaceItem) => {
    const updatedApps = [...installedApps, { ...app, isInstalled: true }];
    setInstalledApps(updatedApps);
    
    // Persist to localStorage
    try {
      localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(updatedApps));
    } catch (error) {
      console.error("Failed to save installed apps:", error);
    }
  };

  const uninstallApp = (appId: string) => {
    const updatedApps = installedApps.filter(app => app.id !== appId);
    setInstalledApps(updatedApps);
    
    // Persist to localStorage
    try {
      localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(updatedApps));
    } catch (error) {
      console.error("Failed to save installed apps:", error);
    }
  };

  const isInstalled = (appId: string) => {
    return installedApps.some(app => app.id === appId);
  };

  const getInstalledApp = (appId: string) => {
    return installedApps.find(app => app.id === appId);
  };

  const getInstalledAppsByCategory = (category: MarketplaceItem['category']) => {
    return installedApps.filter(app => app.category === category);
  };

  return {
    installedApps,
    isLoading,
    installApp,
    uninstallApp,
    isInstalled,
    getInstalledApp,
    getInstalledAppsByCategory,
  };
}
