"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Holding = {
  id: string;
  symbol: string;
  shares: number;
  costPerShare: number; // in currency
};

type Quote = {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  currency: string | null;
};

function formatCurrency(value: number, currency: string | null): string {
  const c = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
  }
}

function formatSigned(value: number, fractionDigits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value).toFixed(fractionDigits);
  return `${sign}${abs}`;
}

const STORAGE_KEY = "portfolio.holdings.v1";

export default function Page() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [symbolsInput, setSymbolsInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const symbolRef = useRef<HTMLInputElement>(null);
  const sharesRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Holding[];
        setHoldings(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
    } catch {}
  }, [holdings]);

  const symbols = useMemo(() => {
    const set = new Set<string>();
    holdings.forEach((h) => set.add(h.symbol.toUpperCase()));
    const extra = symbolsInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    extra.forEach((s) => set.add(s));
    return Array.from(set).sort();
  }, [holdings, symbolsInput]);

  async function refreshQuotes() {
    if (symbols.length === 0) {
      setQuotes({});
      setLastUpdated(Date.now());
      return;
    }
    setIsLoading(true);
    try {
      const url = `/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as { data: Record<string, Quote> };
      setQuotes(json.data || {});
      setLastUpdated(Date.now());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshQuotes();
    const id = setInterval(refreshQuotes, 60_000);
    return () => clearInterval(id);
  }, [symbols.join(",")]);

  function addHoldingFromInputs() {
    const symbol = symbolRef.current?.value?.toUpperCase().trim() || "";
    const shares = parseFloat(sharesRef.current?.value || "0");
    const cost = parseFloat(costRef.current?.value || "0");
    if (!symbol || !Number.isFinite(shares) || !Number.isFinite(cost) || shares <= 0 || cost < 0) {
      return;
    }
    const newHolding: Holding = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      shares,
      costPerShare: cost,
    };
    setHoldings((prev) => [newHolding, ...prev]);
    if (symbolRef.current) symbolRef.current.value = "";
    if (sharesRef.current) sharesRef.current.value = "";
    if (costRef.current) costRef.current.value = "";
  }

  function removeHolding(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsed = JSON.parse(text) as Holding[];
        if (Array.isArray(parsed)) {
          setHoldings(parsed);
        }
      } catch {}
    };
    reader.readAsText(file);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(holdings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    let totalCost = 0;
    let totalValue = 0;
    for (const h of holdings) {
      const q = quotes[h.symbol.toUpperCase()];
      const price = q?.price ?? 0;
      totalCost += h.shares * h.costPerShare;
      totalValue += h.shares * price;
    }
    const pl = totalValue - totalCost;
    const plPct = totalCost > 0 ? (pl / totalCost) * 100 : 0;
    return { totalCost, totalValue, pl, plPct };
  }, [holdings, quotes]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Stock Portfolio Tracker</div>
          <div className="subtle small">Local-only. No account. Data via Yahoo Finance.</div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={refreshQuotes} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn secondary" onClick={exportJson}>Export</button>
          <label className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            Import
            <input type="file" accept="application/json" style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importJson(file);
                e.currentTarget.value = "";
              }} />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input ref={symbolRef} className="input" placeholder="Symbol (e.g. AAPL)" style={{ minWidth: 160 }} />
          <input ref={sharesRef} className="input" placeholder="Shares" type="number" step="any" />
          <input ref={costRef} className="input" placeholder="Cost/Share" type="number" step="any" />
          <button className="btn" onClick={addHoldingFromInputs}>Add</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Extra symbols to watch (comma-separated)" style={{ minWidth: 320, flex: 1 }}
            value={symbolsInput} onChange={(e) => setSymbolsInput(e.target.value)} />
          <span className="badge">{symbols.length} symbols</span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Shares</th>
                <th>Cost/Share</th>
                <th>Price</th>
                <th>Market Value</th>
                <th>Avg Cost</th>
                <th>P/L</th>
                <th>P/L %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 18 }} className="subtle">
                    No holdings yet. Add one above.
                  </td>
                </tr>
              ) : (
                holdings.map((h) => {
                  const q = quotes[h.symbol.toUpperCase()];
                  const price = q?.price ?? null;
                  const currency = q?.currency ?? "USD";
                  const marketValue = price != null ? h.shares * price : null;
                  const pl = marketValue != null ? marketValue - h.shares * h.costPerShare : null;
                  const plPct = pl != null && h.costPerShare > 0 ? (pl / (h.shares * h.costPerShare)) * 100 : null;
                  const cls = pl == null ? "" : pl >= 0 ? "positive" : "negative";
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 700 }}>{h.symbol.toUpperCase()}</td>
                      <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{q?.name || "-"}</td>
                      <td>{h.shares}</td>
                      <td>{formatCurrency(h.costPerShare, currency)}</td>
                      <td>{price == null ? "-" : formatCurrency(price, currency)}</td>
                      <td>{marketValue == null ? "-" : formatCurrency(marketValue, currency)}</td>
                      <td>{formatCurrency(h.costPerShare, currency)}</td>
                      <td className={cls}>{pl == null ? "-" : formatSigned(pl)}</td>
                      <td className={cls}>{plPct == null ? "-" : `${formatSigned(plPct, 2)}%`}</td>
                      <td>
                        <button className="btn ghost" onClick={() => removeHolding(h.id)}>Remove</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <hr />
        <div className="footer">
          <div className="subtle small">
            {lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
          </div>
          <div style={{ textAlign: "right" }}>
            <div>Total Cost: {formatCurrency(totals.totalCost, quotes[symbols[0]]?.currency || "USD")}</div>
            <div>Total Value: {formatCurrency(totals.totalValue, quotes[symbols[0]]?.currency || "USD")}</div>
            <div className={totals.pl >= 0 ? "positive" : "negative"}>
              P/L: {formatSigned(totals.pl)} ({formatSigned(totals.plPct, 2)}%)
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="subtle small">
        Quotes are delayed and provided without guarantee. Do your own research.
      </div>
    </div>
  );
}
