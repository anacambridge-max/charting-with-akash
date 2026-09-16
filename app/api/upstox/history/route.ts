import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTRUMENTS: Record<string, string> = {
  RELIANCE: "NSE_EQ|INE002A01018",
  HDFCBANK: "NSE_EQ|INE040A01034",
  SBIN: "NSE_EQ|INE062A01020",
  INFY: "NSE_EQ|INE009A01021",
};

function dateIST(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find(x => x.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("upstox_access_token")?.value || process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "Connect Upstox or configure UPSTOX_ACCESS_TOKEN" }, { status: 401 });

  const symbol = (request.nextUrl.searchParams.get("symbol") || "RELIANCE").toUpperCase();
  const interval = request.nextUrl.searchParams.get("interval") || "5";
  const instrumentKey = INSTRUMENTS[symbol];
  if (!instrumentKey) return NextResponse.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  if (!["1", "3", "5", "15"].includes(interval)) return NextResponse.json({ error: "Supported intervals: 1, 3, 5, 15" }, { status: 400 });

  try {
    const to = dateIST();
    const from = dateIST(-30);
    const url = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(instrumentKey)}/minutes/${interval}/${to}/${from}`;
    const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "Upstox historical API failed", details: data }, { status: response.status });
    return NextResponse.json({ symbol, interval, instrumentKey, candles: data?.data?.candles || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown Upstox error" }, { status: 500 });
  }
}
