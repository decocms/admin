export const KNOWN_OAUTH_PROVIDERS = {
  google: {
    name: "Google",
    icon: "https://assets.decocache.com/webdraw/eb7480aa-a68b-4ce4-98ff-36aa121762a7/google.svg",
  },
  github: {
    name: "GitHub",
    icon: "https://assets.decocache.com/webdraw/5f999dcb-c8a6-4572-948c-9996ef1d502f/github.svg",
  },
  microsoft: {
    name: "Microsoft",
    icon: "https://assets.decocache.com/mcp/aa6f6e1a-6526-4bca-99cc-82e2ec38b0e4/microsoft.png",
  },
};

export type OAuthProvider = keyof typeof KNOWN_OAUTH_PROVIDERS;
