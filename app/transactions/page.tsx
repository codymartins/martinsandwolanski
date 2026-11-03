import Link from "next/link";
import { loadRefs } from "@/lib/data";
import { usd, ventureName } from "@/lib/money";
import { addTransaction, deleteTransaction } from "@/app/actions";
import { AccountSelect, VentureSelect } from "@/app/components/AccountSelect";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  revenue: "Revenue", expense: "Expense", refund: "Refund", transfer: "Transfer",
  member_reimbursement: "Reimbursement", member_contribution: "Contribution", member_distribution: "Distribution",
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ venture?: string }> }) {
  const { venture } = await searchParams;
  const { supabase, accounts, owners } = await loadRefs();

  let q = supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).limit(300);
  if (venture === "unassigned") q = q.is("venture_id", null).in("kind", ["revenue", "expense", "refund"]);
  else if (venture) q = q.eq("venture_id", venture);
  const { data: txns } = await q;

  const acct = (id: string) => accounts.find((a) => a.id === id)?.label ?? "?";

  return (
    <>
      <h1>Transactions</h1>

      <h2>Add a transaction</h2>
      <form action={addTransaction} className="inline">
        <label>
          Type
          <select name="kind">
            <option value="revenue">Revenue (money in)</option>
            <option value="expense">Expense (money out)</option>
            <option value="member_contribution">Owner put money in</option>
            <option value="member_distribution">Profit paid out to owner</option>
          </select>
        </label>
        <VentureSelect defaultValue="reselling" />
        <AccountSelect accounts={accounts} />
        <label>Amount<input name="amount" inputMode="decimal" required placeholder="0.00" /></label>
        <label>Category<input name="category" placeholder="e.g. Supplies" /></label>
        <label>Description<input name="description" /></label>
        <label>
          Owner (contributions / payouts)
          <select name="owner_id">
            <option value="">-</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label>Date<input type="date" name="date" /></label>
        <button type="submit">Add</button>
      </form>
      <p className="muted">
        Use this for cash sales, one-off expenses and anything a sync doesn&apos;t pick up. Card purchases for a flip
        belong on a <Link href="/deals">deal</Link>.
      </p>

      <h2>
        Ledger{" "}
        <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
          <Link href="/transactions">all</Link> · <Link href="/transactions?venture=unassigned">needs a venture</Link>
        </span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Venture</th><th>Account</th><th>Description</th><th>Source</th>
              <th className="num">Amount</th><th />
            </tr>
          </thead>
          <tbody>
            {(txns ?? []).length === 0 && <tr><td colSpan={8} className="muted">Nothing here yet.</td></tr>}
            {(txns ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.occurred_on}</td>
                <td>{KIND_LABEL[t.kind] ?? t.kind}</td>
                <td>{t.kind.startsWith("member_") || t.kind === "transfer" ? "-" : ventureName(t.venture_id)}</td>
                <td>{acct(t.account_id)}</td>
                <td>
                  {t.deal_id ? <Link href={`/deals/${t.deal_id}`}>{t.description ?? "deal"}</Link> : t.description ?? t.category ?? ""}
                </td>
                <td className="muted">{t.source}</td>
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
    </>
  );
}
