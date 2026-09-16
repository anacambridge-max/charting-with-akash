# PRIME TECHNICAL

Standalone Next.js + Lightweight Charts trading chart using Upstox V3 and the PRIME engine.

## Production architecture

- Next.js App Router on Vercel
- Upstox historical candle API V3
- Vercel WebSocket Function at `/api/ws`
- Upstox Node.js `MarketDataStreamerV3` on the server side
- PRIME engine in `lib/prime.ts`
- Lightweight Charts for rendering

The browser never receives the Upstox access token. The server-side WebSocket bridge authenticates with Upstox and forwards normalized 1-minute candles to the browser.

## Vercel environment variables

- `UPSTOX_CLIENT_ID`
- `UPSTOX_CLIENT_SECRET`
- `UPSTOX_REDIRECT_URI`
- `UPSTOX_ACCESS_TOKEN` (optional fallback; OAuth can set an HTTP-only cookie)

Use the exact Vercel deployment URL in `UPSTOX_REDIRECT_URI`, ending with `/api/upstox/callback`, and register the same URI in Upstox.

Never commit `.env.local` or access tokens.
