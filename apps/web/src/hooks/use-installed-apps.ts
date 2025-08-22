import { useState, useEffect } from "react";

interface InstalledApp {
  id: string;
  name: string;
  icon?: string;
  installedAt: string;
  status?: "connected" | "pending" | "disconnected";
}

const INSTALLED_APPS_KEY = "deco_installed_apps";

export function useInstalledApps() {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);

  useEffect(() => {
    // Load installed apps from localStorage
    const stored = localStorage.getItem(INSTALLED_APPS_KEY);
    if (stored) {
      try {
        setInstalledApps(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse installed apps:", e);
      }
    }
  }, []);

  const installApp = (app: Omit<InstalledApp, "installedAt">) => {
    const newApp: InstalledApp = {
      ...app,
      installedAt: new Date().toISOString(),
    };
    
    const updated = [...installedApps, newApp];
    setInstalledApps(updated);
    localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(updated));
    
    // Dispatch a custom event so other components can react
    window.dispatchEvent(new CustomEvent("app-installed", { detail: newApp }));
    
    return newApp;
  };

  const uninstallApp = (appId: string) => {
    const updated = installedApps.filter(app => app.id !== appId);
    setInstalledApps(updated);
    localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(updated));
    
    // Dispatch a custom event
    window.dispatchEvent(new CustomEvent("app-uninstalled", { detail: { id: appId } }));
  };

  const isAppInstalled = (appId: string) => {
    return installedApps.some(app => app.id === appId);
  };

  return {
    installedApps,
    installApp,
    uninstallApp,
    isAppInstalled,
  };
}