import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, VENTURES, ventureName } from "@/lib/money";

export const dynamic = "force-dynamic";

type Pnl = { month: string; venture_id: string; revenue_cents: number | null; expense_cents: number | null; profit_cents: number | null };

export default async function Overview() {
  const supabase = await createClient();
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;

  const [{ data: pnl }, { data: balances }, { count: openDeals }, { count: review }] = await Promise.all([
    supabase.from("venture_monthly_pnl").select("*").gte("month", yearStart).order("month"),
    supabase.from("member_balances").select("owner_id, name, owed_cents").order("name"),
    supabase.from("deals").select("id", { count: "exact", head: true }).neq("status", "closed"),
    supabase.from("transactions").select("id", { count: "exact", head: true }).or("needs_review.eq.true,venture_id.is.null").in("kind", ["revenue", "expense", "refund"]),
  ]);

  const rows = (pnl ?? []) as Pnl[];
  const sum = (filter: (r: Pnl) => boolean, k: keyof Pnl) =>
    rows.filter(filter).reduce((t, r) => t + Number(r[k] ?? 0), 0);

  const months = [...new Set(rows.map((r) => r.month))];
  const ventureIds = [...VENTURES.map((v) => v.id as string), ...(rows.some((r) => r.venture_id === "unassigned") ? ["unassigned"] : [])];

  return (
    <>
      <h1>Overview</h1>

      <div className="grid">
        <Stat label="Profit this month" cents={sum((r) => r.month === monthStart, "profit_cents")} signed />
        <Stat label="Revenue YTD" cents={sum(() => true, "revenue_cents")} />
        <Stat label="Expenses YTD" cents={sum(() => true, "expense_cents")} />
        <Stat label="Profit YTD" cents={sum(() => true, "profit_cents")} signed />
      </div>

      <h2>M&amp;W owes</h2>
      <div className="grid">
        {(balances ?? []).map((b) => (
          <Link key={b.owner_id} href="/owners" className="card">
            <div className="label">{b.name}</div>
            <div className="value">{usd(b.owed_cents)}</div>
          </Link>
        ))}
      </div>
      <p className="muted">
        {openDeals ?? 0} deals not closed · {review ?? 0} transactions need a venture
      </p>

      <h2>By venture, {now.getFullYear()}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Venture</th>
              <th className="num">Revenue</th>
              <th className="num">Expenses</th>
              <th className="num">Profit</th>
              <th className="num">This month</th>
            </tr>
          </thead>
          <tbody>
            {ventureIds.map((id) => {
              const mine = (r: Pnl) => r.venture_id === id;
              const profit = sum(mine, "profit_cents");
              const thisMonth = sum((r) => mine(r) && r.month === monthStart, "profit_cents");
              return (
                <tr key={id}>
                  <td>{ventureName(id)}</td>
                  <td className="num">{usd(sum(mine, "revenue_cents"))}</td>
                  <td className="num">{usd(sum(mine, "expense_cents"))}</td>
                  <td className={`num ${profit < 0 ? "neg" : "pos"}`}>{usd(profit)}</td>
                  <td className={`num ${thisMonth < 0 ? "neg" : ""}`}>{usd(thisMonth)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Monthly profit</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              {ventureIds.map((id) => (
                <th key={id} className="num">{ventureName(id)}</th>
              ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {months.length === 0 && (
              <tr><td colSpan={ventureIds.length + 2} className="muted">No transactions yet this year.</td></tr>
            )}
            {months.map((m) => (
              <tr key={m}>
                <td>{new Date(`${m}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                {ventureIds.map((id) => (
                  <td key={id} className="num">{usd(sum((r) => r.month === m && r.venture_id === id, "profit_cents"))}</td>
                ))}
                <td className="num"><strong>{usd(sum((r) => r.month === m, "profit_cents"))}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, cents, signed }: { label: string; cents: number; signed?: boolean }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`value ${signed ? (cents < 0 ? "neg" : "pos") : ""}`}>{usd(cents)}</div>
    </div>
  );
}
