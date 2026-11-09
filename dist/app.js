import { REG, resolveCA, hrefFor } from './registers.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
const CA = resolveCA(REG.ca);
const ROWS = 10; // seat 1 is own token, seats 2..10 trending
const BRAND_LOGO = '/assets/logo-96.png';

/* ---------- formatting ---------- */
const nf = (o) => new Intl.NumberFormat('en-US', o);
const compact = nf({ notation: 'compact', maximumFractionDigits: 2 });
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return isNum(n) ? n : null; };
const fmt = {
  usd: (n) => (n == null ? '—' : '$' + (Math.abs(n) >= 1000 ? compact.format(n) : nf({ maximumFractionDigits: 2 }).format(n))),
  price: (n) => {
    if (n == null) return '—';
    if (n >= 1) return '$' + nf({ minimumFractionDigits: 2, maximumFractionDigits: n >= 100 ? 2 : 4 }).format(n);
    if (n === 0) return '$0';
    const lead = Math.min(10, Math.max(0, -Math.floor(Math.log10(n))));
    return '$' + n.toFixed(Math.min(12, lead + 3));
  },
  pct: (n) => (n == null ? '—' : (n > 0 ? '+' : '') + (Math.abs(n) >= 10000 ? compact.format(n) : nf({ maximumFractionDigits: 2 }).format(n)) + '%'),
  int: (n) => (n == null ? '—' : nf({ maximumFractionDigits: 0 }).format(n))
};

/* ---------- clipboard ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}
function flashDone(btn) {
  btn.classList.add('done');
  clearTimeout(btn._t);
  btn._t = setTimeout(() => btn.classList.remove('done'), 1600);
}

/* ---------- registers into the DOM ---------- */
function wireLinks() {
  const xHref = hrefFor(REG.x);
  for (const id of ['socialX', 'ctaX', 'closeX']) {
    const a = $('#' + id);
    if (xHref) a.href = xHref; else a.removeAttribute('href');
  }
  const gh = $('#socialGh'); const ghHref = hrefFor(REG.github);
  if (ghHref) gh.href = ghHref; else { gh.removeAttribute('href'); gh.setAttribute('aria-disabled', 'true'); gh.removeAttribute('target'); gh.removeAttribute('rel'); }
  $('#footDomain').textContent = REG.site.domain;
  const c = REG.chain;
  $('#kvId').textContent = `${c.chainId} (${c.chainIdHex})`;
  $('#kvCur').textContent = c.currency;
  $('#kvRpc').textContent = c.rpc;
  const exp = $('#kvExp'); exp.textContent = c.explorer.replace(/^https:\/\//, '');
  if (c.state === 'stated') exp.href = c.explorer;
  const wire = (id, val) => { const b = $('#' + id); b.dataset.copy = val; };
  wire('kvIdCopy', String(c.chainId)); wire('kvRpcCopy', c.rpc);
}

function wireCA() {
  const box = $('#ca'), btn = $('#caBtn'), txt = $('#caText');
  box.dataset.state = CA.state;
  if (CA.state === 'stated') {
    txt.textContent = CA.value;
    btn.setAttribute('aria-disabled', 'false');
    btn.setAttribute('aria-label', 'Copy contract address ' + CA.value);
    btn.dataset.copy = CA.value;
    btn.addEventListener('click', async () => {
      const ok = await copyText(CA.value);
      const fb = $('#caFb'); fb.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      fb.classList.add('on'); clearTimeout(fb._t); fb._t = setTimeout(() => fb.classList.remove('on'), 1600);
    });
  } else if (CA.state === 'unconfirmed') {
    txt.textContent = CA.value; btn.setAttribute('aria-disabled', 'true');
    $('#caFb').textContent = 'Unconfirmed';
    $('#caFb').classList.add('on');
  } else {
    txt.textContent = 'Not announced yet';
    btn.setAttribute('aria-disabled', 'true');
  }
}

/* ---------- number animation ---------- */
function setNum(el, value, formatter, signClass) {
  const prev = el._v;
  el._v = value;
  const paint = (v) => { el.textContent = formatter(v); };
  if (signClass) el.classList.toggle('up', value != null && value > 0), el.classList.toggle('down', value != null && value < 0);
  if (prev === undefined || RM.matches || prev == null || value == null || prev === value) { cancelAnimationFrame(el._r); paint(value); return; }
  const from = prev, to = value, t0 = performance.now(), dur = 520;
  cancelAnimationFrame(el._r);
  el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
  el.classList.add(to > from ? 'flash-up' : 'flash-down');
  clearTimeout(el._f); el._f = setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 950);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    paint(from + (to - from) * e);
    if (k < 1) el._r = requestAnimationFrame(step); else paint(to);
  };
  el._r = requestAnimationFrame(step);
}

