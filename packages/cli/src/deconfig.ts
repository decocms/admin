#!/usr/bin/env node

import { deconfig } from "./commands.js";

(async () => {
  try {
    await deconfig.parseAsync();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
