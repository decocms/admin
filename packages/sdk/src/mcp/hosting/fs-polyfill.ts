import type { Polyfill } from "./api.ts";

const promises = {
  stat(_path: string) {
    throw new Error("FS is not supported on cloudflare workers");
  },
};
function statSync(_path: string) {
  throw new Error("FS is not supported on cloudflare workers");
}

function createReadStream(_path: string) {
  throw new Error("FS is not supported on cloudflare workers");
}

const content = `
export const promises = {
  ${promises.stat.toString()}
}

export ${statSync.toString()}

export ${createReadStream.toString()}

`;

export const polyfill: Polyfill = {
  fileName: "fs-polyfill",
  aliases: ["fs", "node:fs"],
  content,
};
