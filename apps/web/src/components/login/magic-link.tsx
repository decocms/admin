import { Button } from "@deco/ui/components/button.tsx";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { DECO_CMS_API_URL } from "@deco/sdk";
import type { FormEventHandler } from "react";
import { useEffect, useState } from "react";
import { SplitScreenLayout } from "./layout.tsx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const useSendMagicLink = () => {
  const create = useMutation({
    mutationFn: (prop: { email: string; cli: boolean }) =>
      fetch(new URL("/login/magiclink", DECO_CMS_API_URL), {
        method: "POST",
        body: JSON.stringify(prop),
      })
        .then((res) => res.ok)
        .catch(() => false),
  });

  return create;
};

function MagicLink() {
  const fetcher = useSendMagicLink();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailFromUrl = searchParams.get("email") || "";
  const [email] = useState(emailFromUrl);
  const next = searchParams.get("next");

  // Validate email is present and matches a simple email pattern
  const isValidEmail = email && EMAIL_REGEX.test(email);

  // Redirect to /login if email is missing or invalid
  useEffect(() => {
    if (!isValidEmail) {
      navigate(`/login${next ? `?next=${next}` : ""}`, { replace: true });
    }
  }, [isValidEmail, navigate, next]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    // Guard: never submit with empty or invalid email
    if (!isValidEmail) {
      return;
    }

    fetcher.mutate({ email, cli: searchParams.get("cli") === "true" });
  };

  // Don't render the form if email is invalid (will redirect anyway)
  if (!isValidEmail) {
    return null;
  }

  return (
    <SplitScreenLayout>
      <div className="flex flex-col h-full px-6 py-8 sm:px-10 sm:py-12 md:px-14 md:py-16 overflow-y-auto">
        {/* Back button at top */}
        <Button
          variant="ghost"
          asChild
          className="text-muted-foreground self-start mb-8"
          size="sm"
        >
          <Link to={`/login${next ? `?next=${next}` : ""}`}>
            <Icon name="arrow_back" size={16} />
            Back to login options
          </Link>
        </Button>

        {/* Centered content */}
        <div className="flex flex-col gap-12 flex-1 justify-center">
          <form method="post" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl sm:text-2xl font-medium">
                  Check your email
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground font-medium break-all">
                  {email}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click on the link sent to your email to complete your signup.
                <br />
                If you don't see it, you may need to
                <span className="font-semibold px-1">check your spam</span>
                folder.
              </p>
              <Button
                type="submit"
                className="h-12 bg-primary text-primary-foreground rounded-xl gap-2 mt-2"
                disabled={fetcher.isPending}
              >
                {fetcher.isPending ? <Spinner size="xs" /> : null}
                Resend verification email
              </Button>
            </div>
          </form>
        </div>
      </div>
    </SplitScreenLayout>
  );
}

const client = new QueryClient({});

export default function MagicLinkWrapper() {
  return (
    <QueryClientProvider client={client}>
      <MagicLink />
    </QueryClientProvider>
  );
}
