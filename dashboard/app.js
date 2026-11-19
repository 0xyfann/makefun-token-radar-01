(() => {
  'use strict';

  const data = window.RADAR;
  const $ = (id) => document.getElementById(id);
  const state = { status: 'pre-token', query: '', chain: '', category: '', watchOnly: false, sort: 'rank', direction: 1, current: null };
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const live = Array.isArray(data?.live) ? data.live : [];
  const all = [...rows, ...live];
  const number = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const usd = (value, compact = true) => {
    const n = number(value);
    if (n === null) return '—';
    if (!compact) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
  };
  const pct = (value) => {
    const n = number(value);
    if (n === null) return '—';
    return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  };
  const safe = (value, fallback = '—') => value === null || value === undefined || value === '' ? fallback : String(value);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const setText = (id, value) => { $(id).textContent = value; };
  const fmtDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }).format(date);
  };
  const chainsOf = (item) => Array.isArray(item.chains) ? item.chains : (item.chains ? [item.chains] : []);
  const isLive = (item) => item.token_status === 'recorded';
  const valuation = (item) => isLive(item) ? number(item.mcap_usd) : number(item.implied_value_usd);
  const getView = () => new URLSearchParams(location.hash.slice(1)).get('view') || 'radar';
  const getProtocol = () => new URLSearchParams(location.hash.slice(1)).get('protocol');

  function initSnapshot() {
    if (!data || !Array.isArray(data.rows) || !Array.isArray(data.live)) {
      showDataError();
      return;
    }
    setText('asOf', fmtDate(data.meta?.as_of));
    const sourceName = safe(data.meta?.source, 'LOCAL SNAPSHOT');
    setText('sourceLabel', 'DEFILLAMA · SEALED');
    $('sourceLabel').title = sourceName;
    setText('modelVersion', safe(data.meta?.model_version, 'INTELLIGENCE'));
    setText('indexNumber', String(all.length).padStart(2, '0'));
    setText('metricRadar', String(rows.length));
    setText('metricWatch', safe(data.meta?.watchlist_size, String(rows.filter((r) => r.watchlist).length)));
    setText('metricLive', safe(data.meta?.live_size, String(live.length)));
    setText('metricFloor', usd(data.meta?.floor_usd));
    setText('navBoardCount', rows.length);
    setText('navWatchCount', rows.filter((r) => r.watchlist).length);
    setText('footerMeta', `MODEL ${safe(data.meta?.model_version, '—')}`);
    $('formulaText').textContent = safe(data.meta?.formula, 'Implied value = TVL × base multiple × growth multiplier × maturity multiplier');
    populateOptions();
  }

  function showDataError() {
    document.querySelector('.page-heading').hidden = true;
    document.querySelector('.metrics').hidden = true;
    document.querySelector('.chart-section').hidden = true;
    document.querySelector('.table-section').hidden = true;
    const error = make('section', 'load-error');
    error.setAttribute('role', 'alert');
    error.append(make('span', 'empty-symbol', '×'), make('h1', '', 'Snapshot unavailable'), make('p', '', 'No usable local protocol data was found. SIGNAL runs entirely from the adjacent data.js snapshot; check that it is present and exports window.RADAR with rows, live, and meta.'));
    document.querySelector('.content').prepend(error);
    setText('asOf', 'NO DATA');
  }

  function populateOptions() {
    const chains = [...new Set(all.flatMap(chainsOf).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    const categories = [...new Set(all.map((r) => r.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    for (const value of chains) $('chainFilter').append(new Option(value, value));
    for (const value of categories) $('categoryFilter').append(new Option(value, value));
  }

  function activeRows() {
    const source = state.status === 'recorded' ? live : rows;
    const q = state.query.trim().toLocaleLowerCase();
    const sortKey = state.status === 'recorded' ? (state.sort === 'rank' ? 'market' : state.sort) : state.sort;
    return source.filter((item) => {
      const matchesQuery = !q || [item.name, item.slug, item.category, ...chainsOf(item)].some((v) => String(v || '').toLocaleLowerCase().includes(q));
      return matchesQuery && (!state.chain || chainsOf(item).includes(state.chain)) && (!state.category || item.category === state.category) && (!(state.watchOnly || getView() === 'watchlist') || item.watchlist === true);
    }).sort((a, b) => {
      const key = sortKey === 'rank' ? 'rank' : sortKey === 'value' || sortKey === 'market' ? 'market' : sortKey === 'growth' ? 'change_7d' : sortKey === 'tvl' ? 'tvl_usd' : sortKey;
      const av = key === 'market' ? valuation(a) : number(a[key]);
      const bv = key === 'market' ? valuation(b) : number(b[key]);
      if (state.sort === 'name') return String(a.name || '').localeCompare(String(b.name || '')) * state.direction;
      if (av === null && bv === null) return String(a.name || '').localeCompare(String(b.name || ''));
      if (av === null) return 1;
      if (bv === null) return -1;
      const direction = state.status === 'recorded' && state.sort === 'rank' ? -1 : state.sort === 'rank' ? 1 : state.direction;
      return (av - bv) * direction;
    });
  }

  function render() {
    if (!data?.rows || !data?.live) return;
    const items = activeRows();
    const liveView = state.status === 'recorded';
    const body = $('protocolRows');
    body.replaceChildren();
    for (const [i, item] of items.entries()) body.append(buildRow(item, i, liveView));
    $('emptyState').hidden = items.length !== 0;
    $('resultCount').textContent = `(${items.length})`;
    setText('footerCount', `SHOWING ${items.length} OF ${(liveView ? live : rows).length} PROTOCOLS`);
    $('resetButton').hidden = !hasActiveFilters();
    $('valueHeader').innerHTML = '';
    $('valueHeader').append(document.createTextNode(liveView ? 'RECORDED MARKET CAP ' : 'IMPLIED VALUE '));
    const hint = make('span', 'header-info', 'ⓘ');
    hint.title = liveView ? 'Recorded market capitalization where supplied' : 'Modeled estimate, not market cap';
    $('valueHeader').append(hint);
    document.querySelectorAll('.view-tab').forEach((button) => {
      const selected = button.dataset.status === state.status;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    updateHeader();
    updateSortIndicators();
  }

  function buildRow(item, i, liveView) {
    const tr = make('tr', 'protocol-row');
    tr.tabIndex = 0;
    tr.setAttribute('aria-label', `Open ${safe(item.name)} protocol details`);
    const rank = make('td', 'rank-cell', item.rank == null ? '—' : String(item.rank));
    const protocol = make('td', '');
    const wrap = make('div', 'protocol-cell');
    const avatar = make('span', 'protocol-avatar', (safe(item.name, '?').trim().slice(0, 1) || '?').toUpperCase());
    avatar.setAttribute('aria-hidden', 'true');
    const names = make('span', '');
    names.append(make('span', 'protocol-name', safe(item.name)));
    const meta = make('span', 'protocol-meta');
    meta.append(make('span', 'chain-tag', chainsOf(item).join(' · ') || 'Chain n/a'));
    if (item.watchlist) meta.append(make('span', 'watch-star', '★'));
    names.append(meta); wrap.append(avatar, names); protocol.append(wrap);
    const category = make('td', '');
    category.append(make('span', 'category-tag', safe(item.category, 'Unclassified')));
    const tvl = make('td', 'number-cell', usd(item.tvl_usd));
    const change = make('td', `number-cell ${number(item.change_7d) > 0 ? 'growth-positive' : number(item.change_7d) < 0 ? 'growth-negative' : ''}`, pct(item.change_7d));
    const value = valuation(item);
    const valueCell = make('td', `value-cell${value === null ? ' value-null' : ''}`, value === null ? '—' : usd(value));
    const open = make('td', 'row-open', '↗');
    tr.append(rank, protocol, category, tvl, change, valueCell, open);
    const activate = () => openDetail(item);
    tr.addEventListener('click', activate);
    tr.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
    return tr;
  }

  function hasActiveFilters() {
    return Boolean(state.query || state.chain || state.category || state.watchOnly || state.sort !== 'rank');
  }

  function updateHeader() {
    const liveView = state.status === 'recorded';
    const watchView = getView() === 'watchlist';
    const title = liveView ? 'Token live' : watchView ? 'Watchlist' : 'Launch radar';
    setText('crumbView', title.toUpperCase());
    const tableTitle = $('tableHeading');
    const titleText = watchView && !liveView ? 'Watchlist protocols' : liveView ? 'Live token board' : 'Ranked opportunities';
    tableTitle.childNodes[0].textContent = titleText + ' ';
    if (watchView && !liveView) {
      $('pageTitle').innerHTML = 'Signals worth<br><em>following.</em>';
      setText('pageDescription', 'Snapshot-selected protocols held for closer monitoring.');
    } else if (liveView) {
      $('pageTitle').innerHTML = 'Token launch<br><em>intelligence.</em>';
      setText('pageDescription', 'Recorded token data, kept distinct from pre-token model estimates.');
    } else {
      $('pageTitle').innerHTML = 'Token launch<br><em>intelligence.</em>';
      setText('pageDescription', 'A ranked view of protocols with meaningful pre-token upside.');
    }
    document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.nav === (liveView ? 'live' : watchView ? 'watchlist' : 'radar')));
    $('watchOnly').checked = state.watchOnly || watchView;
    $('watchOnly').disabled = watchView;
  }

  function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach((th) => {
      const active = th.dataset.sort === state.sort;
      th.setAttribute('aria-sort', active ? (state.direction > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  function renderChart() {
    const chart = $('chart');
    chart.replaceChildren();
    const points = [...rows].filter((r) => number(r.implied_value_usd) !== null).sort((a, b) => (number(a.rank) ?? Infinity) - (number(b.rank) ?? Infinity)).slice(0, 12);
    if (!points.length) {
      chart.append(make('span', 'chart-empty', 'No modeled values in this snapshot'));
      return;
    }
    const max = Math.max(...points.map((p) => number(p.implied_value_usd)));
    points.forEach((item, index) => {
      const column = make('div', 'chart-column');
      column.setAttribute('aria-label', `Rank ${safe(item.rank)}, ${safe(item.name)}, ${usd(item.implied_value_usd)}`);
      const value = make('span', 'chart-value', usd(item.implied_value_usd));
      const bar = make('div', 'chart-bar');
      bar.style.height = `${Math.max(6, number(item.implied_value_usd) / max * 100)}%`;
      const rank = make('span', 'chart-rank', item.rank == null ? String(index + 1) : String(item.rank));
      column.append(value, bar, rank);
      chart.append(column);
    });
  }

  function openDetail(item) {
    state.current = item;
    setText('dialogRank', item.rank == null ? 'UNRANKED' : `RANK ${item.rank}`);
    const root = $('detailContent');
    root.replaceChildren();
    const body = make('div', 'detail-body');
    const heading = make('div', 'detail-heading');
    const headingText = make('div', '');
    headingText.append(make('div', 'detail-category', safe(item.category, 'UNCATEGORIZED').toUpperCase()), make('h2', 'detail-title', safe(item.name)), make('div', 'detail-slug', safe(item.slug)));
    const star = make('button', `detail-star${item.watchlist ? ' saved' : ''}`, item.watchlist ? '★' : '☆');
    star.type = 'button'; star.setAttribute('aria-label', item.watchlist ? 'On snapshot watchlist' : 'Not on snapshot watchlist'); star.title = 'Snapshot watchlist status'; star.disabled = true;
    heading.append(headingText, star);
    body.append(heading);
    const kpis = make('div', 'detail-kpis');
    const figures = [['TVL', usd(item.tvl_usd)], ['7D CHANGE', pct(item.change_7d)], [isLive(item) ? 'RECORDED CAP' : 'IMPLIED VALUE', valuation(item) === null ? '—' : usd(valuation(item))]];
    for (const [label, value] of figures) { const cell = make('div', 'detail-kpi'); cell.append(make('label', '', label), make('strong', '', value)); kpis.append(cell); }
    body.append(kpis);
    const model = item.model;
    if (!isLive(item) && model) {
      const section = make('section', 'detail-section'); section.append(make('h3', '', 'MODEL BREAKDOWN'));
      const breakdown = make('div', 'model-breakdown');
      const details = [['Base multiple', model.base_multiple], ['Growth multiplier', model.growth_multiplier], ['Maturity multiplier', model.maturity_multiplier], ['Age tracked', item.age_days == null ? null : `${item.age_days} days (listing-age proxy)`], ['Capital assumption', item.capital_usd == null ? null : usd(item.capital_usd)], ['Holding period', item.hold_days == null ? null : `${item.hold_days} days`]];
      for (const [label, value] of details) { const line = make('div', 'model-line'); line.append(make('span', '', label), make('strong', '', value == null ? '—' : String(value))); breakdown.append(line); }
      section.append(breakdown); body.append(section);
    } else if (!isLive(item) && item.age_days != null) {
      const section = make('section', 'detail-section'); section.append(make('h3', '', 'AGE TRACKED'), make('p', 'model-line', `${item.age_days} days since listing; used as a maturity context signal.`)); body.append(section);
    }
    const steps = Array.isArray(item.farm_steps) ? item.farm_steps : [];
    const farmSection = make('section', 'detail-section'); farmSection.append(make('h3', '', `FARM PLAN · ${steps.length} STEPS`));
    if (steps.length) { const list = make('ol', 'farm-list'); steps.forEach((step) => list.append(make('li', '', step))); farmSection.append(list); }
    else farmSection.append(make('p', 'model-line', 'No farm plan supplied in this snapshot.'));
    body.append(farmSection);
    if (item.risk_note) { const riskSection = make('section', 'detail-section'); riskSection.append(make('h3', '', 'RISK NOTE'), make('p', 'risk-note', item.risk_note)); body.append(riskSection); }
    const meta = make('div', 'detail-meta');
    meta.append(make('span', '', `LISTED ${fmtDate(item.listed_at)}`), make('span', '', `CHAINS ${chainsOf(item).join(', ') || '—'}`), make('span', '', `STATUS ${isLive(item) ? 'RECORDED' : safe(item.token_status, 'PRE-TOKEN').toUpperCase()}`));
    body.append(meta); root.append(body);
    $('detailDialog').showModal();
  }

  function resetFilters() {
    state.query = ''; state.chain = ''; state.category = ''; state.watchOnly = getView() === 'watchlist'; state.sort = 'rank'; state.direction = 1;
    $('search').value = ''; $('chainFilter').value = ''; $('categoryFilter').value = ''; $('watchOnly').checked = false; $('sortSelect').value = 'rank';
    render();
  }

  function syncHash() {
    const view = getView();
    state.status = view === 'live' ? 'recorded' : 'pre-token';
    state.watchOnly = view === 'watchlist';
    render();
    const slug = getProtocol();
    if (slug) { const match = all.find((item) => item.slug === slug); if (match) openDetail(match); }
  }

  function bindEvents() {
    $('search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
    $('chainFilter').addEventListener('change', (event) => { state.chain = event.target.value; render(); });
    $('categoryFilter').addEventListener('change', (event) => { state.category = event.target.value; render(); });
    $('sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; state.direction = event.target.value === 'name' ? 1 : -1; render(); });
    $('watchOnly').addEventListener('change', (event) => { state.watchOnly = event.target.checked; render(); });
    $('resetButton').addEventListener('click', resetFilters);
    $('emptyReset').addEventListener('click', resetFilters);
    document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => {
      const view = button.dataset.status === 'recorded' ? 'live' : 'radar';
      location.hash = `view=${view}`;
    }));
    document.querySelectorAll('th.sortable').forEach((th) => {
      const sort = () => { if (state.sort === th.dataset.sort) state.direction *= -1; else { state.sort = th.dataset.sort; state.direction = -1; } $('sortSelect').value = state.sort; render(); };
      th.addEventListener('click', sort);
      th.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); sort(); } });
    });
    $('modelButton').addEventListener('click', () => $('modelDialog').showModal());
    $('closeDetail').addEventListener('click', () => $('detailDialog').close());
    $('closeModel').addEventListener('click', () => $('modelDialog').close());
    $('detailDialog').addEventListener('close', () => { if (getProtocol()) location.hash = `view=${getView()}`; });
    document.querySelectorAll('.nav-link,.brand').forEach((link) => link.addEventListener('click', (event) => {
      const view = link.dataset.nav || 'radar';
      event.preventDefault(); location.hash = `view=${view}`;
    }));
    window.addEventListener('hashchange', syncHash);
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('search').focus(); }
      if (event.key === 'Escape') { if ($('detailDialog').open) $('detailDialog').close(); if ($('modelDialog').open) $('modelDialog').close(); }
    });
  }

  initSnapshot();
  if (data?.rows && data?.live) {
    renderChart();
    bindEvents();
    syncHash();
  }
})();
