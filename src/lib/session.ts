export const SESSION_COOKIE = "eeson_session";

// Uses the Web Crypto API (globalThis.crypto) so this works in both the
// Node.js runtime (API routes) and the Edge runtime (middleware).
export async function computeSessionToken(): Promise<string> {
  const password = process.env.APP_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
