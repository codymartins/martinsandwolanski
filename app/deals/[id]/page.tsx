import { notFound } from "next/navigation";
import { loadRefs } from "@/lib/data";
import { usd, ventureName } from "@/lib/money";
import { addDealLine, deleteTransaction, setDealStatus } from "@/app/actions";
import { AccountSelect } from "@/app/components/AccountSelect";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, accounts } = await loadRefs();

  const [{ data: deal }, { data: lines }] = await Promise.all([
    supabase.from("deal_summary").select("*").eq("id", id).maybeSingle(),
    supabase.from("transactions").select("*").eq("deal_id", id).order("occurred_on"),
  ]);
  if (!deal) notFound();

  const acct = (aid: string) => accounts.find((a) => a.id === aid)?.label ?? "?";

  return (
    <>
      <h1>{deal.title}</h1>
      <p className="muted">
        {ventureName(deal.venture_id)} · opened {deal.opened_on} · <span className="badge">{deal.status}</span>
      </p>

      <div className="grid">
        <div className="card"><div className="label">Cost</div><div className="value">{usd(deal.cost_cents)}</div></div>
        <div className="card"><div className="label">Sales</div><div className="value">{usd(deal.sales_cents)}</div></div>
        <div className="card">
          <div className="label">Profit</div>
          <div className={`value ${deal.profit_cents < 0 ? "neg" : "pos"}`}>{usd(deal.profit_cents)}</div>
        </div>
      </div>

      <h2>Add to this deal</h2>
      <form action={addDealLine} className="inline">
        <input type="hidden" name="deal_id" value={id} />
        <label>
          Type
          <select name="type">
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="fee">Fee</option>
          </select>
        </label>
        <AccountSelect accounts={accounts} />
        <label>Amount<input name="amount" inputMode="decimal" required placeholder="0.00" /></label>
        <label>Merchant / buyer<input name="merchant" /></label>
        <label>Date<input type="date" name="date" /></label>
        <button type="submit">Add</button>
      </form>
      <p className="muted">
        Purchases on a personal card add to what M&amp;W owes that owner. Sales should go to the account the money
        actually landed in (LLC Bank, Venmo Business or Cash).
      </p>

      <h2>Lines</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Account</th><th>Merchant</th><th className="num">Amount</th><th /></tr>
          </thead>
          <tbody>
            {(lines ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.occurred_on}</td>
                <td>{t.kind === "revenue" ? "Sale" : t.category ?? t.kind}</td>
                <td>{acct(t.account_id)}</td>
                <td>{t.merchant ?? ""}</td>
                <td className={`num ${t.amount_cents < 0 ? "neg" : "pos"}`}>{usd(t.amount_cents)}</td>
                <td>
                  {t.source === "manual" && (
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="secondary" type="submit">Delete</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Status</h2>
      <form action={setDealStatus} className="inline">
        <input type="hidden" name="deal_id" value={id} />
        <select name="status" defaultValue={deal.status}>
          <option value="open">Open (bought, not sold)</option>
          <option value="sold">Sold</option>
          <option value="closed">Closed (owners paid back)</option>
        </select>
        <button type="submit">Update</button>
      </form>
    </>
  );
}
