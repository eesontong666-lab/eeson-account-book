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

export function normalizeCurrency(raw: string | null): string {
  if (!raw) return "MYR";
  const upper = raw.trim().toUpperCase();
  return CURRENCY_ALIASES[upper] || upper;
}

export async function convertToMYR(amount: number, currency: string): Promise<{ myrAmount: number; rate: number }> {
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

export type ExtractedTransaction = {
  merchant: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  type: "收入" | "支出";
  category: string | null;
};

export type ScannedTransaction = {
  merchant: string | null;
  date: string | null;
  originalAmount: number;
  currency: string;
  myrAmount: number;
  rate: number;
  type: "收入" | "支出";
  category: string | null;
};

export function categoryPromptLine(expenseCategories: string[], incomeCategories: string[]): string {
  return `"category": "先看上面判断的 type：如果是支出，从这个清单选一个最符合的（食＝餐厅、外卖、超市、咖啡；衣＝服饰、鞋子；住＝房租、水电、家具、日用品；行＝交通，包括 Grab、的士、油站、停车；转账给别人、汇款这类如果没有更贴切的分类就选其他支出）：${
    expenseCategories.join("、") || "（没有）"
  }。如果是收入，从这个清单选：${
    incomeCategories.join("、") || "（没有）"
  }。一定要原字不动地抄对应清单里的其中一个，实在判断不出来才填 null",`;
}

export async function finalizeTransactions(
  extractedList: ExtractedTransaction[],
  expenseCategories: string[],
  incomeCategories: string[]
): Promise<ScannedTransaction[]> {
  const valid = extractedList.filter((e) => e.total && e.total > 0);
  return Promise.all(
    valid.map(async (extracted) => {
      const currency = normalizeCurrency(extracted.currency);
      const { myrAmount, rate } = await convertToMYR(extracted.total as number, currency);
      const validCategories = extracted.type === "收入" ? incomeCategories : expenseCategories;
      const category =
        extracted.category && validCategories.includes(extracted.category) ? extracted.category : null;

      return {
        merchant: extracted.merchant,
        date: extracted.date,
        originalAmount: extracted.total as number,
        currency,
        myrAmount,
        rate,
        type: extracted.type,
        category,
      };
    })
  );
}

export function parseGeminiJsonArray(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function toExtractedTransaction(parsed: {
  merchant?: unknown;
  date?: unknown;
  total?: unknown;
  currency?: unknown;
  type?: unknown;
  category?: unknown;
}): ExtractedTransaction {
  return {
    merchant: typeof parsed.merchant === "string" ? parsed.merchant : null,
    date: typeof parsed.date === "string" ? parsed.date : null,
    total: typeof parsed.total === "number" ? parsed.total : parseFloat(String(parsed.total)) || null,
    currency: typeof parsed.currency === "string" ? parsed.currency : null,
    type: parsed.type === "收入" ? "收入" : "支出",
    category: typeof parsed.category === "string" ? parsed.category : null,
  };
}
