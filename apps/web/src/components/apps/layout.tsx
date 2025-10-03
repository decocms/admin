import { useSearchParams } from "react-router";
import { z } from "zod";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { SplitScreenLayout } from "../login/layout.tsx";
import {
  DecoQueryClientProvider,
  InlineAppSchema,
  type InlineApp,
} from "@deco/sdk";

export const OAuthSearchParamsSchema = z
  .object({
    client_id: z.string().optional(),
    app_data: z.string().optional(), // Base64-encoded JSON of InlineAppSchema
    redirect_uri: z.string(),
    state: z.string().optional(),
    workspace_hint: z.string().optional(),
  })
  .refine(
    (data) => {
      // Exactly one of client_id or app_data must be provided
      return (
        (data.client_id && !data.app_data) || (!data.client_id && data.app_data)
      );
    },
    {
      message: "Either client_id or app_data must be provided, but not both",
    },
  );

export type OAuthSearchParams = z.infer<typeof OAuthSearchParamsSchema> & {
  inlineApp?: InlineApp;
};

function decodeAppData(appData: string): InlineApp {
  try {
    const decoded = atob(appData);
    const parsed = JSON.parse(decoded);
    return InlineAppSchema.parse(parsed);
  } catch (error) {
    throw new Error(
      `Invalid app_data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

const ErrorPanel = () => (
  <div className="flex flex-col items-center justify-center h-full">
    <div className="text-center space-y-6 max-w-md">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <Icon name="error" size={32} className="text-destructive" />
        </div>
      </div>
      <h1 className="text-xl font-semibold">Authentication Error</h1>
      <p className="text-muted-foreground text-sm w-2/3 mx-auto">
        Something went wrong when authenticating your access to that app. Please
        try again or contact us if the problem persists.
      </p>
      <Button
        variant="outline"
        onClick={() => globalThis.history.back()}
        className="gap-2"
      >
        <Icon name="arrow_left_alt" size={16} />
        Go back
      </Button>
    </div>
  </div>
);

type AppsAuthLayoutProps = {
  children: (props: OAuthSearchParams) => React.ReactNode;
};

export function AppsAuthLayout({ children }: AppsAuthLayoutProps) {
  const [searchParams] = useSearchParams();
  const params = Object.fromEntries(searchParams);
  const result = OAuthSearchParamsSchema.safeParse(params);

  if (!result.success) {
    return (
      <DecoQueryClientProvider>
        <SplitScreenLayout>
          <ErrorPanel />
        </SplitScreenLayout>
      </DecoQueryClientProvider>
    );
  }

  // Decode inline app if provided
  const processedParams: OAuthSearchParams = {
    ...result.data,
    inlineApp: result.data.app_data
      ? decodeAppData(result.data.app_data)
      : undefined,
  };

  return (
    <DecoQueryClientProvider>
      <SplitScreenLayout>{children(processedParams)}</SplitScreenLayout>
    </DecoQueryClientProvider>
  );
}
