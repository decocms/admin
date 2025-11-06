import { createContext, type ReactNode, useContext } from "react";

/**
 * Context to provide route params to legacy components that use useParams()
 * without needing a separate Router.
 *
 * This allows components that depend on useParams() to work within tabs
 * without affecting the main browser URL.
 */
interface RouteParamsContextValue {
  params: Record<string, string | undefined>;
}

const RouteParamsContext = createContext<RouteParamsContextValue | null>(null);

interface RouteParamsProviderProps {
  params: Record<string, string | undefined>;
  children: ReactNode;
}

export function RouteParamsProvider({
  params,
  children,
}: RouteParamsProviderProps) {
  return (
    <RouteParamsContext.Provider value={{ params }}>
      {children}
    </RouteParamsContext.Provider>
  );
}

/**
 * Hook to get params from the RouteParamsProvider.
 * Falls back to the real useParams if not inside a RouteParamsProvider.
 */
export function useRouteParams<
  T extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>(): T {
  const context = useContext(RouteParamsContext);
  if (context) {
    return context.params as T;
  }
  // If not in a RouteParamsProvider, return empty object
  return {} as T;
}
