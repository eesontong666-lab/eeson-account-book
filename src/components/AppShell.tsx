"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen md:flex">
      {/* 桌面：固定侧边栏 */}
      <div className="hidden md:block shrink-0">
        <div className="fixed inset-y-0 left-0">
          <Sidebar />
        </div>
        <div className="w-64" />
      </div>

      {/* 手机：顶部栏 + 抽屉 */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-neutral-950/95 backdrop-blur border-b border-neutral-800">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="打开菜单"
          className="w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-neutral-300 hover:bg-neutral-900"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-neutral-100">Eeson记账本</span>
      </div>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
