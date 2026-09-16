import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("upstox_oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState) return NextResponse.json({ error: "Invalid OAuth callback state" }, { status: 400 });

  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return NextResponse.json({ error: "Missing Upstox OAuth environment variables" }, { status: 500 });

  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const response = await fetch("https://api.upstox.com/v2/login/authorization/token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data?.access_token) return NextResponse.json({ error: "Upstox token exchange failed", details: data }, { status: response.status || 500 });

  const result = NextResponse.redirect(new URL("/", request.url));
  result.cookies.set("upstox_access_token", data.access_token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: Math.max(300, Number(data.expires_in || 86400)), path: "/" });
  result.cookies.set("upstox_oauth_state", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
  return result;
}