/* ---------- board ---------- */
const list = $('#boardList'), board = $('.board'), msg = $('#boardMsg');
const state = { trending: [], own: null, sort: 'vol', haveData: false };

function logoEl(item) {
  const d = document.createElement('span');
  d.className = 'logo';
  const letter = () => { d.className = 'logo'; d.textContent = (/[A-Za-z0-9]/.exec(item.symbol || '') || ['?'])[0].toUpperCase(); };
  if (item.brand) {
    d.className = 'logo logo--brand';
    const i = new Image(); i.alt = ''; i.decoding = 'async'; i.src = BRAND_LOGO; i.onerror = () => { i.remove(); letter(); }; d.appendChild(i);
  } else if (item.logo) {
    const i = new Image(); i.alt = ''; i.decoding = 'async'; i.referrerPolicy = 'no-referrer'; i.loading = 'lazy';
    i.onerror = () => { i.remove(); letter(); }; i.src = item.logo; d.appendChild(i);
  } else letter();
  return d;
}

function buildRow(item) {
  const li = document.createElement('li');
  li.className = 'row' + (item.own ? ' row--own' : '');
  li.dataset.key = item.key;
  const rank = document.createElement('span'); rank.className = 'rank';
  const tok = document.createElement('span'); tok.className = 'tok';
  const txt = document.createElement('span'); txt.className = 'tok__txt';
  const sym = document.createElement('span'); sym.className = 'tok__sym';
  const nm = document.createElement('span'); nm.className = 'tok__name';
  txt.append(sym, nm); tok.append(logoEl(item), txt);
  const mk = (cls, label) => { const s = document.createElement('span'); s.className = 'num cell ' + cls; s.dataset.l = label; return s; };
  const price = mk('c-price', 'Price'), chg = mk('c-chg', '24h'), vol = mk('c-vol', 'Volume'), liq = mk('c-liq', 'Liquidity');
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'copy';
  li.append(rank, tok, price, chg, vol, liq, copy);
  li._r = { rank, sym, nm, price, chg, vol, liq, copy };
  return li;
}

function fillRow(li, item, rankNo) {
  const r = li._r;
  r.rank.textContent = String(rankNo).padStart(2, '0');
  r.sym.textContent = item.symbol || '—';
  r.nm.textContent = item.name || '';
  li.classList.toggle('is-empty', !!item.empty);
  if (item.empty) {
    for (const k of ['price', 'chg', 'vol', 'liq']) { const el = r[k]; el._v = undefined; el.textContent = '· · · · ·'; el.classList.add('dotty'); el.classList.remove('up', 'down'); }
    r.copy.disabled = true; r.copy.removeAttribute('data-copy'); r.copy.setAttribute('aria-label', 'No address to copy yet');
    return;
  }
  for (const k of ['price', 'chg', 'vol', 'liq']) r[k].classList.remove('dotty');
  setNum(r.price, item.price, fmt.price);
  setNum(r.chg, item.chg, fmt.pct, true);
  setNum(r.vol, item.vol, fmt.usd);
  setNum(r.liq, item.liq, fmt.usd);
  const addr = item.addr || '';
  r.copy.disabled = !addr;
  if (addr) { r.copy.dataset.copy = addr; r.copy.setAttribute('aria-label', 'Copy address for ' + (item.symbol || 'token')); }
}

