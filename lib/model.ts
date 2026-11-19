// Token-radar model. All selections and scores are derived from the supplied snapshot.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

type ProtocolFields = SnapshotProtocol;

export interface ModelDetail {
  base_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

export interface BoardRow extends ProtocolFields {
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  model: ModelDetail;
  capital_usd: number;
  hold_days: number;
  risk_note: string;
}

export interface LiveRow extends ProtocolFields {
  rank: null;
  implied_value_usd: null;
  farm_steps: string[];
  token_status: 'recorded';
}

export interface RadarMeta {
  as_of: string;
  source: string;
  floor_usd: number;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  model_version: string;
  formula: string;
}

export interface Radar {
  rows: BoardRow[];
  live: LiveRow[];
  meta: RadarMeta;
}

const MODEL_VERSION = 'token-radar-v2';
const BASE_MULTIPLE = 0.35;
const FORMULA = 'TVL * 0.35 * (1 + clamp(change_7d, -50, 100) / 200) * (0.65 + 0.35 * min(age_days, 1095) / 1095); age defaults to 365 when listed_at is missing; age is listing-age proxy, not proven token age.';
const DAY_MS = 86_400_000;
const VERSION_SUFFIX = /\s(?:v?\d+(?:\.\d+)?)$/i;
const WRAPPED_OR_STAKED = /\b(?:wrapped|staked|bridged|bridge|w(?:btc|eth|sol)|liquid staking)\b/i;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function preToken(protocol: SnapshotProtocol): boolean {
  return protocol.mcap_usd === null && protocol.gecko_id === null && protocol.symbol === null;
}

function eligible(protocol: SnapshotProtocol): boolean {
  if (!preToken(protocol)) return false;
  // Apply product-type exclusions to extras; the supplied watchlist remains authoritative.
  const excludedCategories = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
  if (excludedCategories.has(protocol.category ?? '')) return false;
  const exchangeProduct = /^(?:Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
  return !exchangeProduct.test(protocol.name) && !VERSION_SUFFIX.test(protocol.name) && !WRAPPED_OR_STAKED.test(protocol.name);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

// Implied value = round(TVL × 0.35 × (1 + clamp(growth7d, -50, 100)/200)
//                       × (0.65 + 0.35 × min(listingAgeDays,1095)/1095)).
// These are explicit valuation assumptions, not market-fitted coefficients. Missing
// growth is neutral (0%) and missing listing age uses 365 days, while UI age stays null.
// Listing age measures DefiLlama tracking history, not proven launch or token age.
function score(protocol: SnapshotProtocol, snapshot: Snapshot): { value: number; age: number | null; growth: number; growthMultiplier: number; maturityMultiplier: number } {
  const age = ageDays(snapshot.as_of, protocol.listed_at);
  const growth = Math.min(100, Math.max(-50, isFiniteNumber(protocol.change_7d) ? protocol.change_7d : 0));
  const growthMultiplier = 1 + growth / 200;
  const modelAge = age === null ? 365 : age;
  const maturityMultiplier = 0.65 + 0.35 * Math.min(modelAge, 1095) / 1095;
  const value = Math.max(1, Math.round(protocol.tvl_usd * BASE_MULTIPLE * growthMultiplier * maturityMultiplier));
  return { value, age, growth, growthMultiplier, maturityMultiplier };
}

function capitalFor(protocol: SnapshotProtocol): number {
  if (protocol.tvl_usd >= 1_000_000_000) return 250;
  if (protocol.tvl_usd >= 100_000_000) return 150;
  if (protocol.tvl_usd >= 50_000_000) return 100;
  return 50;
}

function holdFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function chain(protocol: SnapshotProtocol): string {
  return protocol.chains[0] ?? 'the listed chain';
}

function actionFor(protocol: SnapshotProtocol, capital: number): string {
  const category = (protocol.category ?? '').toLowerCase();
  const place = `${protocol.name} on ${chain(protocol)}`;
  if (category.includes('lend') || category.includes('cdp') || category.includes('collateral')) return `If the official app supports it, supply about $${capital} of a supported stablecoin to ${place}; verify asset, chain, and rewards first.`;
  if (category.includes('dex') || category.includes('yield') || category.includes('farm')) return `If an official pool is available, provide about $${capital} of liquidity to ${place}; verify the pool, pair, and incentive terms first.`;
  if (category.includes('bridge')) return `Only if an official campaign is documented, bridge at most $${capital} through ${place}; verify destination, limits, and fees first.`;
  if (category.includes('staking') || category.includes('restak')) return `If official staking is supported, stake at most $${capital} of the documented asset through ${place}; verify lockups and receipt terms first.`;
  if (category.includes('derivative') || category.includes('perp')) return `Only if permitted and understood, make one small, fully collateralized test on ${place}; verify contracts, leverage, and liquidation rules first.`;
  return `If the official product supports a qualifying action, test with no more than $${capital} at ${place}; verify the action, asset, and reward terms first.`;
}

function farmSteps(protocol: SnapshotProtocol, age: number | null): string[] {
  const capital = capitalFor(protocol);
  const hold = holdFor(age);
  return [
    `Check the protocol's official documentation and current domain before connecting; this snapshot does not prove a campaign, points program, or eligibility. Cost: no deposit; time: 10 minutes.`,
    `Use a fresh wallet with only the test budget and confirm the chain, contract address, and gas token from official sources. Cost: under $5 of gas where applicable; time: 10 minutes.`,
    actionFor(protocol, capital) + ` Capital: $${capital}; fees: estimate $1–15 depending on chain; time: 15 minutes. Approve only the required amount.`,
    `Record the transaction hash, wallet, amount, and date; do not assume a transaction qualifies until the protocol confirms it. Cost: no additional capital; time: 5 minutes.`,
    `Review official terms weekly and keep the position for about ${hold} days only if risk, liquidity, and exit conditions remain acceptable. Cost: $${capital} remains exposed; time: ${hold} days.`,
    `Before claiming or withdrawing, verify the official URL, revoke unused approvals, and exit if terms or liquidity change. Cost: network fee varies; time: 10 minutes.`
  ];
}

function riskNote(protocol: SnapshotProtocol, age: number | null): string {
  const trend = isFiniteNumber(protocol.change_7d) && protocol.change_7d < 0 ? 'TVL is falling over 7 days, so reassess liquidity and exit risk.' : 'TVL and growth are snapshot observations, not guarantees.';
  const ageText = age === null ? 'Listing age is unavailable; the model uses a 365-day proxy.' : 'Age is time since listing, not proven token age.';
  return `${trend} ${ageText} No token launch, reward, eligibility, asset support, or safety is confirmed; verify official terms, contracts, permissions, liquidity, and fees before acting.`;
}

function fields(protocol: SnapshotProtocol): ProtocolFields {
  return {
    slug: protocol.slug,
    name: protocol.name,
    category: protocol.category,
    chains: [...protocol.chains],
    tvl_usd: protocol.tvl_usd,
    change_7d: protocol.change_7d,
    mcap_usd: protocol.mcap_usd,
    listed_at: protocol.listed_at,
    gecko_id: protocol.gecko_id,
    symbol: protocol.symbol
  };
}

export function buildRadar(snapshot: Snapshot): Radar {
  const bySlug = new Map(snapshot.protocols.map((protocol) => [protocol.slug, protocol]));
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const protocol = bySlug.get(slug);
    if (protocol !== undefined && preToken(protocol)) chosen.set(slug, protocol);
  }
  const eligibleExtras = snapshot.protocols
    .filter((protocol) => !chosen.has(protocol.slug) && eligible(protocol))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug));
  const targetTotal = Math.min(chosen.size + eligibleExtras.length, 200);
  const targetExtras = Math.max(0, targetTotal - chosen.size);
  for (const protocol of eligibleExtras.slice(0, targetExtras)) chosen.set(protocol.slug, protocol);

