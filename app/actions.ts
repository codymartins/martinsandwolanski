"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDollars } from "@/lib/money";

type DB = Awaited<ReturnType<typeof createClient>>;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function optional(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function ownerId(supabase: DB): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("owners").select("id").eq("auth_user_id", user.id).maybeSingle();
  return data?.id ?? null;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Deals ----------

export async function createDeal(fd: FormData) {
  const supabase = await createClient();
  const me = await ownerId(supabase);
  const date = optional(fd, "date") ?? today();

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      venture_id: str(fd, "venture_id"),
      title: str(fd, "title"),
      opened_on: date,
      notes: optional(fd, "notes"),
      created_by: me,
    })
    .select("id")
    .single();
  check(error);

  const cost = str(fd, "cost");
  if (cost) {
    check(
      (
        await supabase.from("transactions").insert({
          occurred_on: date,
          amount_cents: -parseDollars(cost),
          kind: "expense",
          category: "Inventory",
          account_id: str(fd, "account_id"),
          venture_id: str(fd, "venture_id"),
          merchant: optional(fd, "merchant"),
          description: str(fd, "title"),
          deal_id: deal!.id,
          created_by: me,
        })
      ).error
    );
  }
  revalidatePath("/", "layout");
  redirect(`/deals/${deal!.id}`);
}

export async function addDealLine(fd: FormData) {
  const supabase = await createClient();
  const me = await ownerId(supabase);
  const dealId = str(fd, "deal_id");
  const type = str(fd, "type"); // purchase | sale | fee
  const cents = parseDollars(fd.get("amount"));

  const { data: deal, error } = await supabase
    .from("deals")
    .select("venture_id, title")
    .eq("id", dealId)
    .single();
  check(error);

  const row = {
    occurred_on: optional(fd, "date") ?? today(),
    amount_cents: type === "sale" ? cents : -cents,
    kind: type === "sale" ? "revenue" : "expense",
    category: type === "sale" ? "Sales" : type === "fee" ? "Fees" : "Inventory",
    account_id: str(fd, "account_id"),
    venture_id: deal!.venture_id,
    merchant: optional(fd, "merchant"),
    description: optional(fd, "description") ?? deal!.title,
    deal_id: dealId,
    created_by: me,
  };
  check((await supabase.from("transactions").insert(row)).error);

  if (type === "sale") {
    await supabase.from("deals").update({ status: "sold" }).eq("id", dealId).eq("status", "open");
  }
  revalidatePath("/", "layout");
}

export async function setDealStatus(fd: FormData) {
  const supabase = await createClient();
  const status = str(fd, "status");
  check(
    (
      await supabase
        .from("deals")
        .update({ status, closed_on: status === "closed" ? today() : null })
        .eq("id", str(fd, "deal_id"))
    ).error
  );
  revalidatePath("/", "layout");
}

export async function deleteTransaction(fd: FormData) {
  const supabase = await createClient();
  check((await supabase.from("transactions").delete().eq("id", str(fd, "id")).eq("source", "manual")).error);
  revalidatePath("/", "layout");
}

// ---------- Owners ----------

export async function addCard(fd: FormData) {
  const supabase = await createClient();
  check(
    (
      await supabase.from("accounts").insert({
        name: str(fd, "name"),
        kind: "personal_card",
        owner_id: str(fd, "owner_id"),
        last4: optional(fd, "last4"),
      })
    ).error
  );
  revalidatePath("/", "layout");
}

export async function recordReimbursement(fd: FormData) {
  const supabase = await createClient();
  const me = await ownerId(supabase);
  check(
    (
      await supabase.from("transactions").insert({
        occurred_on: optional(fd, "date") ?? today(),
        amount_cents: -parseDollars(fd.get("amount")),
        kind: "member_reimbursement",
        account_id: str(fd, "account_id"),
        counterparty_owner_id: str(fd, "owner_id"),
        description: optional(fd, "description") ?? "Reimbursement",
        created_by: me,
      })
    ).error
  );
  revalidatePath("/", "layout");
}

// ---------- Manual transactions ----------

const SIGN: Record<string, 1 | -1> = {
  revenue: 1,
  expense: -1,
  member_contribution: 1,
  member_distribution: -1,
};

export async function addTransaction(fd: FormData) {
  const supabase = await createClient();
  const me = await ownerId(supabase);
  const kind = str(fd, "kind");
  const sign = SIGN[kind];
  if (!sign) throw new Error(`Unsupported kind: ${kind}`);

  check(
    (
      await supabase.from("transactions").insert({
        occurred_on: optional(fd, "date") ?? today(),
        amount_cents: sign * parseDollars(fd.get("amount")),
        kind,
        account_id: str(fd, "account_id"),
        venture_id: kind.startsWith("member_") ? null : str(fd, "venture_id"),
        counterparty_owner_id: kind.startsWith("member_") ? str(fd, "owner_id") : null,
        category: optional(fd, "category"),
        description: optional(fd, "description"),
        merchant: optional(fd, "merchant"),
        created_by: me,
      })
    ).error
  );
  revalidatePath("/", "layout");
}

// ---------- Subscriptions ----------

export async function addSubscription(fd: FormData) {
  const supabase = await createClient();
  check(
    (
      await supabase.from("subscriptions").insert({
        name: str(fd, "name"),
        vendor: optional(fd, "vendor"),
        amount_cents: parseDollars(fd.get("amount")),
        cadence: str(fd, "cadence"),
        venture_id: str(fd, "venture_id"),
        account_id: optional(fd, "account_id"),
        next_renewal: optional(fd, "next_renewal"),
      })
    ).error
  );
  revalidatePath("/subscriptions");
}

export async function toggleSubscription(fd: FormData) {
  const supabase = await createClient();
  check(
    (
      await supabase
        .from("subscriptions")
        .update({ active: str(fd, "active") === "true" })
        .eq("id", str(fd, "id"))
    ).error
  );
  revalidatePath("/subscriptions");
}
