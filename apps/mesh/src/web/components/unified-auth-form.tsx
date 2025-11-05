import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthConfig } from "../providers/auth-config-provider";
import { authClient } from "../lib/auth-client";

export function UnifiedAuthForm() {
  const { emailAndPassword, magicLink, socialProviders } = useAuthConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const magicLinkMutation = useMutation({
    mutationFn: async (email: string) => {
      await authClient.signIn.magicLink({ email });
    },
    onSuccess: () => {
      setEmail("");
    },
  });

  const emailPasswordMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: { email: string; password: string }) => {
      await authClient.signIn.email({ email, password });
    },
  });

  const socialSignInMutation = useMutation({
    mutationFn: async (providerId: string) => {
      await authClient.signIn.social({
        provider: providerId,
        callbackURL: window.location.origin,
      });
    },
  });

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    magicLinkMutation.mutate(email);
  };

  const handleEmailPassword = (e: React.FormEvent) => {
    e.preventDefault();
    emailPasswordMutation.mutate({ email, password });
  };

  const handleSocialSignIn = (providerId: string) => {
    socialSignInMutation.mutate(providerId);
  };

  const isLoading =
    magicLinkMutation.isPending ||
    emailPasswordMutation.isPending ||
    socialSignInMutation.isPending;

  const error =
    magicLinkMutation.error ||
    emailPasswordMutation.error ||
    socialSignInMutation.error;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-lg">
      {/* Logo */}
      <div className="flex justify-start">
        <div className="rounded-full bg-[#84cc16] px-4 py-2">
          <span className="font-bold text-white">deco</span>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to deco</h1>
        <p className="text-gray-600">Sign in or create a new account</p>
      </div>

      {/* Social providers */}
      {socialProviders.enabled && (
        <div className="space-y-3">
          {socialProviders.providers.map((provider) => (
            <button
              key={provider.name}
              onClick={() => handleSocialSignIn(provider.name)}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {provider.icon && (
                <img
                  src={provider.icon}
                  alt={provider.name}
                  className="h-5 w-5"
                />
              )}
              Continue with{" "}
              {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      {socialProviders.enabled &&
        (emailAndPassword.enabled || magicLink.enabled) && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>
        )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "An error occurred"}
        </div>
      )}

      {/* Success message */}
      {magicLinkMutation.isSuccess && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Check your email for a magic link to sign in!
        </div>
      )}

      {/* Magic Link Form */}
      {magicLink.enabled && !emailAndPassword.enabled && (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base transition-colors focus:border-[#84cc16] focus:outline-none focus:ring-2 focus:ring-[#84cc16] focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#84cc16] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#75b812] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {magicLinkMutation.isPending ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}

      {/* Email & Password Form */}
      {emailAndPassword.enabled && (
        <form onSubmit={handleEmailPassword} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base transition-colors focus:border-[#84cc16] focus:outline-none focus:ring-2 focus:ring-[#84cc16] focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base transition-colors focus:border-[#84cc16] focus:outline-none focus:ring-2 focus:ring-[#84cc16] focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#84cc16] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#75b812] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emailPasswordMutation.isPending ? "Signing in..." : "Sign in"}
          </button>

          {magicLink.enabled && (
            <div className="text-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (email) {
                    handleMagicLink(e);
                  }
                }}
                disabled={isLoading || !email}
                className="text-sm text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Or send me a magic link
              </button>
            </div>
          )}
        </form>
      )}

      {/* Terms */}
      <p className="text-center text-xs text-gray-600">
        By continuing, you agree to deco's Terms of Service and Privacy Policy,
        and to receive periodic emails with updates.
      </p>
    </div>
  );
}
