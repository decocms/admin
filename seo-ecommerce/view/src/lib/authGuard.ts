// Simple client-side auth guard utilities
export function isLoggedIn(): boolean {
  try {
    return !!localStorage.getItem("la-supa-auth");
  } catch {
    return false;
  }
}
export function requireAuth(redirectTo: string = "/login", nextParam = true) {
  if (!isLoggedIn()) {
    const url = nextParam
      ? redirectTo + "?next=" +
        encodeURIComponent(location.pathname + location.search)
      : redirectTo;
    location.replace(url);
    return false;
  }
  return true;
}
export function redirectIfLoggedIn(target: string = "/analise") {
  if (isLoggedIn()) {
    location.replace(target);
    return true;
  }
  return false;
}