function skeletonRow() {
  const li = document.createElement('li');
  li.className = 'row skel'; li.setAttribute('aria-hidden', 'true');
  const sk = (c = '') => `<span class="sk ${c}"></span>`;
  li.innerHTML = `<span class="rank"><span class="sk" style="width:1.2rem"></span></span><span class="tok"><span class="sk sk--c"></span><span class="tok__txt"><span class="sk" style="width:5rem"></span></span></span><span class="num c-price" data-l="Price">${sk()}<span class="dash">—</span></span><span class="num c-chg" data-l="24h">${sk()}<span class="dash">—</span></span><span class="num c-vol" data-l="Volume">${sk()}<span class="dash">—</span></span><span class="num c-liq" data-l="Liquidity">${sk()}<span class="dash">—</span></span><span></span>`;
  return li;
}

function ownItem() {
  if (CA.state !== 'stated') {
    return { key: 'own', own: true, brand: true, empty: true, symbol: 'MULTIBAG', name: 'Contract not announced' };
  }
  const o = state.own;
  if (!o) return { key: 'own', own: true, brand: true, empty: true, symbol: 'MULTIBAG', name: 'Reading pair' };
  return { key: 'own', own: true, brand: true, symbol: o.symbol || 'MULTIBAG', name: o.name || 'MULTIBAG', price: o.price, chg: o.chg, vol: o.vol, liq: o.liq, addr: CA.value };
}

const SORTS = { vol: (a, b) => (b.vol ?? -1) - (a.vol ?? -1), chg: (a, b) => (b.chg ?? -1e18) - (a.chg ?? -1e18), liq: (a, b) => (b.liq ?? -1) - (a.liq ?? -1) };

function selectTrending() {
  // pool-level top by volume first, then own-token dedup, then take nine, then apply the viewing order
  let t = [...state.trending].sort(SORTS.vol);
  if (CA.state === 'stated') t = t.filter((x) => (x.addr || '').toLowerCase() !== CA.value.toLowerCase());
  return t.slice(0, ROWS - 1).sort(SORTS[state.sort]);
}

function renderBoard() {
  const items = [ownItem(), ...(state.haveData ? selectTrending() : [])];
  const existing = new Map($$(':scope > .row[data-key]', list).map((li) => [li.dataset.key, li]));
  const wasSkeleton = $$(':scope > .skel', list);
  let fresh = 0;
  items.forEach((item, idx) => {
    let li = existing.get(item.key);
    if (!li) { li = buildRow(item); li.classList.add('enter'); li.style.setProperty('--i', String(item.own ? 0 : fresh++)); }
    existing.delete(item.key);
    fillRow(li, item, idx + 1);
    if (list.children[idx] !== li) list.insertBefore(li, list.children[idx] || null);
  });
  existing.forEach((li) => li.remove());
  // skeletons live after the real rows until data arrives
  if (!state.haveData) {
    if (!wasSkeleton.length) for (let i = 0; i < ROWS - 1; i++) list.appendChild(skeletonRow());
  } else wasSkeleton.forEach((s) => { s.classList.add('leave'); setTimeout(() => s.remove(), RM.matches ? 0 : 220); });
}

