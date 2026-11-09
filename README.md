# MULTIBAG

Many bags. One board.

[![Live site](https://img.shields.io/badge/live-multibag.trade-f7f7f7?labelColor=0a0a0a)](https://multibag.trade)

## Overview

MULTIBAG is a single-page market board covering Elysium pools. It reads public pool data, renders it on one dark surface, and holds its first row open for MULTIBAG.

- Chain: Elysium (chain ID 99901, currency HYPE)
- Contract address: `TBA` (set it in `src/registers.js`)

## Features

- Live board of the ten busiest Elysium pools, refreshed every minute and paused while the tab is hidden
- Seat one follows one contract address; shows a branded placeholder until the address is stated
- Ticker, totals and sortable board built from the same feed, with skeleton loading and last-good-data fallback
- Motion that respects `prefers-reduced-motion`

## Links

- Site: https://multibag.trade
- X: https://x.com/multibagtrade
- Explorer: https://explorer.elysium.kinetiq.xyz
- RPC: https://rpc.elysium.kinetiq.xyz

## Develop

```bash
npm install
npm run build   # writes the deployable site to dist/
npm run serve   # serves dist/ on http://localhost:4173 (set PORT to change)
```

Every external fact lives in one record in `src/registers.js` with a state of `stated`, `absent` or `unconfirmed`.

## License

MIT
