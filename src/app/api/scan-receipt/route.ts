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
): Promise<Extracted[]> {
  const categoryLine = `"category": "先看上面判断的 type：如果是支出，从这个清单选一个最符合的（食＝餐厅、外卖、超市、咖啡；衣＝服饰、鞋子；住＝房租、水电、家具、日用品；行＝交通，包括 Grab、的士、油站、停车；转账给别人、汇款这类如果没有更贴切的分类就选其他支出）：${
    expenseCategories.join("、") || "（没有）"
  }。如果是收入，从这个清单选：${
    incomeCategories.join("、") || "（没有）"
  }。一定要原字不动地抄对应清单里的其中一个，实在判断不出来才填 null",`;

  const prompt = `你在看一张财务相关的照片，可能是两种：
(a) 一张购物收据 —— 只代表一笔交易，只抓 TOTAL / GRAND TOTAL / AMOUNT DUE 那一行的最终金额
(b) 手机银行、电子钱包 App 的交易记录截图 —— 上面可能列了好几笔交易（例如一排一排的转账、消费、利息记录），要把每一笔都个别抓出来，图片上看到几笔就抓几笔，不要漏掉也不要多加

请把这张图片里每一笔交易都抓出来，回答一个 JSON 陣列，陣列里每一项的格式：
{
  "merchant": "商家名称、收款人名字，或者这笔交易的备注文字，看不出来就填 null",
  "date": "这笔交易的日期，格式 YYYY-MM-DD。如果图片用日期把好几笔交易分组（例如用「Thursday, 20 Aug 2026」当一组的标题），这组底下的交易都算这个日期。看不出来就填 null",
  "total": 这笔交易的金额，纯数字，看不出来就填 null,
  "currency": "这笔交易用的货币，3个字母的 ISO 代码，例如 MYR、USD、SGD、CHF、EUR、THB、IDR、CNY、GBP、JPY，看不出来默认 MYR",
  "type": "关键：如果画面上金额有颜色区分——金额是黑色/深色的是「支出」（钱出去了，包括转账给别人、消费、付款）；金额是青色、绿色或蓝绿色而且前面有加号（+）的是「收入」（钱进来了，例如 Interest 利息、收到的转账）。如果是普通购物收据没有颜色区分，一般算「支出」。只能填 收入 或 支出",
  ${categoryLine}
}
只回答这个 JSON 陣列，不要加其他文字或说明，也不要用 markdown 包起来。`;

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
    throw new Error("AI 看不懂这张图片");
  }

  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((parsed) => ({
      merchant: parsed.merchant ?? null,
      date: parsed.date ?? null,
      total: typeof parsed.total === "number" ? parsed.total : parseFloat(parsed.total) || null,
      currency: parsed.currency ?? null,
      type: parsed.type === "收入" ? "收入" : "支出",
      category: typeof parsed.category === "string" ? parsed.category : null,
    }));
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
    const extractedList = await extractFromImage(
      body.imageBase64,
      body.mimeType,
      apiKey,
      expenseCategories,
      incomeCategories
    );

    const valid = extractedList.filter((e) => e.total && e.total > 0);
    if (valid.length === 0) {
      return NextResponse.json({ error: "看不出这张图片里的金额，请手动填写" }, { status: 422 });
    }

    const transactions = await Promise.all(
      valid.map(async (extracted) => {
        const currency = normalizeCurrency(extracted.currency);
        const { myrAmount, rate } = await convertToMYR(extracted.total as number, currency);
        const validCategories = extracted.type === "收入" ? incomeCategories : expenseCategories;
        const category =
          extracted.category && validCategories.includes(extracted.category) ? extracted.category : null;

        return {
          merchant: extracted.merchant,
          date: extracted.date,
          originalAmount: extracted.total,
          currency,
          myrAmount,
          rate,
          type: extracted.type,
          category,
        };
      })
    );

    return NextResponse.json({ transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "识别失败，请再试一次";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
