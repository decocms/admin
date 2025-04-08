import { SDKProvider } from "@deco/sdk";
import { createStore } from "@deco/store";
import { type ReactNode } from "react";
import { useParams } from "react-router";
import { useUser } from "../hooks/data/useUser.ts";

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
  slug?: string;
};

export interface State {
  context?: Context;
  sidebarState?: SidebarStorage;
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

export function GlobalStateProvider(
  { children }: { children: ReactNode },
) {
  const { teamSlug } = useParams();
  const user = useUser();

  const rootContext = teamSlug ? `shared/${teamSlug}` : `users/${user?.id}`;

  return (
    <SDKProvider context={rootContext}>
      <Provider
        context={teamSlug
          ? {
            type: "team" as const,
            slug: teamSlug,
            root: `/shared/${teamSlug}`,
          }
          : {
            type: "user" as const,
            slug: "",
            root: `/users/${user?.id}`,
          }}
      >
        {children}
      </Provider>
    </SDKProvider>
  );
}

export const useGlobalState = useStore;
