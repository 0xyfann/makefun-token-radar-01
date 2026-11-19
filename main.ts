// SIGNAL's build is deliberately deterministic: the snapshot, never the wall clock,
// supplies every date and value. Preview mode only defers the image-dependent dossier.
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, validateBoard } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = dirname(fileURLToPath(import.meta.url));
function option(key: string, fallback: string): string {
  const args = process.argv.slice(2);
  const inline = args.find(value => value.startsWith(`--${key}=`));
  if (inline) return inline.slice(key.length + 3);
  const index = args.indexOf(`--${key}`);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`--${key} needs a value`);
  return args[index + 1];
}
function copyTree(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  if (!existsSync(source)) return;
  for (const name of readdirSync(source).sort()) {
    if (name.startsWith('.')) continue;
    const from = join(source, name);
    const to = join(destination, name);
    const stat = lstatSync(from);
    if (stat.isDirectory()) copyTree(from, to);
    else if (stat.isFile()) {
      if (resolve(from) !== resolve(to)) copyFileSync(from, to);
    } else throw new Error(`Only regular files are accepted: ${from}`);
  }
}

try {
  const allowed = new Set(['input', 'output', 'preview']);
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--') && !allowed.has(argument.slice(2).split('=')[0])) {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  const input = option('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
  const inputFile = input.endsWith('.json') ? input : join(input, 'snapshot.json');
  const output = resolve(option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
  const preview = process.argv.includes('--preview');
  const snapshot = JSON.parse(readFileSync(inputFile, 'utf8'));
  const radar = buildRadar(snapshot);
  validateBoard(radar.rows, snapshot);
  mkdirSync(output, { recursive: true });
  const boardJson = JSON.stringify({ rows: radar.rows }) + '\n';
  if (Buffer.byteLength(boardJson) > 8_388_608) throw new Error('board.json exceeds 8 MiB');
  writeFileSync(join(output, 'board.json'), boardJson);
  // The page renders exactly the board's plans and values; it does not regenerate them.
  const encoded = JSON.stringify(radar).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  writeFileSync(join(output, 'data.js'), `window.RADAR=${encoded};\n`);
  copyTree(join(root, 'dashboard'), join(output, 'dashboard'));
  copyTree(join(root, 'screenshots'), join(output, 'screenshots'));
  const images = readdirSync(join(output, 'screenshots')).filter(name => !name.startsWith('.'));
  if (preview) {
    console.log('PREVIEW: dossier deferred; add 3–4 real dashboard captures before the final build.');
  } else {
    if (images.length < 3 || images.length > 4) throw new Error(`screenshots/ contains ${images.length} files; final build requires 3–4 real PNG/JPEG captures. Use --preview during development.`);
    const dossier = buildDossier(output, {
      text_max_bytes: 65_536,
      screenshots: { max: 4, max_bytes: 524_288 },
      dashboard: { max_files: 400, max_bytes: 4_194_304 },
    });
    if (dossier.byteLength > 1_572_864) throw new Error('Dossier exceeds the competition limit of 1.5 MiB');
    writeFileSync(join(output, 'dossier.json'), dossier);
  }
  console.log(`SIGNAL: ${radar.rows.length} ranked rows; ${snapshot.watchlist.length} watchlist protocols; ${radar.live.length} recorded-token references. Output: ${output}`);
} catch (error) {
  console.error(`SIGNAL build failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