/* tiles + ticker */
function renderTiles() {
  const t = state.trending; if (!t.length) return;
  const top10 = [...t].sort(SORTS.vol).slice(0, 10);
  setNum($('[data-tile="pools"]'), top10.length, fmt.int);
  setNum($('[data-tile="vol"]'), top10.reduce((a, x) => a + (x.vol || 0), 0), fmt.usd);
  setNum($('[data-tile="liq"]'), top10.reduce((a, x) => a + (x.liq || 0), 0), fmt.usd);
  const best = [...top10].filter((x) => x.chg != null).sort((a, b) => b.chg - a.chg)[0];
  $('[data-tile="top"]').textContent = best ? `${best.symbol} ${fmt.pct(best.chg)}` : '—';
}
const ticker = $('#ticker');
function skeletonTicker() {
  ticker.innerHTML = Array.from({ length: 12 }, () => '<span class="tick tick--skel skel"><i class="sk"></i></span>').join('');
}
function renderTicker() {
  const top10 = [...state.trending].sort(SORTS.vol).slice(0, 10);
  if (!top10.length) return;
  const mk = (x) => {
    const s = document.createElement('span'); s.className = 'tick';
    const b = document.createElement('b'); b.textContent = x.symbol || '—';
    const p = document.createElement('span'); p.textContent = fmt.price(x.price);
    const c = document.createElement('span'); c.textContent = fmt.pct(x.chg); c.className = x.chg > 0 ? 'up' : x.chg < 0 ? 'down' : '';
    s.append(b, p, c); return s;
  };
  const a = top10.map(mk), b = top10.map(mk);
  b.forEach((n) => n.setAttribute('aria-hidden', 'true'));
  ticker.replaceChildren(...a, ...b);
}

/* ---------- market source ---------- */
let timer = 0, ctl = null, fails = 0, running = false;
const pill = $('.pill'), pillText = $('#pillText');
function setPill(s, text) { pill.dataset.s = s; pillText.textContent = text; }

async function getJson(url) {
  ctl = ctl || new AbortController();
  const timeout = setTimeout(() => ctl && ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(timeout); }
}

function parseTrending(j) {
  const toks = new Map();
  for (const inc of j.included || []) if (inc.type === 'token') toks.set(inc.id, inc.attributes || {});
  return (j.data || []).map((d) => {
    const a = d.attributes || {};
    const tid = d.relationships?.base_token?.data?.id;
    const t = toks.get(tid) || {};
    const addr = t.address || (tid ? tid.replace(/^[^_]*_/, '') : '');
    const sym = t.symbol || (a.name || '').split(' / ')[0] || '';
    return { key: 'p:' + d.id, addr, symbol: sym, name: t.name || a.name || '', logo: t.image_url || null, price: num(a.base_token_price_usd), chg: num(a.price_change_percentage?.h24), vol: num(a.volume_usd?.h24), liq: num(a.reserve_in_usd) };
  });
}

async function loadTrending() {
  const j = await getJson(REG.market.trendingUrl);
  const items = parseTrending(j);
  if (!items.length) throw new Error('empty');
  state.trending = items; state.haveData = true;
}

async function loadOwn() {
  if (CA.state !== 'stated') return;
  const j = await getJson(REG.market.ownTokenUrl + encodeURIComponent(CA.value));
  const pairs = (j.pairs || []).filter(Boolean).sort((a, b) => (num(b.volume?.h24) ?? 0) - (num(a.volume?.h24) ?? 0));
  const p = pairs[0];
  if (!p) { state.own = state.own || null; return; }
  state.own = { symbol: p.baseToken?.symbol, name: p.baseToken?.name, price: num(p.priceUsd), chg: num(p.priceChange?.h24), vol: num(p.volume?.h24), liq: num(p.liquidity?.usd) };
}

function scheduleNext(ms) { clearTimeout(timer); if (!document.hidden) timer = setTimeout(tick, ms); }