  const ranked = [...chosen.values()].map((protocol) => ({ protocol, scored: score(protocol, snapshot) }))
    .sort((a, b) => b.scored.value - a.scored.value || a.protocol.slug.localeCompare(b.protocol.slug));
  const rows = ranked.map(({ protocol, scored }, index): BoardRow => ({
    ...fields(protocol),
    rank: index + 1,
    implied_value_usd: scored.value,
    farm_steps: farmSteps(protocol, scored.age),
    token_status: 'pre-token',
    watchlist: watch.has(protocol.slug),
    age_days: scored.age,
    model: { base_multiple: BASE_MULTIPLE, growth_multiplier: round4(scored.growthMultiplier), maturity_multiplier: round4(scored.maturityMultiplier) },
    capital_usd: capitalFor(protocol),
    hold_days: holdFor(scored.age),
    risk_note: riskNote(protocol, scored.age)
  }));

  const live = snapshot.protocols.filter((protocol) => !preToken(protocol))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug))
    .map((protocol): LiveRow => ({ ...fields(protocol), rank: null, implied_value_usd: null, farm_steps: farmSteps(protocol, ageDays(snapshot.as_of, protocol.listed_at)), token_status: 'recorded' }));

  return {
    rows,
    live,
    meta: { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd, watchlist_size: snapshot.watchlist.length, board_size: rows.length, live_size: live.length, model_version: MODEL_VERSION, formula: FORMULA }
  };
}

