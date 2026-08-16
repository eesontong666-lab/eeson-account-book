import { NextRequest, NextResponse } from "next/server";

const MODEL = "gemini-3.6-flash";

const CURRENCY_ALIASES: Record<string, string> = {
  RM: "MYR",
  "S$": "SGD",
  "US$": "USD",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  FR: "CHF",
  "FR.": "CHF",
};

function normalizeCurrency(raw: string | null): string {
  if (!raw) return "MYR";
  const upper = raw.trim().toUpperCase();
  return CURRENCY_ALIASES[upper] || upper;
}

type Extracted = {
  merchant: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  type: "收入" | "支出";
  category: string | null;
};

async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  expenseCategories: string[],
  incomeCategories: string[]
): Promise<Extracted> {
  const categoryLine = `"category": "先看上面判断的 type：如果是支出，从这个清单选一个最符合的（食＝餐厅、外卖、超市、咖啡；衣＝服饰、鞋子；住＝房租、水电、家具、日用品；行＝交通，包括 Grab、的士、油站、停车）：${
    expenseCategories.join("、") || "（没有）"
  }。如果是收入，从这个清单选：${
    incomeCategories.join("、") || "（没有）"
  }。一定要原字不动地抄对应清单里的其中一个，实在判断不出来才填 null",`;

  const prompt = `你在看一张单据的照片，可能是购物收据，也可能是利息单、存款单、转账通知这类收款证明。请只抓这几个栏位，用 JSON 格式回答：
{
  "merchant": "商家或单位名称，看不出来就填 null",
  "date": "单据上的日期，格式 YYYY-MM-DD，看不出来就填 null",
  "total": 最终金额（TOTAL / GRAND TOTAL / AMOUNT DUE / 利息金额 / 存入金额 那一行，不是小计 subtotal，不是单独税额），纯数字，看不出来就填 null,
  "currency": "这张单据用的货币，3个字母的 ISO 代码，例如 MYR、USD、SGD、CHF、EUR、THB、IDR、CNY、GBP、JPY，从单据上的货币符号、代码或文字判断，看不出来就填 null",
  "type": "这笔钱是「收入」还是「支出」？银行利息、存款回条、转入通知、退款这类钱进来的算收入；一般消费购物、账单、付款单这类钱出去的算支出。只能填 收入 或 支出，看不出来就填 支出",
  ${categoryLine}
}
只回答这个 JSON，不要加其他文字或说明。`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini vision error:", res.status, detail);
    throw new Error("AI 看不懂这张收据");
  }

  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    return {
      merchant: parsed.merchant ?? null,
      date: parsed.date ?? null,
      total: typeof parsed.total === "number" ? parsed.total : parseFloat(parsed.total) || null,
      currency: parsed.currency ?? null,
      type: parsed.type === "收入" ? "收入" : "支出",
      category: typeof parsed.category === "string" ? parsed.category : null,
    };
  } catch (err) {
    console.error("Failed to parse Gemini response:", text, err);
    throw new Error("看不懂 AI 回传的内容");
  }
}

async function convertToMYR(amount: number, currency: string): Promise<{ myrAmount: number; rate: number }> {
  if (currency === "MYR") {
    return { myrAmount: amount, rate: 1 };
  }
  const res = await fetch(
    `https://api.frankfurter.app/latest?amount=${amount}&from=${currency}&to=MYR`
  );
  if (!res.ok) {
    throw new Error(`不认识这个货币：${currency}`);
  }
  const data = await res.json();
  const myrAmount = data.rates?.MYR;
  if (typeof myrAmount !== "number") {
    throw new Error(`换算不到 ${currency} 兑 MYR 的汇率`);
  }
  return { myrAmount, rate: myrAmount / amount };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务器还没设置 Gemini API 金钥" }, { status: 500 });
  }

  let body: {
    imageBase64: string;
    mimeType: string;
    expenseCategories?: string[];
    incomeCategories?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  if (!body.imageBase64 || !body.mimeType) {
    return NextResponse.json({ error: "没有收到图片" }, { status: 400 });
  }

  try {
    const expenseCategories = Array.isArray(body.expenseCategories) ? body.expenseCategories : [];
    const incomeCategories = Array.isArray(body.incomeCategories) ? body.incomeCategories : [];
    const extracted = await extractFromImage(
      body.imageBase64,
      body.mimeType,
      apiKey,
      expenseCategories,
      incomeCategories
    );

    if (!extracted.total || extracted.total <= 0) {
      return NextResponse.json({ error: "看不出这张单据的金额，请手动填写" }, { status: 422 });
    }

    const currency = normalizeCurrency(extracted.currency);
    const { myrAmount, rate } = await convertToMYR(extracted.total, currency);
    const validCategories = extracted.type === "收入" ? incomeCategories : expenseCategories;
    const category = extracted.category && validCategories.includes(extracted.category) ? extracted.category : null;

    return NextResponse.json({
      merchant: extracted.merchant,
      date: extracted.date,
      originalAmount: extracted.total,
      currency,
      myrAmount,
      rate,
      type: extracted.type,
      category,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "识别失败，请再试一次";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