async function tick() {
  if (document.hidden || running) return;
  running = true; ctl = new AbortController();
  const [a, b] = await Promise.allSettled([loadTrending(), loadOwn()]);
  running = false;
  if (document.hidden) return;
  const trendOk = a.status === 'fulfilled';
  if (trendOk) {
    board.dataset.state = 'ok'; msg.textContent = ''; msg.classList.remove('ok');
  } else if (state.haveData) {
    msg.textContent = 'Feed unreachable. Showing the last good figures while retrying.';
  } else {
    board.dataset.state = 'error';
    msg.textContent = 'Market feed unreachable. Retrying with a longer pause each time.';
  }
  if (trendOk || state.haveData) { renderBoard(); renderTiles(); if (trendOk) renderTicker(); }
  if (b.status === 'fulfilled' || CA.state === 'stated') renderBoard();
  const bad = !trendOk || b.status === 'rejected';
  if (bad) { fails++; setPill('retry', 'Retrying'); scheduleNext(Math.min(60000, 2000 * 2 ** Math.min(fails - 1, 5))); }
  else { fails = 0; setPill('live', 'Live'); scheduleNext(60000); }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(timer); if (ctl) ctl.abort(); running = false; setPill('paused', 'Paused'); }
  else { setPill(state.haveData ? 'live' : 'connecting', state.haveData ? 'Live' : 'Connecting'); tick(); }
});

/* ---------- interactions ---------- */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy'); if (!b || b.disabled) return;
  const v = b.dataset.copy; if (!v) return;
  if (await copyText(v)) flashDone(b);
});

$$('.tabs button').forEach((btn) => btn.addEventListener('click', () => {
  state.sort = btn.dataset.sort;
  $$('.tabs button').forEach((o) => { const on = o === btn; o.setAttribute('aria-selected', String(on)); o.tabIndex = on ? 0 : -1; });
  list.setAttribute('aria-labelledby', btn.id);
  if (state.haveData) renderBoard();
}));
$('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = $$('.tabs button'); const i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
});

$('#addChain').addEventListener('click', async () => {
  const m = $('#chainMsg'); const c = REG.chain;
  m.classList.remove('ok');
  if (!window.ethereum || !window.ethereum.request) { m.textContent = 'No wallet detected in this browser. Use the values above to add the network by hand.'; return; }
  try {
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: c.chainIdHex, chainName: c.name, nativeCurrency: { name: c.currency, symbol: c.currency, decimals: 18 }, rpcUrls: [c.rpc], blockExplorerUrls: [c.explorer] }] });
    m.textContent = 'Network request sent to your wallet.'; m.classList.add('ok');
  } catch { m.textContent = 'The wallet declined or could not add the network.'; }
});

/* spotlight */
document.addEventListener('pointermove', (e) => {
  const el = e.target.closest && e.target.closest('.spot, .rows > .row');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px');
}, { passive: true });

/* scroll progress + parallax */
const prog = $('#progress'), hero = $('#hero'), axis = $('#axis');
const layers = $$('[data-depth]');
let px = 0, py = 0, raf = 0;
function frame() {
  raf = 0;
  const h = document.documentElement.scrollHeight - innerHeight;
  prog.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  if (RM.matches) return;
  const sy = Math.min(scrollY, innerHeight * 1.2);
  for (const l of layers) {
    const d = parseFloat(l.dataset.depth);
    l.style.translate = `${px * d * 120}px ${py * d * 120 + sy * d}px`;
  }
  hero.style.setProperty('--dx', (0.046 + px * 0.04).toFixed(4));
  hero.style.setProperty('--dy', (0.046 + py * 0.04).toFixed(4));
  axis.textContent = `Axis ${(px * 2).toFixed(2)} ${(py * 2).toFixed(2)}`;
}
const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
addEventListener('scroll', ask, { passive: true });
addEventListener('resize', ask);
hero.addEventListener('pointermove', (e) => {
  if (RM.matches) return;
  const r = hero.getBoundingClientRect();
  px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; ask();
}, { passive: true });
hero.addEventListener('pointerleave', () => { px = 0; py = 0; ask(); });

/* scroll reveal */
(function reveal() {
  const els = $$('.reveal');
  if (RM.matches || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
})();

/* ---------- boot ---------- */
wireLinks();
wireCA();
skeletonTicker();
renderBoard();
setPill('connecting', 'Connecting');
ask();
tick();
