import { createStore } from "@deco/store";
import { type ReactNode } from "react";
import { useLocation } from "react-router";

export interface User {
  id: string;
  email: string;
  app_metadata: {
    provider: string;
  };
  isAdmin: boolean;
  is_anonymous: boolean;
  last_sign_in_at: string;
  walletHead: {
    total: string;
  };
  metadata: {
    avatar_url: string;
    full_name: string;
    username: string;
  };
}

export interface NavItem {
  // Label of the item
  title: string;
  // Icon of the item
  icon: string;
  // Link to the item
  url: string;
}

export interface SidebarStorage {
  // For each context, a list of items
  [context: string]: NavItem[];
}

type Context = {
  type: "team";
  slug: string;
  root: string;
} | {
  type: "user";
  root: string;
  slug?: undefined;
};

export interface State {
  context?: Context;
  sidebarState?: SidebarStorage;
  storage?: any;
}

const sidebar = {
  write: async (state: SidebarStorage, fs: any, user: User) => {
    await fs.mkdir(`/users/${user.id}/.config`, { recursive: true })
      .catch((e: any) => console.error(e));

    await fs.writeFile(
      `/users/${user.id}/.config/sidebar.json`,
      JSON.stringify(state),
    );
  },
  read: async (fs: any, user: User) => {
    const path = `/users/${user.id}/.config/sidebar.json`;

    try {
      const data = await fs.readFile(path, "utf8");
      return JSON.parse(data);
    } catch (e) {
      console.error(e);

      return {};
    }
  },
};

const { Provider, useStore } = createStore<State>({
  middlewares: {
    // sidebarState: async (nextState) => {
    //   // const { storage, sidebarState } = nextState;

    //   // if (!storage) {
    //   //   return nextState;
    //   // }

    //   // await sidebar.write(sidebarState, storage);

    //   // return nextState;
    // },
  },
  initializer: (props) => props,
});

function StoreEffects() {
  return null;
}

const useContext = () => {
  const { pathname } = useLocation();

  const match = pathname.match(/^\/shared\/(.+)/);
  const teamSlug = match ? match[1].split("/")[0] : undefined;

  if (teamSlug) {
    return {
      type: "team" as const,
      slug: teamSlug,
      root: `/shared/${teamSlug}`,
    };
  }

  return {
    type: "user" as const,
    root: "/~",
  };
};

export function GlobalStateProvider(
  { children }: { children: ReactNode },
) {
  const context = useContext();

  return (
    <Provider context={context}>
      <StoreEffects />
      {children}
    </Provider>
  );
}

export const useGlobalState = useStore;
