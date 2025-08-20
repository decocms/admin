import { SplitScreenLayout } from "./layout.tsx";
import { providers } from "./providers.tsx";
import { useSearchParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useEffect, useState } from "react";

function Login() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const cli = searchParams.has("cli");

  // State for last used login method
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null);

  useEffect(() => {
    setLastLoginMethod(localStorage.getItem("lastLoginMethod"));
  }, []);

  const handleProviderClick = (providerName: string) => {
    localStorage.setItem("lastLoginMethod", providerName);
    trackEvent("deco_chat_login_provider_click", {
      provider: providerName,
    });
  };

  const filteredProviders = providers.filter((provider) => {
    // Disable email provider when &cli=true is present
    // Note: CLI login with email redirects incorrectly to admin.deco.cx instead of the deco.chat
    // TODO: A better solution
    if (cli && provider.name === "Email") {
      return false;
    }
    return true;
  });

  return (
    <SplitScreenLayout>
      <div className="flex flex-col gap-6 items-center justify-center px-4 py-[140px] h-full">
        <div className="flex flex-col gap-1 items-center text-center">
          <h2 className="text-2xl font-semibold text-foreground leading-8">
            Welcome to deco
          </h2>
          <p className="text-2xl font-semibold text-muted-foreground leading-8">
            Your Context Management System
          </p>
        </div>
        
        <p className="text-sm text-muted-foreground font-normal leading-5">
          Choose an option to get started
        </p>
        
        <div className="flex flex-col gap-2 w-[300px]">
          {filteredProviders.map((provider) => {
            const isLastUsed = provider.name === lastLoginMethod;
            return (
              <button
                key={provider.name}
                onClick={() => {
                  handleProviderClick(provider.name);
                  window.location.href = provider.authURL({
                    next: next || globalThis.location.origin,
                    cli,
                  });
                }}
                className={`
                  bg-white flex flex-row gap-3 items-center justify-center 
                  px-3 py-4 rounded-full border border-border 
                  hover:bg-muted/50 transition-colors relative w-full
                  ${isLastUsed ? 'ring-2 ring-primary-light border-primary-light' : ''}
                `}
              >
                <img
                  className={provider.iconClassName || "w-5 h-5"}
                  loading="lazy"
                  src={provider.iconURL}
                  alt={provider.name}
                  width={20}
                  height={20}
                />
                <span className="text-sm font-medium text-foreground leading-5">
                  Continue with {provider.name}
                </span>
                {isLastUsed && (
                  <span className="absolute -top-2 -right-2 text-xs font-medium text-primary-dark bg-primary-light px-2 py-0.5 rounded-full">
                    Last
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-muted-foreground text-center leading-4">
          By using deco.chat you agree to our{" "}
          <a 
            href="https://deco.cx/termos-de-uso" 
            className="text-foreground hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            terms of use
          </a>
          .
        </p>
      </div>
    </SplitScreenLayout>
  );
}

export default Login;
