/**
 * Package information - inlined at build time by tsup
 * This avoids runtime file reading which breaks when bundled
 */
import packageJson from "../../package.json";

export const packageInfo = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
};
