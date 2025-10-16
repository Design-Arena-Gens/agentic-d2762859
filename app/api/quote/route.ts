import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface YahooQuoteItem {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  currency?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols") || searchParams.get("symbol");
  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols is required" }, { status: 400 });
  }
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50); // safety cap

  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;

  try {
    const res = await fetch(yahooUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const json = (await res.json()) as {
      quoteResponse?: { result?: YahooQuoteItem[] };
    };

    const items = json?.quoteResponse?.result || [];
    const data: Record<string, {
      symbol: string;
      name: string;
      price: number | null;
      previousClose: number | null;
      currency: string | null;
    }> = {};

    for (const item of items) {
      const name = item.shortName || item.longName || item.symbol;
      data[item.symbol.toUpperCase()] = {
        symbol: item.symbol.toUpperCase(),
        name,
        price: item.regularMarketPrice ?? null,
        previousClose: item.regularMarketPreviousClose ?? null,
        currency: item.currency ?? null,
      };
    }

    // Ensure requested symbols present, even if missing upstream
    for (const s of symbols) {
      if (!data[s]) {
        data[s] = { symbol: s, name: s, price: null, previousClose: null, currency: null };
      }
    }

    return NextResponse.json({ symbols: symbols, data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "fetch failed" }, { status: 500 });
  }
}
