"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Entry, fetchEntriesForRange, fetchMonthlyTrend } from "@/lib/entries";
import AnalysisText from "@/components/AnalysisText";

const COLORS = ["#818cf8", "#f43f5e", "#f59e0b", "#0ea5e9", "#a855f7", "#84cc16"];
const MONTH_SHORT = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

type Period = "thisMonth" | "lastMonth" | "thisYear";

function rangeFor(period: Period) {
  const now = new Date();
  if (period === "thisMonth") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      label: `${now.getFullYear()}年${MONTH_SHORT[now.getMonth()]}`,
    };
  }
  if (period === "lastMonth") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
      label: `${now.getFullYear()}年${MONTH_SHORT[now.getMonth() - 1] ?? MONTH_SHORT[11]}`,
    };
  }
  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear() + 1, 0, 1),
    label: `${now.getFullYear()}年`,
  };
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [trend, setTrend] = useState<
    { key: string; year: number; month: number; income: number; expense: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const { start, end, label } = rangeFor(period);

  useEffect(() => {
    setLoading(true);
    setAiText("");
    setAiError("");
    Promise.all([fetchEntriesForRange(start, end), fetchMonthlyTrend(12)])
      .then(([e, t]) => {
        setEntries(e);
        setTrend(t);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const { income, expense, expenseByCategory } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();
    for (const e of entries) {
      if (e.type === "收入") income += e.amount;
      else {
        expense += e.amount;
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      }
    }
    const expenseByCategory = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { income, expense, expenseByCategory };
  }, [entries]);

  const net = income - expense;
  const trendData = trend.map((t) => ({ name: MONTH_SHORT[t.month], 收入: t.income, 支出: t.expense }));

  async function runAnalysis() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodLabel: label,
          income,
          expense,
          net,
          entries: entries.map((e) => ({
            type: e.type,
            amount: e.amount,
            category: e.category,
            note: e.note,
            account: e.account,
            occurred_at: e.occurred_at,
          })),
          trend,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || "分析失败，请再试一次");
        return;
      }
      setAiText(data.analysis);
    } catch {
      setAiError("连接失败，请检查网络后再试");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">报表</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{label} 的数据</p>
        </div>
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
          {(
            [
              ["thisMonth", "本月"],
              ["lastMonth", "上个月"],
              ["thisYear", "今年"],
            ] as [Period, string][]
          ).map(([value, text]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-3.5 py-1.5 rounded-lg text-sm transition ${
                period === value
                  ? "bg-indigo-500 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-neutral-600 text-center py-16">读取中...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
              <p className="text-xs text-neutral-500">收入</p>
              <p className="text-emerald-400 font-semibold mt-1.5 text-lg">RM {income.toFixed(0)}</p>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
              <p className="text-xs text-neutral-500">支出</p>
              <p className="text-rose-400 font-semibold mt-1.5 text-lg">RM {expense.toFixed(0)}</p>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
              <p className="text-xs text-neutral-500">净现金流</p>
              <p
                className={`font-semibold mt-1.5 text-lg ${
                  net >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                RM {net.toFixed(0)}
              </p>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-300">AI 智能分析</p>
                <p className="text-xs text-neutral-500 mt-0.5">让 AI 帮你看看这段数据有没有需要注意的地方</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={aiLoading}
                className="shrink-0 bg-indigo-500 hover:bg-indigo-400 transition text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-60"
              >
                {aiLoading ? "分析中..." : aiText ? "重新分析" : "开始分析"}
              </button>
            </div>
            {aiError && <p className="text-sm text-rose-400">{aiError}</p>}
            {aiLoading && <p className="text-sm text-neutral-600 py-6 text-center">AI 正在看数据，稍等一下...</p>}
            {!aiLoading && aiText && (
              <div className="border-t border-neutral-800 pt-3">
                <AnalysisText text={aiText} />
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <p className="text-sm font-medium text-neutral-300 mb-3">每月支出趋势（近12个月）</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <XAxis dataKey="name" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="收入" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="支出" fill="#fb7185" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
              <p className="text-sm font-medium text-neutral-300 mb-3">支出分类</p>
              {expenseByCategory.length === 0 ? (
                <p className="text-sm text-neutral-600 text-center py-16">这段期间还没有支出记录</p>
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
                        formatter={(v: number) => v.toFixed(2)}
                        contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <p className="text-sm font-medium text-neutral-300 mb-3">花最多的分类</p>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-neutral-600 text-center py-8">这段期间还没有支出记录</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {expenseByCategory.slice(0, 6).map((c, i) => {
                  const pct = expense > 0 ? (c.value / expense) * 100 : 0;
                  return (
                    <li key={c.name} className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-neutral-200 truncate">{c.name}</span>
                          <span className="text-neutral-400">
                            RM {c.value.toFixed(0)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
