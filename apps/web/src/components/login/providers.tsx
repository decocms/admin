import { AUTH_URL } from "@deco/sdk";

export interface Provider {
  name: string;
  iconURL: string;
  authURL: (next?: string | null) => string;
  iconClassName?: string;
}

export const providers: Provider[] = [
  {
    name: "Google",
    iconURL:
      "https://assets.decocache.com/webdraw/eb7480aa-a68b-4ce4-98ff-36aa121762a7/google.svg",
    authURL: (next) => {
      const url = new URL(AUTH_URL);
      url.pathname = "/login/oauth";
      url.searchParams.set("provider", "google");
      if (next) {
        url.searchParams.set("next", next);
      }
      return url.toString();
    },
  },
  {
    name: "GitHub",
    iconURL:
      "https://assets.decocache.com/webdraw/5f999dcb-c8a6-4572-948c-9996ef1d502f/github.svg",
    authURL: (next) => {
      const url = new URL(AUTH_URL);
      url.pathname = "/login/oauth";
      url.searchParams.set("provider", "github");
      if (next) {
        url.searchParams.set("next", next);
      }
      return url.toString();
    },
    iconClassName: "invert dark:invert-0",
  },
  {
    name: "Email",
    iconURL:
      "https://assets.decocache.com/webdraw/15eec989-84bc-4905-a8e3-3beadf1e13c1/email.svg",
    authURL: (next) => {
      const url = new URL(AUTH_URL);
      url.pathname = "/login/magiclink";
      if (next) {
        url.searchParams.set("next", next);
      }
      return url.toString();
    },
    iconClassName: "invert dark:invert-0",
  },
  // TODO: Add back when we properly support those players (now we allow them via email)
  // {
  //   name: "Discord",
  //   id: "discord",
  // },
];
