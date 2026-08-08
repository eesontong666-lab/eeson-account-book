"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAccountsWithBalances, fetchNetWorth, AccountWithBalance } from "@/lib/accounts";
import { fetchMonthlyTrend } from "@/lib/entries";
import {
  GOAL,
  buildProjection,
  estimateYearsToFI,
  totalCapitalNeeded,
  yearlySavings,
} from "@/lib/goal";
import AnalysisText from "@/components/AnalysisText";

function fmtRM(n: number) {
  return `RM ${n.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

export default function GoalPage() {
  const [loading, setLoading] = useState(true);
  const [investedNow, setInvestedNow] = useState(0);
  const [investAccountNames, setInvestAccountNames] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [netWorth, setNetWorth] = useState({ assets: 0, liabilities: 0, netWorth: 0 });
  const [trend, setTrend] = useState<
    { year: number; month: number; income: number; expense: number }[]
  >([]);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    Promise.all([fetchAccountsWithBalances(), fetchNetWorth(), fetchMonthlyTrend(12)])
      .then(([accs, nw, tr]) => {
        const investAccounts = accs.filter((a) => a.type === "投资");
        setInvestedNow(investAccounts.reduce((sum, a) => sum + a.balance, 0));
        setInvestAccountNames(investAccounts.map((a) => a.name));
        setAccounts(accs);
        setNetWorth(nw);
        setTrend(tr);
      })
      .finally(() => setLoading(false));
  }, []);

  const years = estimateYearsToFI();
  const actualYears = estimateYearsToFI(investedNow);
  const maxYears = Math.max(years, actualYears) + 2;
  const assumedProjection = buildProjection(GOAL.initialCapital, maxYears);
  const actualProjection = buildProjection(investedNow, maxYears);
  const chartData = assumedProjection.map((p, i) => ({
    年份: `第${p.year}年`,
    假设起点: Math.round(p.balance),
    实际进度: Math.round(actualProjection[i].balance),
  }));

  async function runAnalysis() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/analyze-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: {
            monthlyDesiredIncome: GOAL.monthlyDesiredIncome,
            monthlyOptionReturn: GOAL.monthlyOptionReturn,
            initialCapital: GOAL.initialCapital,
            monthlySavings: GOAL.monthlySavings,
            annualReturn: GOAL.annualReturn,
            totalCapitalNeeded,
            yearlySavings,
            assumedYears: years,
          },
          investedNow,
          actualYears,
          netWorth,
          accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: a.balance })),
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

  const stats: { icon: string; label: string; sub: string; value: string }[] = [
    { icon: "🎯", label: "每月期望收入", sub: "Monthly Desired Income", value: fmtRM(GOAL.monthlyDesiredIncome) },
    { icon: "📈", label: "每月投资回报率", sub: "Monthly Option Return", value: `${(GOAL.monthlyOptionReturn * 100).toFixed(0)}%` },
    { icon: "💰", label: "需要的总资本", sub: "Total Capital Needed", value: fmtRM(totalCapitalNeeded) },
    { icon: "💵", label: "起始资本", sub: "Initial Capital", value: fmtRM(GOAL.initialCapital) },
    { icon: "🏦", label: "每月存多少", sub: "Monthly Savings", value: fmtRM(GOAL.monthlySavings) },
    { icon: "📅", label: "每年存多少", sub: "Yearly Savings", value: fmtRM(yearlySavings) },
    { icon: "🚀", label: "年化复利回报", sub: "Annual Compounding Return", value: `${(GOAL.annualReturn * 100).toFixed(0)}%` },
    { icon: "🏖️", label: "预估达成年数", sub: "Estimated Years to FI", value: `约 ${years} 年` },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold text-neutral-100">财务自由目标</h1>
        <p className="text-sm text-neutral-500 mt-0.5">这是你自己设定的目标和假设，追踪的是你自己的计划</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <p className="text-xs text-neutral-500">
              {s.icon} {s.label}
            </p>
            <p className="text-[11px] text-neutral-700 mt-0.5">{s.sub}</p>
            <p className="text-lg font-semibold text-neutral-100 mt-1.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <p className="text-sm text-neutral-300 leading-relaxed">
          也就是说，如果你能够：
        </p>
        <ul className="text-sm text-neutral-300 leading-relaxed list-disc list-inside mt-1 flex flex-col gap-0.5">
          <li>长期维持 {(GOAL.annualReturn * 100).toFixed(0)}% 年化报酬率</li>
          <li>每个月持续投入 {fmtRM(GOAL.monthlySavings)}</li>
          <li>不中断投资</li>
        </ul>
        <p className="text-sm text-neutral-300 leading-relaxed mt-2">
          大约 <span className="text-indigo-400 font-medium">{years} 年</span>后，你的资产会超过{" "}
          {fmtRM(totalCapitalNeeded)}。以每月稳定 {(GOAL.monthlyOptionReturn * 100).toFixed(0)}% 的收益率计算，可产生约{" "}
          {fmtRM(GOAL.monthlyDesiredIncome)}/月（未考虑税务、交易成本、提款以及收益波动）。
        </p>
        <p className="text-xs text-neutral-600 mt-3">
          这只是根据你自己设定的假设做的推算，不是投资建议，实际回报可能不同。
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-neutral-300">资产成长曲线</p>
          {!loading && (
            <p className="text-xs text-neutral-500">
              照你现在的实际进度，大概还要 <span className="text-amber-400 font-medium">{actualYears} 年</span>
            </p>
          )}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="goal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="actual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="年份" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#525252"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                formatter={(v) => fmtRM(Number(v))}
                contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />
              <ReferenceLine
                y={totalCapitalNeeded}
                stroke="#34d399"
                strokeDasharray="4 4"
                label={{ value: `目标 ${fmtRM(totalCapitalNeeded)}`, fill: "#34d399", fontSize: 11, position: "insideTopLeft" }}
              />
              <Area type="monotone" dataKey="假设起点" stroke="#818cf8" fill="url(#goal)" strokeWidth={2} />
              <Area type="monotone" dataKey="实际进度" stroke="#f59e0b" fill="url(#actual)" strokeWidth={2} strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <p className="text-sm font-medium text-neutral-300 mb-2">你现在的实际进度</p>
        {loading ? (
          <p className="text-sm text-neutral-600 py-4 text-center">读取中...</p>
        ) : (
          <>
            <p className="text-2xl font-semibold text-neutral-100">{fmtRM(investedNow)}</p>
            <p className="text-xs text-neutral-500 mt-1">
              这是你{investAccountNames.length > 0 ? investAccountNames.map((n) => `「${n}」`).join(" + ") : "投资账户"}
              加起来的余额——你实际投资组合所在的账户。照这个进度推算，大概还要{" "}
              <span className="text-amber-400">{actualYears} 年</span>
              才能达到目标（原本假设从 RM{GOAL.initialCapital.toLocaleString("en-MY")} 开始是 {years} 年）。把「投资」
              钱包的钱转进这些账户后，这个数字会跟着更新
            </p>
          </>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-300">AI 智能分析</p>
            <p className="text-xs text-neutral-500 mt-0.5">让 AI 看看你现在的整体财务状况，跟目标比进度怎么样</p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={aiLoading || loading}
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
    </div>
  );
}
