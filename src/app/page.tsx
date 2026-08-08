"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import Link from "next/link";
import Modal from "@/components/Modal";
import AddTransactionForm from "@/components/AddTransactionForm";
import {
  Entry,
  fetchEntriesForMonth,
  fetchMonthlyTrend,
  fetchRecentEntries,
} from "@/lib/entries";
import { fetchAccountsWithBalances, fetchNetWorth } from "@/lib/accounts";

const COLORS = ["#818cf8", "#f43f5e", "#f59e0b", "#0ea5e9", "#a855f7", "#84cc16"];

const MONTH_SHORT = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function Dashboard() {
  const now = new Date();
  const [totalBalance, setTotalBalance] = useState(0);
  const [netWorth, setNetWorth] = useState({ assets: 0, liabilities: 0, netWorth: 0 });
  const [monthEntries, setMonthEntries] = useState<Entry[]>([]);
  const [trend, setTrend] = useState<
    { key: string; year: number; month: number; income: number; expense: number }[]
  >([]);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [accounts, netWorthData, month, trendData, recentData] = await Promise.all([
        fetchAccountsWithBalances(),
        fetchNetWorth(),
        fetchEntriesForMonth(now.getFullYear(), now.getMonth()),
        fetchMonthlyTrend(6),
        fetchRecentEntries(6),
      ]);
      setTotalBalance(accounts.reduce((sum, a) => sum + a.balance, 0));
      setNetWorth(netWorthData);
      setMonthEntries(month);
      setTrend(trendData);
      setRecent(recentData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { monthlyIncome, monthlyExpense, expenseByCategory } = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const byCategory = new Map<string, number>();
    for (const e of monthEntries) {
      if (e.type === "收入") monthlyIncome += e.amount;
      else {
        monthlyExpense += e.amount;
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      }
    }
    const expenseByCategory = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { monthlyIncome, monthlyExpense, expenseByCategory };
  }, [monthEntries]);

  const netCashFlow = monthlyIncome - monthlyExpense;

  const trendData = trend.map((t) => ({
    name: MONTH_SHORT[t.month],
    收入: t.income,
    支出: t.expense,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">
          {greeting()} 👋
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          这是你现在的钱况，{now.getMonth() + 1}月
        </p>
      </header>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="总结余" value={totalBalance} accent="neutral" />
        <StatCard label="本月收入" value={monthlyIncome} accent="up" />
        <StatCard label="本月支出" value={monthlyExpense} accent="down" />
        <StatCard label="净现金流" value={netCashFlow} accent={netCashFlow >= 0 ? "up" : "down"} />
        <StatCard
          label="净资产"
          value={netWorth.netWorth}
          accent={netWorth.netWorth >= 0 ? "up" : "down"}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* 收支趋势 */}
        <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <p className="text-sm font-medium text-neutral-300 mb-3">收支趋势（近6个月）</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  stroke="#525252"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#171717",
                    border: "1px solid #262626",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="收入"
                  stroke="#34d399"
                  fill="url(#income)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="支出"
                  stroke="#fb7185"
                  fill="url(#expense)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 支出分类 */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <p className="text-sm font-medium text-neutral-300 mb-3">本月支出分类</p>
          {expenseByCategory.length === 0 ? (
            <p className="text-sm text-neutral-600 text-center py-16">还没有支出记录</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => Number(v).toFixed(2)}
                    contentStyle={{
                      background: "#171717",
                      border: "1px solid #262626",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-indigo-500/50 transition text-left"
        >
          <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg">
            ➕
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-100">记一笔</p>
            <p className="text-xs text-neutral-500">手动新增收入或支出</p>
          </div>
        </button>
        <Link
          href="/scan-receipt"
          className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-indigo-500/50 transition"
        >
          <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg">
            🧾
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-100">扫描收据</p>
            <p className="text-xs text-neutral-500">拍照快速记一笔</p>
          </div>
        </Link>
      </div>

      {/* 最近交易 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-neutral-300">最近交易</p>
          <Link href="/transactions" className="text-xs text-indigo-400 hover:text-indigo-300">
            查看全部 →
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-neutral-600 text-center py-10">读取中...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-10">还没有记录，记第一笔看看吧</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-800">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-neutral-100">{e.category}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(e.occurred_at).toLocaleDateString("zh-CN")} · {e.account}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium ${
                    e.type === "收入" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {e.type === "收入" ? "+" : "-"}
                  {e.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="记一笔">
        <AddTransactionForm
          onSaved={() => {
            setAddOpen(false);
            loadAll();
          }}
        />
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "up" | "down" | "neutral";
}) {
  const color =
    accent === "up"
      ? "text-emerald-400"
      : accent === "down"
      ? "text-rose-400"
      : "text-neutral-100";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-xl font-semibold mt-1.5 ${color}`}>
        RM {value.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}
