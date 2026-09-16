import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import UpstoxClient from "upstox-js-sdk";

export const runtime = "nodejs";
export const maxDuration = 1800;
export const dynamic = "force-dynamic";

const INSTRUMENTS: Record<string, string> = {
  RELIANCE: "NSE_EQ|INE002A01018",
  HDFCBANK: "NSE_EQ|INE040A01034",
  SBIN: "NSE_EQ|INE062A01020",
  INFY: "NSE_EQ|INE009A01021",
};

function normalizeMessage(data: unknown): Record<string, unknown> | null {
  try {
    if (typeof data === "string") return JSON.parse(data);
    if (Buffer.isBuffer(data)) return JSON.parse(data.toString("utf8"));
    if (data && typeof data === "object") return data as Record<string, unknown>;
  } catch {}
  return null;
}

function extractCandle(feed: Record<string, unknown>, instrumentKey: string) {
  const feeds = (feed.feeds || {}) as Record<string, any>;
  const item = feeds[instrumentKey];
  if (!item) return null;
  const ltpc = item.ltpc || {};
  const ohlc = item.marketOHLC?.ohlc || item.marketOhlc?.ohlc || [];
  const oneMinute = Array.isArray(ohlc) ? ohlc.find((x: any) => x.interval === "I1") : null;
  if (!oneMinute) return null;
  return {
    type: "live_1m",
    instrumentKey,
    ltp: Number(ltpc.ltp || oneMinute.close || 0),
    ltt: Number(ltpc.ltt || feed.currentTs || Date.now()),
    candle: {
      time: Number(oneMinute.ts || feed.currentTs || Date.now()) / 1000,
      open: Number(oneMinute.open),
      high: Number(oneMinute.high),
      low: Number(oneMinute.low),
      close: Number(oneMinute.close),
      volume: Number(oneMinute.vol || 0),
    },
  };
}

export async function GET() {
  return experimental_upgradeWebSocket((ws) => {
    let streamer: any = null;
    let subscribedSymbol = "RELIANCE";
    let subscribedKey = INSTRUMENTS.RELIANCE;

    const disconnect = () => {
      try { streamer?.disconnect?.(); } catch {}
      streamer = null;
    };

    const startStreamer = (symbol: string) => {
      const token = process.env.UPSTOX_ACCESS_TOKEN;
      const key = INSTRUMENTS[symbol];
      if (!token || !key) {
        ws.send(JSON.stringify({ type: "error", message: "Upstox is not configured" }));
        return;
      }

      disconnect();
      subscribedSymbol = symbol;
      subscribedKey = key;

      const client: any = UpstoxClient.ApiClient.instance;
      client.authentications["OAUTH2"].accessToken = token;
      streamer = new UpstoxClient.MarketDataStreamerV3([key], "full");
      streamer.autoReconnect?.(true, 5, 10);

      streamer.on("open", () => {
        try { streamer.subscribe([key], "full"); } catch {}
        ws.send(JSON.stringify({ type: "connected", symbol, instrumentKey: key }));
      });
      streamer.on("message", (data: unknown) => {
        const parsed = normalizeMessage(data);
        if (!parsed) return;
        const candle = extractCandle(parsed, subscribedKey);
        if (candle) ws.send(JSON.stringify({ ...candle, symbol: subscribedSymbol }));
      });
      streamer.on("error", () => ws.send(JSON.stringify({ type: "error", message: "Upstox market feed error" })));
      streamer.on("close", () => ws.send(JSON.stringify({ type: "disconnected" })));
      streamer.connect();
    };

    ws.on("message", (data: WebSocketData) => {
      try {
        const message = normalizeMessage(data);
        if (!message) return;
        if (message.type === "subscribe") startStreamer(String(message.symbol || "RELIANCE").toUpperCase());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid WebSocket message" }));
      }
    });

    ws.on("close", disconnect);
    ws.on("error", disconnect);
    startStreamer("RELIANCE");
  });
}
