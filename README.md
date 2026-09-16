# PRIME TECHNICAL

Standalone Next.js + Lightweight Charts trading chart using Upstox market data and the PRIME engine.

## Local architecture

- Next.js App Router frontend
- Upstox historical candle API routes
- Python Upstox V3 live bridge on `ws://localhost:8765`
- PRIME engine in `lib/prime-engine.ts`
- Lightweight Charts for rendering

## Important production note

The current live bridge is a local Python WebSocket service. A Vercel deployment can host the Next.js application and HTTP/API routes, but `ws://localhost:8765` will point to the viewer's own machine, not this Mac. For public live streaming, move the Python bridge to a persistent server/service and expose it over secure `wss://`.

Do not commit `.env.local` or any Upstox credentials/tokens. Configure secrets in the deployment environment instead.

## Local run

```bash
npm install
npm run dev
python3 scripts/live_bridge.py
```
