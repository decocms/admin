import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const target = resolve(root, 'seo-ecommerce/server/deco.gen.ts');

try {
  let src = await readFile(target, 'utf8');

  // Se já começa com comentário, não faz nada.
  const startsWithComment = /^\s*\/[/*]/.test(src);
  if (startsWithComment) {
    console.log('[fix-deco-gen] No changes (already commented).');
    process.exit(0);
  }

  // Encontra o primeiro import/export (início do TS válido)
  const match = src.match(/^\s*(import|export)\s/m);
  if (!match) {
    src = `/*\n${src}\n*/\n`;
  } else {
    const header = src.slice(0, match.index);
    const rest = src.slice(match.index);
    src = `/*\n${header.trimEnd()}\n*/\n${rest}`;
  }

  await writeFile(target, src, 'utf8');
  console.log('[fix-deco-gen] Applied header comment to deco.gen.ts');
} catch (err) {
  console.error('[fix-deco-gen] Failed:', err.message);
  process.exit(1);
}
