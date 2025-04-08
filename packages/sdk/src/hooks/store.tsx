import { createStore } from "@deco/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren } from "react";

interface State {
  context: string;
  client: QueryClient;
}

const { Provider: StoreProvider, useStore } = createStore<State>({
  initializer: (props) => ({
    ...props,
    context: props.context ?? "",
    client: props.client!,
  }),
});

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

function Provider({ children, ...props }: PropsWithChildren<Partial<State>>) {
  return (
    <QueryClientProvider client={client}>
      <StoreProvider {...props} client={client}>
        {children}
      </StoreProvider>
    </QueryClientProvider>
  );
}

export { Provider as SDKProvider, useStore as useSDK };
