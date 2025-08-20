export * from "./singleflight.ts";

export const AppName = {
  build: (scopeName: string, name: string) => `@${scopeName}/${name}`,
  parse: (appName: string) => {
    const parts = appName.split("/");
    return {
      scopeName: parts[0],
      name: parts[1],
    };
  },
};
