import Link from "next/link";
import { loadRefs } from "@/lib/data";
import { usd, ventureName } from "@/lib/money";
import { createDeal } from "@/app/actions";
import { AccountSelect, VentureSelect } from "@/app/components/AccountSelect";

export const dynamic = "force-dynamic";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase, accounts } = await loadRefs();

  let q = supabase.from("deal_summary").select("*").order("opened_on", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data: deals } = await q;

  return (
    <>
      <h1>Deals</h1>

      <h2>New deal</h2>
      <form action={createDeal} className="inline">
        <VentureSelect only={["cashouts", "reselling", "vending"]} defaultValue="cashouts" />
        <label>What<input name="title" required placeholder="e.g. 2x PS5 from Best Buy" /></label>
        <AccountSelect accounts={accounts} kinds={["personal_card", "llc_card", "llc_bank", "cash", "venmo"]} label="Paid with" />
        <label>Cost<input name="cost" inputMode="decimal" placeholder="0.00" /></label>
        <label>Merchant<input name="merchant" /></label>
        <label>Date<input type="date" name="date" /></label>
        <button type="submit">Create</button>
      </form>

      <h2>
        All deals{" "}
        <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
          <Link href="/deals">all</Link> · <Link href="/deals?status=open">open</Link> ·{" "}
          <Link href="/deals?status=sold">sold</Link> · <Link href="/deals?status=closed">closed</Link>
        </span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Opened</th><th>Deal</th><th>Venture</th><th>Status</th>
              <th className="num">Cost</th><th className="num">Sales</th><th className="num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {(deals ?? []).length === 0 && <tr><td colSpan={7} className="muted">No deals yet.</td></tr>}
            {(deals ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.opened_on}</td>
                <td><Link href={`/deals/${d.id}`}>{d.title}</Link></td>
                <td>{ventureName(d.venture_id)}</td>
                <td><span className="badge">{d.status}</span></td>
                <td className="num">{usd(d.cost_cents)}</td>
                <td className="num">{usd(d.sales_cents)}</td>
                <td className={`num ${d.profit_cents < 0 ? "neg" : "pos"}`}>{usd(d.profit_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
