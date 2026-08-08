"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "登入失败");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("连接失败，请再试一次");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4">
        <div className="text-center">
          <p className="text-2xl mb-1">🔒</p>
          <h1 className="text-lg font-semibold text-neutral-100">Eeson记账本</h1>
          <p className="text-sm text-neutral-500 mt-1">这是私人账本，输入密码才能进去</p>
        </div>
        <div>
          <label className="text-xs text-neutral-500">密码</label>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full mt-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          onClick={submit}
          disabled={!password || loading}
          className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition text-white text-sm font-medium disabled:bg-neutral-800 disabled:text-neutral-600"
        >
          {loading ? "登入中..." : "进去"}
        </button>
      </div>
    </div>
  );
}
