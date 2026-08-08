import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, computeSessionToken } from "@/lib/session";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  const now = Date.now();
  const record = attempts.get(key);

  if (record && record.lockedUntil > now) {
    const waitSec = Math.ceil((record.lockedUntil - now) / 1000);
    return NextResponse.json({ error: `试太多次了，等 ${waitSec} 秒再试` }, { status: 429 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "服务器还没设置密码" }, { status: 500 });
  }

  if (body.password !== expected) {
    const nextCount = (record?.count ?? 0) + 1;
    attempts.set(key, {
      count: nextCount,
      lockedUntil: nextCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
    });
    return NextResponse.json({ error: "密码不对" }, { status: 401 });
  }

  attempts.delete(key);

  const token = await computeSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
