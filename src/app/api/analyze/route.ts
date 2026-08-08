import { NextRequest, NextResponse } from "next/server";

const MODEL = "gemini-3.6-flash";

type EntryLite = {
  type: "收入" | "支出";
  amount: number;
  category: string;
  note: string | null;
  account: string;
  occurred_at: string;
};

type TrendPoint = { year: number; month: number; income: number; expense: number };

function buildPrompt(input: {
  periodLabel: string;
  income: number;
  expense: number;
  net: number;
  entries: EntryLite[];
  trend: TrendPoint[];
}) {
  const { periodLabel, income, expense, net, entries, trend } = input;

  const entryLines = entries
    .slice(0, 300)
    .map(
      (e) =>
        `${e.occurred_at.slice(0, 10)} | ${e.type} | ${e.category} | RM${e.amount} | 账户:${e.account}${
          e.note ? ` | 备注:${e.note}` : ""
        }`
    )
    .join("\n");

  const trendLines = trend
    .map((t) => `${t.year}-${String(t.month + 1).padStart(2, "0")}: 收入 RM${t.income.toFixed(0)}, 支出 RM${t.expense.toFixed(0)}`)
    .join("\n");

  return `你是一位帮小生意老板看账的助手。这是一间放款/借贷生意的记账数据，货币是马来西亚令吉(RM)。

【本期：${periodLabel}】
收入总额：RM${income.toFixed(2)}
支出总额：RM${expense.toFixed(2)}
净现金流：RM${net.toFixed(2)}

【本期交易明细】
${entryLines || "（这段期间没有交易记录）"}

【近12个月收支趋势】
${trendLines || "（暂无趋势数据）"}

请用简单、口语化的中文（不要用专业术语，不要用英文financial jargon），帮老板分析这份数据，按以下几点，用小标题分段：

1. 这个月钱况怎么样（一句话总结）
2. 有没有不正常或需要注意的地方（例如某笔金额特别大、某个分类突然花很多钱、现金流是不是变差了）
3. 具体可以做的建议（2-4条，要具体、能马上做的，不要空泛的话）

不要给投资建议，只针对这份记账数据本身做分析。语气像在跟朋友解释一样，简短清楚，总字数控制在400字以内。`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务器还没设置 Gemini API 金钥" }, { status: 500 });
  }

  let body: {
    periodLabel: string;
    income: number;
    expense: number;
    net: number;
    entries: EntryLite[];
    trend: TrendPoint[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("Gemini API error:", res.status, detail);
      return NextResponse.json({ error: "AI 分析失败，请再试一次" }, { status: 502 });
    }

    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

    if (!text) {
      return NextResponse.json({ error: "AI 没有回传内容，请再试一次" }, { status: 502 });
    }

    return NextResponse.json({ analysis: text });
  } catch (err) {
    console.error("Gemini request failed:", err);
    return NextResponse.json({ error: "连接 AI 服务失败，请检查网络后再试" }, { status: 502 });
  }
}
