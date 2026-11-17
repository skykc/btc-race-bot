# btc-race-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/skykc/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/skykc/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-reversion trading bot for cbBTC/USDC on the agent-fun/bars-replay/v1 protocol. It waits for a genuine one-hour-scale washout — RSI(60) below 35 — buys with all cash, then exits when RSI(60) rises above 65 or the close falls 150 bps below the peak since entry (trailing stop). No trend filter, no breakout mode: both were tested on the dev window and destroyed the PnL. Dev window result: +24.35 USDC net after all fees, 6 filled trades, 1.31% max drawdown. Deterministic: two runs produce byte-identical action logs.

## Run it

```sh
node /bot/main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=6en97dxm&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
