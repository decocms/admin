import { Navigate } from "@tanstack/react-router";
import { AuthLoading, SignedIn, SignedOut } from "@daveyplate/better-auth-ui";
import { SplashScreen } from "../components/splash-screen";

export default function RequiredAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthLoading>
        <SplashScreen />
      </AuthLoading>

      <SignedIn>{children}</SignedIn>

      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  );
}
