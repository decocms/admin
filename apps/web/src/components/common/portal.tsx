import {
  createContext,
  HTMLAttributes,
  ReactNode,
  useContext,
  useId,
} from "react";
import { createPortal } from "react-dom";

const Context = createContext<{ id: string }>({ id: "" });

export function PortalProvider({ children }: { children: ReactNode }) {
  const id = useId();

  return (
    <Context.Provider value={{ id }}>
      {children}
    </Context.Provider>
  );
}

/** Where you want the portal to render to */
export function PortalTarget(props: HTMLAttributes<HTMLDivElement>) {
  const { id } = useContext(Context);

  return <div {...props} id={id} />;
}

/** What you want to render into the portal target */
export function PortalSlot({ children }: { children: ReactNode }) {
  const { id } = useContext(Context);

  const element = document.getElementById(id);

  if (!element) {
    console.warn(`Missing portal slot for ${id}`);
    return null;
  }

  return createPortal(children, element);
}
