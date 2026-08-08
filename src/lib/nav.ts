export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: "/", label: "总览", icon: "🏠" }],
  },
  {
    title: "money",
    items: [
      { href: "/transactions", label: "交易记录", icon: "💳" },
      { href: "/accounts", label: "账户", icon: "🏦" },
      { href: "/scan-receipt", label: "扫描收据", icon: "🧾" },
    ],
  },
  {
    items: [
      { href: "/reports", label: "报表", icon: "📊" },
      { href: "/goal", label: "目标", icon: "🎯" },
      { href: "/settings", label: "设置", icon: "⚙️" },
    ],
  },
];
