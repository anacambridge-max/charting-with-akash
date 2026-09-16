import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.json({ error: "Missing UPSTOX_CLIENT_ID or UPSTOX_REDIRECT_URI" }, { status: 500 });

  const state = crypto.randomUUID();
  const url = new URL("https://api.upstox.com/v2/login/authorization/dialog");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set("upstox_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
