import { createClient } from "@/lib/supabase/server";

export type Account = { id: string; name: string; kind: string; owner_id: string | null; last4: string | null };
export type Owner = { id: string; name: string };

export async function loadRefs() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: owners }] = await Promise.all([
    supabase.from("accounts").select("id, name, kind, owner_id, last4").eq("active", true).order("name"),
    supabase.from("owners").select("id, name").order("name"),
  ]);
  const ownerList = (owners ?? []) as Owner[];
  const accountList = (accounts ?? []) as Account[];
  const label = (a: Account) => {
    const owner = ownerList.find((o) => o.id === a.owner_id);
    return [owner ? `${owner.name}:` : null, a.name, a.last4 ? `••${a.last4}` : null].filter(Boolean).join(" ");
  };
  return {
    supabase,
    owners: ownerList,
    accounts: accountList.map((a) => ({ ...a, label: label(a) })),
  };
}