export function validateBoard(rows: BoardRow[], snapshot: Snapshot): void {
  if (!Array.isArray(rows) || rows.length < 100 || rows.length > 4000) throw new Error('board size must be 100..4000');
  const index = new Map(snapshot.protocols.map((protocol) => [protocol.slug, protocol]));
  const seen = new Set<string>();
  const ranks = new Set<number>();
  if (new Set(rows.map(row => row.implied_value_usd)).size < 2) throw new Error('board must rank different implied values');
  for (const row of rows) {
    if (!/^[^\s]{1,128}$/.test(row.slug) || !row.name.trim()) throw new Error('invalid slug or name');
    if (!Number.isSafeInteger(row.rank) || !Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0 || row.implied_value_usd > 1e14) throw new Error(`invalid rank or value: ${row.slug}`);
    const source = index.get(row.slug);
    if (source === undefined) throw new Error(`unknown protocol: ${row.slug}`);
    if (seen.has(row.slug) || ranks.has(row.rank) || row.rank < 1 || row.rank > rows.length) throw new Error(`duplicate or invalid rank/slug: ${row.slug}`);
    seen.add(row.slug); ranks.add(row.rank);
    if (row.token_status !== 'pre-token' || !preToken(source) || row.watchlist !== snapshot.watchlist.includes(row.slug)) throw new Error(`invalid token/watchlist state: ${row.slug}`);
    if (!row.watchlist && !eligible(source)) throw new Error(`ineligible extra protocol: ${row.slug}`);
    if (row.name !== source.name || row.category !== source.category || row.tvl_usd !== source.tvl_usd || row.change_7d !== source.change_7d || row.mcap_usd !== source.mcap_usd || row.listed_at !== source.listed_at || row.gecko_id !== source.gecko_id || row.symbol !== source.symbol || JSON.stringify(row.chains) !== JSON.stringify(source.chains)) throw new Error(`protocol fields differ from snapshot: ${row.slug}`);
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12 || row.farm_steps.some((step) => typeof step !== 'string' || step.trim().length < 20 || step.trim().length > 600)) throw new Error(`invalid farm steps: ${row.slug}`);
    const expected = score(source, snapshot);
    if (row.implied_value_usd !== expected.value || row.model.base_multiple !== BASE_MULTIPLE || Math.abs(row.model.growth_multiplier - expected.growthMultiplier) > 0.0001 || Math.abs(row.model.maturity_multiplier - expected.maturityMultiplier) > 0.0001) throw new Error(`invalid model output: ${row.slug}`);
  }
  for (let rank = 1; rank <= rows.length; rank += 1) if (!ranks.has(rank)) throw new Error(`missing rank ${rank}`);
  for (const slug of snapshot.watchlist) if (!seen.has(slug)) throw new Error(`watchlist coverage missing: ${slug}`);
  for (let i = 1; i < rows.length; i += 1) if (rows[i - 1]!.implied_value_usd < rows[i]!.implied_value_usd) throw new Error('rows are not sorted by implied value');
}
