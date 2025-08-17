#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "src", "rules");
const dest = path.join(__dirname, "..", "dist", "rules");
if (!fs.existsSync(src)) process.exit(0);
fs.mkdirSync(dest, { recursive: true });
for (const entry of fs.readdirSync(src)) {
  const from = path.join(src, entry);
  const to = path.join(dest, entry);
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) {
      fs.copyFileSync(path.join(from, f), path.join(to, f));
    }
  } else {
    fs.copyFileSync(from, to);
  }
}
console.log("[deco-cli] Copied rules directory.");
