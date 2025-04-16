import { createContext, PropsWithChildren, useContext } from "react";

type IContext = {
  agentId: string;
};

const SettingsContext = createContext<IContext | null>(null);

export function SettingsProvider({
  children,
  agentId,
}: PropsWithChildren<IContext>) {
  return (
    <SettingsContext.Provider value={{ agentId }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
