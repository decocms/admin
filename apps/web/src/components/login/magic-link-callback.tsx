import { Button } from "@deco/ui/components/button.tsx";
import { useSearchParams } from "react-router";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { DECO_CMS_API_URL } from "@deco/sdk";
import { useState } from "react";
import { SplitScreenLayout } from "./layout.tsx";

function MagicLinkCallback() {
  const [searchParams] = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const tokenHash =
    searchParams.get("token_hash") || searchParams.get("tokenHash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  const handleConfirmLogin = () => {
    if (!tokenHash || !type) {
      return;
    }

    setIsRedirecting(true);

    const apiUrl = new URL("/auth/callback/magiclink", DECO_CMS_API_URL);
    apiUrl.searchParams.set("tokenHash", tokenHash);
    apiUrl.searchParams.set("type", type);
    if (next) {
      apiUrl.searchParams.set("next", next);
    }

    globalThis.location.href = apiUrl.toString();
  };

  const hasRequiredParams = tokenHash && type;

  return (
    <SplitScreenLayout>
      <div className="flex flex-col items-center justify-center p-6 h-full">
        <div className="flex flex-col items-center gap-8">
          <div className="text-lg font-semibold leading-none tracking-tight">
            <div className="flex flex-col items-center gap-5">
              <div className="flex flex-col text-center">
                <h2 className="text-xl font-bold">Confirm your login</h2>
              </div>
              <p className="text-sm text-muted-foreground font-normal text-center max-w-md">
                Click the button below to complete your login securely
              </p>
            </div>
          </div>

          {!hasRequiredParams ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-destructive">
                Invalid or missing authentication parameters.
              </p>
              <p className="text-sm text-muted-foreground">
                Please use the link from your email.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <Button
                onClick={handleConfirmLogin}
                className="w-full min-w-80 gap-2"
                disabled={isRedirecting}
              >
                {isRedirecting ? <Spinner size="xs" /> : null}
                Continue to login
              </Button>
            </div>
          )}
        </div>
      </div>
    </SplitScreenLayout>
  );
}

export default MagicLinkCallback;
