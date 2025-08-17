import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('offline dry-run writes audit file', () => {
  const audit = path.join(process.cwd(), 'temp-test-audit.ndjson');
  try {
    if (existsSync(audit)) unlinkSync(audit);
    // run the script in offline dry-run
    execSync(`node scripts/cache-purge.mjs --prefix test-prefix: --dry-run --offline --audit-file ${audit}`, { stdio: 'inherit' });
    expect(existsSync(audit)).toBe(true);
    const content = readFileSync(audit, 'utf8').trim();
    expect(content).toContain('offline');
  } finally {
    try { if (existsSync(audit)) unlinkSync(audit); } catch (_) {}
  }
});
