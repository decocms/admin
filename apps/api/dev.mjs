#!/usr/bin/env node
import { spawn } from "child_process";

const wrangler = spawn("wrangler", ["dev", "--port", "3001"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});

// Process stdout and filter out [wrangler:info] lines
wrangler.stdout.on("data", (data) => {
  const text = data.toString();
  // Filter out lines containing [wrangler:info]
  const filtered = text
    .split("\n")
    .filter((line) => !line.includes("[wrangler:info]"))
    .join("\n");

  if (filtered) {
    process.stdout.write(filtered);
  }
});

// Pass through stderr as-is
wrangler.stderr.pipe(process.stderr);

wrangler.on("close", (code) => {
  process.exit(code || 0);
});

// Handle termination signals
process.on("SIGINT", () => {
  wrangler.kill("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  wrangler.kill("SIGTERM");
  process.exit(0);
});
