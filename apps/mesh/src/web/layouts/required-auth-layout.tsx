import { Outlet, Navigate } from "@tanstack/react-router";
import { AuthLoading, SignedIn, SignedOut } from "@daveyplate/better-auth-ui";
import { SplashScreen } from "../components/splash-screen";

export default function RequiredAuthLayout() {
  return (
    <>
      <AuthLoading>
        <SplashScreen />
      </AuthLoading>

      <SignedIn>
        <Outlet />
      </SignedIn>

      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  );
}
