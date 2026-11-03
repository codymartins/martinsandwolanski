import { loadRefs } from "@/lib/data";
import { usd } from "@/lib/money";
import { addCard, recordReimbursement } from "@/app/actions";
import { AccountSelect } from "@/app/components/AccountSelect";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const { supabase, owners, accounts } = await loadRefs();

  const cardIds = accounts.filter((a) => a.kind === "personal_card").map((a) => a.id);
  const [{ data: balances }, { data: purchases }, { data: reimbursements }] = await Promise.all([
    supabase.from("member_balances").select("*").order("name"),
    cardIds.length
      ? supabase.from("transactions").select("id, occurred_on, amount_cents, account_id, description, merchant")
          .in("account_id", cardIds).order("occurred_on", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as { id: string; occurred_on: string; amount_cents: number; account_id: string; description: string | null; merchant: string | null }[] }),
    supabase.from("transactions").select("id, occurred_on, amount_cents, counterparty_owner_id, description")
      .eq("kind", "member_reimbursement").order("occurred_on", { ascending: false }).limit(50),
  ]);

  const acct = (id: string) => accounts.find((a) => a.id === id)?.label ?? "?";
  const ownerName = (id: string | null) => owners.find((o) => o.id === id)?.name ?? "?";

  return (
    <>
      <h1>Owners</h1>

      <div className="grid">
        {(balances ?? []).map((b) => (
          <div key={b.owner_id} className="card">
            <div className="label">M&amp;W owes {b.name}</div>
            <div className="value">{usd(b.owed_cents)}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {usd(b.purchased_cents)} spent · {usd(b.reimbursed_cents)} paid back
            </div>
          </div>
        ))}
      </div>

      <h2>Record a reimbursement</h2>
      <form action={recordReimbursement} className="inline">
        <label>
          Paid to
          <select name="owner_id" required>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <AccountSelect accounts={accounts} kinds={["llc_bank", "venmo", "cash"]} label="Paid from" />
        <label>Amount<input name="amount" inputMode="decimal" required placeholder="0.00" /></label>
        <label>Date<input type="date" name="date" /></label>
        <label>Note<input name="description" placeholder="Zelle, check #, etc." /></label>
        <button type="submit">Record</button>
      </form>

      <h2>Personal cards</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Owner</th><th>Card</th></tr></thead>
          <tbody>
            {accounts.filter((a) => a.kind === "personal_card").map((a) => (
              <tr key={a.id}><td>{ownerName(a.owner_id)}</td><td>{a.name}{a.last4 ? ` ••${a.last4}` : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={addCard} className="inline" style={{ marginTop: 10 }}>
        <label>
          Owner
          <select name="owner_id" required>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label>Card name<input name="name" required placeholder="e.g. Amazon Prime Visa" /></label>
        <label>Last 4<input name="last4" maxLength={4} pattern="\d{4}" /></label>
        <button type="submit">Add card</button>
      </form>

      <h2>Recent personal-card purchases</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Card</th><th>What</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {(purchases ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.occurred_on}</td><td>{acct(t.account_id)}</td>
                <td>{t.description ?? t.merchant ?? ""}</td>
                <td className="num">{usd(-t.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Reimbursements</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>To</th><th>Note</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {(reimbursements ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.occurred_on}</td><td>{ownerName(t.counterparty_owner_id)}</td>
                <td>{t.description ?? ""}</td><td className="num">{usd(-t.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
