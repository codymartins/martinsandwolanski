const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function usd(cents: number | null | undefined): string {
  return fmt.format((cents ?? 0) / 100);
}

/** Parse a dollar string like "1,234.56" or "$12" into positive integer cents. */
export function parseDollars(input: FormDataEntryValue | null): number {
  const raw = String(input ?? "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`"${input}" is not a valid dollar amount`);
  }
  const [whole, frac = ""] = raw.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const VENTURES = [
  { id: "websites", name: "Websites" },
  { id: "vending", name: "Vending" },
  { id: "cashouts", name: "Cashouts" },
  { id: "reselling", name: "Reselling" },
  { id: "general", name: "General" },
] as const;

export function ventureName(id: string | null | undefined): string {
  return VENTURES.find((v) => v.id === id)?.name ?? "Unassigned";
}
