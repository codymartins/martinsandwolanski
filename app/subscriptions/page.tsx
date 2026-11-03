import { loadRefs } from "@/lib/data";
import { usd, ventureName } from "@/lib/money";
import { addSubscription, toggleSubscription } from "@/app/actions";
import { AccountSelect, VentureSelect } from "@/app/components/AccountSelect";

export const dynamic = "force-dynamic";

const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

export default async function SubscriptionsPage() {
  const { supabase, accounts } = await loadRefs();
  const { data: subs } = await supabase.from("subscriptions").select("*").order("active", { ascending: false }).order("name");
  const list = subs ?? [];
  const monthly = list.filter((s) => s.active).reduce((t, s) => t + s.amount_cents * PER_MONTH[s.cadence], 0);
  const acct = (id: string | null) => accounts.find((a) => a.id === id)?.label ?? "";

  return (
    <>
      <h1>Subscriptions</h1>
      <div className="grid">
        <div className="card"><div className="label">Per month</div><div className="value">{usd(Math.round(monthly))}</div></div>
        <div className="card"><div className="label">Per year</div><div className="value">{usd(Math.round(monthly * 12))}</div></div>
      </div>

      <h2>Add a subscription</h2>
      <form action={addSubscription} className="inline">
        <label>Name<input name="name" required placeholder="e.g. Hostinger" /></label>
        <label>Amount<input name="amount" inputMode="decimal" required placeholder="0.00" /></label>
        <label>
          Every
          <select name="cadence">
            <option value="monthly">Month</option>
            <option value="quarterly">Quarter</option>
            <option value="yearly">Year</option>
          </select>
        </label>
        <VentureSelect defaultValue="general" />
        <AccountSelect accounts={accounts} label="Charged to" />
        <label>Next renewal<input type="date" name="next_renewal" /></label>
        <button type="submit">Add</button>
      </form>

      <h2>All subscriptions</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Venture</th><th>Charged to</th><th>Next renewal</th><th className="num">Amount</th><th /></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="muted">No subscriptions yet.</td></tr>}
            {list.map((s) => (
              <tr key={s.id} className={s.active ? "" : "muted"}>
                <td>{s.name}</td>
                <td>{ventureName(s.venture_id)}</td>
                <td>{acct(s.account_id)}</td>
                <td>{s.next_renewal ?? ""}</td>
                <td className="num">{usd(s.amount_cents)} / {s.cadence.replace("ly", "")}</td>
                <td>
                  <form action={toggleSubscription}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={String(!s.active)} />
                    <button className="secondary" type="submit">{s.active ? "Cancel" : "Reactivate"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
