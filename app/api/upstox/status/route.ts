import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const oauthToken = cookieStore.get("upstox_access_token")?.value;
  const token = oauthToken || process.env.UPSTOX_ACCESS_TOKEN;
  const source = oauthToken ? "oauth" : token ? "environment" : "none";

  if (!token) {
    return NextResponse.json({ connected: false, source: "none", reason: "missing" });
  }

  try {
    const response = await fetch("https://api.upstox.com/v2/user/profile", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.json({ connected: true, source });
    }

    return NextResponse.json({
      connected: false,
      source,
      reason: response.status === 401 ? "invalid_or_expired" : "profile_check_failed",
      status: response.status,
    });
  } catch {
    return NextResponse.json({
      connected: false,
      source,
      reason: "profile_check_failed",
    });
  }
}
