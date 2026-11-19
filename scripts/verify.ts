// Local structural checks, not a substitute for the sealed make.fun scorer.
// Starter images are used ONLY in an ignored temporary integration fixture.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildDossier } from '../vendor/makefun-board.ts';
import { buildRadar, validateBoard } from '../lib/model.ts';

const root = resolve(import.meta.dirname, '..');
const kit = resolve(process.argv[2] ?? '../kit/token-radar-01-kit');
const snapshotFile = join(kit, 'input/snapshot.json');
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
const radar = buildRadar(snapshot);
validateBoard(radar.rows, snapshot);
const rows = radar.rows;
// Perturb a real row to prove that snapshot figures, not protocol names, drive value.
const baseline = rows[0];
function variant(changes) {
  const changed = structuredClone(snapshot);
  Object.assign(changed.protocols.find(protocol => protocol.slug === baseline.slug), changes);
  return buildRadar(changed).rows.find(row => row.slug === baseline.slug);
}
const sourceProtocol = snapshot.protocols.find(protocol => protocol.slug === baseline.slug);
assert(variant({ tvl_usd: sourceProtocol.tvl_usd * 2 }).implied_value_usd > baseline.implied_value_usd);
assert(variant({ change_7d: 100 }).implied_value_usd > variant({ change_7d: -50 }).implied_value_usd);
assert(variant({ listed_at: snapshot.as_of }).implied_value_usd < variant({ listed_at: '2000-01-01' }).implied_value_usd);
assert.equal(variant({ name: 'Neutral renamed protocol' }).implied_value_usd, baseline.implied_value_usd);
assert.equal(variant({ listed_at: null }).age_days, null);
assert.throws(() => validateBoard(rows.map(row => ({ ...row, implied_value_usd: 1 })), snapshot));
assert.throws(() => validateBoard(rows.filter(row => row.slug !== snapshot.watchlist[0]), snapshot));
assert(rows.length >= 100 && rows.length <= 4000);
assert.equal(new Set(rows.map(row => row.slug)).size, rows.length);
const known = new Map(snapshot.protocols.map(protocol => [protocol.slug, protocol]));
for (const [index, row] of rows.entries()) {
  assert(known.has(row.slug));
  assert.equal(row.rank, index + 1);
  assert(row.name.trim().length > 0);
  assert(Number.isSafeInteger(row.implied_value_usd) && row.implied_value_usd > 0 && row.implied_value_usd <= 1e14);
  if (index) assert(rows[index - 1].implied_value_usd >= row.implied_value_usd);
  assert(row.farm_steps.length >= 3 && row.farm_steps.length <= 12);
  for (const step of row.farm_steps) assert(typeof step === 'string' && step.trim().length >= 20 && step.trim().length <= 600);
}
assert(new Set(rows.map(row => row.implied_value_usd)).size > 1);
for (const slug of snapshot.watchlist) assert(rows.some(row => row.slug === slug), `Missing ${slug}`);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(hash(join(root, 'vendor/makefun-board.ts')), hash(join(kit, 'starter/vendor/makefun-board.ts')));
const files = readdirSync(join(root, 'dashboard'));
assert(files.includes('index.html') && files.some(file => file.endsWith('.css')) && files.some(file => file.endsWith('.js')));
let dashboardBytes = 0;
for (const file of files) {
  assert(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(file));
  const path = join(root, 'dashboard', file);
  const source = readFileSync(path, 'utf8');
  dashboardBytes += statSync(path).size;
  assert(!/https?:\/\//i.test(source), `Network address in ${file}`);
  if (file.endsWith('.js')) run(['--check', path]);
}
assert(dashboardBytes < 64000 && files.length <= 400);
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const fixture = mkdtempSync(join(root, '.verify-'));
const source = join(fixture, 'entry');
mkdirSync(source);
for (const item of ['main.ts', 'lib', 'vendor', 'dashboard']) cpSync(join(root, item), join(source, item), { recursive: true });
cpSync(join(kit, 'starter/screenshots'), join(source, 'screenshots'), { recursive: true });
const first = join(fixture, 'first');
const second = join(fixture, 'second');
run([join(source, 'main.ts'), '--input', snapshotFile, '--output', first]);
run([join(source, 'main.ts'), '--input', snapshotFile, '--output', second]);
function manifest(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name);
    const relative = prefix + name;
    return statSync(path).isDirectory() ? manifest(path, relative + '/') : [[relative, hash(path)]];
  });
}
assert.deepEqual(manifest(first), manifest(second), 'Build outputs are not deterministic');
assert(statSync(join(first, 'board.json')).size <= 8 * 1024 * 1024);
assert.deepEqual(JSON.parse(readFileSync(join(first, 'board.json'), 'utf8')).rows, rows);
const expected = buildDossier(first, { text_max_bytes: 65536 });
assert(Buffer.from(expected).equals(readFileSync(join(first, 'dossier.json'))));
assert(expected.byteLength <= 1.5 * 1024 * 1024);
const dossier = JSON.parse(Buffer.from(expected).toString());
assert(!dossier.text.includes('[Cut at'));
copyFileSync(join(source, 'screenshots/1-board.png'), join(source, 'screenshots/4-fixture.png'));
run([join(source, 'main.ts'), '--input', snapshotFile, '--output', join(fixture, 'four-images')]);
assert.equal(JSON.parse(readFileSync(join(fixture, 'four-images/dossier.json'), 'utf8')).images.length, 4);
const absent = readdirSync(join(root, 'screenshots')).filter(name => !name.startsWith('.'));
assert.equal(absent.length, 0, 'Brief requires actual screenshots to be added later');
const missingShots = spawnSync(process.execPath, [join(root, 'main.ts'), '--input', snapshotFile, '--output', join(fixture, 'missing-images')], { encoding: 'utf8' });
assert.equal(missingShots.status, 1);
assert(missingShots.stderr.includes('requires 3–4 real PNG/JPEG captures'));
assert(!existsSync(join(fixture, 'missing-images/dossier.json')));
run([join(root, 'main.ts'), '--preview', '--input', snapshotFile, '--output', join(root, 'out')]);
copyFileSync(join(root, 'out/board.json'), join(root, 'board.json'));
run(['--check', join(root, 'out/data.js')]);
const report = {
  rows: rows.length,
  watchlist: snapshot.watchlist.length,
  covered: snapshot.watchlist.filter(slug => rows.some(row => row.slug === slug)).length,
  outside_watchlist: rows.filter(row => !snapshot.watchlist.includes(row.slug)).length,
  live_references: radar.live.length,
  dashboard_files: files.length,
  dashboard_bytes: dashboardBytes,
  board_bytes: statSync(join(first, 'board.json')).size,
  fixture_dossier_bytes: expected.byteLength,
  deterministic: true,
  dossier_matches_fixture: true,
  screenshot_counts_tested: [3, 4],
  actual_screenshots: 'Deferred per brief; fixture images are not submission images',
  fixture_directory: fixture,
};
writeFileSync(join(root, 'out/verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
