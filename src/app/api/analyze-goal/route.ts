import { NextRequest, NextResponse } from "next/server";

const MODEL = "gemini-3.6-flash";

type AccountLite = { name: string; type: string; balance: number };
type TrendPoint = { year: number; month: number; income: number; expense: number };

function buildPrompt(input: {
  goal: {
    monthlyDesiredIncome: number;
    monthlyOptionReturn: number;
    initialCapital: number;
    monthlySavings: number;
    annualReturn: number;
    totalCapitalNeeded: number;
    yearlySavings: number;
    assumedYears: number;
  };
  investedNow: number;
  actualYears: number;
  netWorth: { assets: number; liabilities: number; netWorth: number };
  accounts: AccountLite[];
  trend: TrendPoint[];
}) {
  const { goal, investedNow, actualYears, netWorth, accounts, trend } = input;

  const accountLines = accounts.map((a) => `${a.name}（${a.type}）：RM${a.balance.toFixed(2)}`).join("\n");
  const trendLines = trend
    .map((t) => `${t.year}-${String(t.month + 1).padStart(2, "0")}: 收入 RM${t.income.toFixed(0)}, 支出 RM${t.expense.toFixed(0)}`)
    .join("\n");

  return `你是一位帮小生意老板看账的助手。他给自己定了一个财务自由的目标，货币是马来西亚令吉(RM)。

【他的目标假设】
每月期望收入：RM${goal.monthlyDesiredIncome}
每月投资回报率：${(goal.monthlyOptionReturn * 100).toFixed(0)}%
需要的总资本：RM${goal.totalCapitalNeeded.toFixed(0)}
起始资本假设：RM${goal.initialCapital}
每月存款假设：RM${goal.monthlySavings}
年化复利回报假设：${(goal.annualReturn * 100).toFixed(0)}%
照假设推算要花：约${goal.assumedYears}年

【他现在的实际情况】
投资账户目前余额加总（真正拿去投资的钱，例如 IBKR、Tiger Broker 这类账户）：RM${investedNow.toFixed(2)}
照现在这笔钱、用同样的假设推算，还需要：约${actualYears}年才能达到目标
净资产（全部账户加总）：RM${netWorth.netWorth.toFixed(2)}（资产 RM${netWorth.assets.toFixed(2)}，负债 RM${netWorth.liabilities.toFixed(2)}）

【他现在每个账户的余额】
${accountLines || "（还没有账户数据）"}

【近12个月收支趋势】
${trendLines || "（暂无趋势数据）"}

请用简单、口语化的中文（不要用专业术语，不要用英文financial jargon），帮他分析现在的状况跟他自己设定的目标比起来怎么样，按以下几点，用小标题分段：

1. 现在的进度怎么样（一句话总结：照目前实际的钱，跟原本设定的目标比，是超前还是落后，差多少年）
2. 有没有需要注意的地方（例如钱都放在不会增值的账户里没有转去投资、每个月实际存到的钱够不够 RM${goal.monthlySavings}、净资产跟目标差距大不大）
3. 具体可以做的建议（2-4条，要具体、能马上做的，聚焦在存钱习惯和资金分配上）

不要给投资建议（例如该买什么、几时买、选哪个投资产品），只针对他自己的存钱进度和资金分配给建议。语气像在跟朋友解释一样，简短清楚，总字数控制在400字以内。`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务器还没设置 Gemini API 金钥" }, { status: 500 });
  }

  let body: Parameters<typeof buildPrompt>[0];
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
