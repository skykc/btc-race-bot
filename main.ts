// btc-race-bot: a one-asset dip-reversion trader for cbBTC/USDC on the
// agent-fun/bars-replay/v1 protocol.
//
// Idea (original to this entry): the 1-minute tape of cbBTC is noisy — a
// single minute moves ~6 bps while a full round trip costs ~26 bps — so
// chasing every wiggle loses money. This bot instead waits for a genuine
// one-hour-scale washout and rides the bounce back:
//
//   - RSI(60): the simple mean of gains and losses over the last 60
//     one-minute closes (a plain 60-bar average, NOT Wilder's smoothing
//     and NOT the 14-bar RSI of the kit's rsi-bollinger baseline).
//   - Enter long with all cash when RSI(60) falls below 35: the market
//     has sold off hard over the last hour and is stretched.
//   - Exit the whole position when RSI(60) rises above 65 (the bounce
//     has run its course) or when the close falls 150 bps below the
//     highest close since entry (a trailing stop that doubles as a
//     150 bps stop-loss from the entry print).
//   - Re-arm: after an exit, no new entry until RSI(60) has recovered
//     above 50, so a still-falling tape cannot churn the bot in and out
//     at nearly the same price.
//
// No trend filter, no breakout mode: both were tested on the dev window
// and destroyed the PnL (the dips worth buying happen while the price
// is still below its 4-hour average; breakouts on this tape are mostly
// noise). Parameters are few and the margins are wide: neighbouring
// RSI windows (45-90), thresholds (30-40 / 60-70) and trails
// (100-180 bps) stay profitable on the dev window.
//
// Deterministic: float64 math on the bar closes only, no clock, no
// environment, no randomness. One position at most, long only, full
// cash on entry, full position on exit, max_slippage_bps 100 (1%).

import { runBars, type BarsState, type Bar, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const RSI_BARS = 60;
const RSI_ENTER_BELOW = 35;
const RSI_EXIT_ABOVE = 65;
const RSI_REARM_ABOVE = 50;
/** Trailing stop / stop-loss in basis points below the peak close since entry. */
const TRAIL_BPS = 150;
const MAX_SLIPPAGE_BPS = 100;

/** Rolling window of the last RSI_BARS one-minute close-to-close changes. */
const changes: number[] = [];
let lastClose: number | null = null;

function pushBar(bar: Bar): void {
  const c = Number(bar.c);
  if (lastClose !== null) {
    changes.push(c - lastClose);
    if (changes.length > RSI_BARS) changes.shift();
  }
  lastClose = c;
}

/** RSI over the last RSI_BARS changes, simple means; null until the window is full. */
function rsi(): number | null {
  if (changes.length < RSI_BARS) return null;
  let gain = 0;
  let loss = 0;
  for (const d of changes) {
    if (d > 0) gain += d;
    else loss -= d;
  }
  const moved = gain + loss;
  if (moved === 0) return 50;
  return (100 * gain) / moved;
}

let peakSinceEntry = 0;
let armed = true;
let wasHolding = false;

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) pushBar(bar);
    }
    const fresh = batch.bars.some((b) => b.symbol === SYMBOL);
    const held = state.positions.get(SYMBOL);
    const holding = held !== undefined && held.qty > 0n;
    const close = state.close(SYMBOL);
    const r = fresh ? rsi() : null;

    if (holding && !wasHolding) {
      // A buy just filled: start the trailing peak at this close.
      peakSinceEntry = close !== null ? Number(close) : 0;
    }
    if (holding && close !== null) {
      const c = Number(close);
      if (c > peakSinceEntry) peakSinceEntry = c;
    }
    if (!holding && wasHolding) {
      // A sell just filled: disarm until the tape recovers.
      armed = false;
    }
    wasHolding = holding;

    if (!holding && !armed && r !== null && r > RSI_REARM_ABOVE) {
      armed = true;
    }

    if (state.warmingUp || !fresh || r === null || close === null) {
      return [];
    }

    const orders: (BuyInput | SellInput)[] = [];
    if (holding && held !== undefined) {
      const c = Number(close);
      const trailHit = peakSinceEntry > 0 && ((peakSinceEntry - c) / peakSinceEntry) * 10000 >= TRAIL_BPS;
      if (r > RSI_EXIT_ABOVE || trailHit) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
      return orders;
    }

    if (!holding && armed && r < RSI_ENTER_BELOW) {
      const cash = state.cash;
      if (cash >= BigInt(state.hello.fees.min_notional_quote_units)) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    }
    return orders;
  },
});
