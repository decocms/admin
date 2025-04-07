import { SplitScreenLayout } from "./layout.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { providers } from "./providers.tsx";
import { useSearchParams } from "react-router";

function Login() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");

  return (
    <SplitScreenLayout>
      <div className="flex flex-col justify-center gap-7 p-6 h-full">
        <div className="text-lg font-semibold leading-none tracking-tight">
          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-col text-center items-center">
              <h2 className="text-xl font-bold max-w-64">
                Welcome to Deco
              </h2>
            </div>
            <p className="text-sm text-muted-foreground font-normal">
              Choose an option to get started
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2.5">
          {providers.map((provider) => {
            return (
              <Button
                key={provider.name}
                variant="outline"
                className="rounded-3xl p-5 min-w-80"
                asChild
              >
                <a
                  href={provider.authURL(next)}
                  className="flex items-center gap-2.5 h-6"
                >
                  <img
                    className={provider.iconClassName}
                    fetchpriority="low"
                    loading="lazy"
                    src={provider.iconURL}
                    alt={provider.name}
                    width={20}
                    height={20}
                  />
                  <span className="text-sm font-semibold">
                    Continue with {provider.name}
                  </span>
                </a>
              </Button>
            );
          })}
        </div>
      </div>
    </SplitScreenLayout>
  );
}

export default Login;
