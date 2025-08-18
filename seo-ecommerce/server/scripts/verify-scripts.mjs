#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(`\n[verify-scripts] FAIL: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[verify-scripts] WARN: ${msg}`);
}

console.log(
  "[verify-scripts] Running script and documentation consistency checks...",
);

// 1. Check package.json for duplicate script names
const pkgPath = path.resolve(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const scripts = pkg.scripts || {};
const seen = new Set();
for (const name in scripts) {
  if (seen.has(name)) {
    fail(`Duplicate script name found in package.json: "${name}"`);
  }
  seen.add(name);
}

// 2. Check README.md for mentions of critical scripts
const readmePath = path.resolve(process.cwd(), "README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const criticalScripts = ["rollback", "seo:cache:purge", "health", "smoke"];
for (const scriptName of criticalScripts) {
  if (!scripts[scriptName]) {
    warn(
      `Script "${scriptName}" is considered critical but not found in package.json.`,
    );
    continue;
  }
  const regex = new RegExp(`\`${scriptName}\``, "g");
  if (!regex.test(readme)) {
    warn(
      `Critical script "${scriptName}" is not documented in README.md inside backticks.`,
    );
  }
}

// 3. Check for deploy scripts consistency
// Allow deploy:cf to call deploy:cf:fast as long as it also runs predeploy or tests first.
function checkDeployScript(name, fastName) {
  const s = scripts[name];
  if (!s) return;
  if (!s.includes(fastName)) return;
  // If it references the fast variant, ensure predeploy or test is present
  if (!(s.includes("predeploy") || s.includes("test"))) {
    fail(`The \
\`${name}\` script references the fast variant \
\`${fastName}\` but does not run 'predeploy' or 'test' before it.`);
  }
}
checkDeployScript("deploy:cf", "deploy:cf:fast");
checkDeployScript("deploy:full", "deploy:full:fast");

console.log("[verify-scripts] OK: Scripts and documentation are consistent.");
