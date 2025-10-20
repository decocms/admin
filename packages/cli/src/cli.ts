#!/usr/bin/env node

import { program } from "./commands.js";

(async () => {
  try {
    await program.parseAsync();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
