import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("upstox_access_token")?.value || process.env.UPSTOX_ACCESS_TOKEN;
  return NextResponse.json({ connected: Boolean(token), source: token ? (cookieStore.get("upstox_access_token") ? "oauth" : "environment") : "none" });
}
