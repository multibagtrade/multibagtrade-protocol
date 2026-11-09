// REGISTER PATTERN: every external fact is exactly one record.
// state is one of: "stated" | "absent" | "unconfirmed".
// Flip a record here and nothing else; every consumer reads through the helpers below.

export const REG = {
  chain: {
    state: 'stated',
    name: 'Elysium',
    rpc: 'https://rpc.elysium.kinetiq.xyz',
    chainId: 99901,
    chainIdHex: '0x1863d',
    currency: 'HYPE',
    explorer: 'https://explorer.elysium.kinetiq.xyz'
  },
  // Contract address. Absent today. Set value to the full address and state to "stated".
  ca: { state: 'absent', value: null },
  x: { state: 'stated', url: 'https://x.com/multibagtrade' },
  github: { state: 'absent', url: null },
  // Market source register. The board follows this record only and never reads ca.
  market: {
    state: 'stated',
    trendingUrl: 'https://api.geckoterminal.com/api/v2/networks/elysium/trending_pools?include=base_token',
    ownTokenUrl: 'https://api.dexscreener.com/latest/dex/tokens/'
  },
  site: { state: 'stated', domain: 'multibag.trade' }
};

// GATE: accept any 0x + 40 hex, any letter case. Never reject a well-formed 0x value
// just because its case pattern does not match a checksum.
const HEX_ADDR = /^0x[0-9a-fA-F]{40}$/;

export function resolveCA(rec = REG.ca) {
  const v = typeof rec.value === 'string' ? rec.value.trim() : '';
  if (rec.state === 'absent' || !v) return { state: 'absent', value: null };
  if (rec.state === 'stated' && HEX_ADDR.test(v)) return { state: 'stated', value: v };
  return { state: 'unconfirmed', value: v };
}

// LINK RULE: store the URL, derive the handle. No href unless the record is stated.
export function hrefFor(rec) {
  return rec && rec.state === 'stated' && rec.url ? rec.url : null;
}
export function handleFromUrl(url) {
  if (!url) return null;
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? '@' + seg : null;
  } catch { return null; }
}
