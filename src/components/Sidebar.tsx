"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/lib/nav";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-r border-neutral-800 w-64">
      <div className="px-5 h-16 flex items-center border-b border-neutral-800 shrink-0">
        <span className="text-sm font-semibold tracking-wide text-neutral-100">
          Eeson记账本
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="flex flex-col gap-1">
            {section.title && (
              <p className="px-3 mb-1 text-[11px] uppercase tracking-wider text-neutral-500">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    active
                      ? "bg-indigo-500/10 text-indigo-400 font-medium"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-neutral-800 text-xs text-neutral-500 shrink-0">
        只有你自己能看到这些数据
      </div>
    </div>
  );
}
