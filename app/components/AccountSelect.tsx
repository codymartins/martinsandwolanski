type Opt = { id: string; label: string; kind: string };

export function AccountSelect({
  accounts,
  kinds,
  name = "account_id",
  label = "Account",
}: {
  accounts: Opt[];
  kinds?: string[];
  name?: string;
  label?: string;
}) {
  const list = kinds ? accounts.filter((a) => kinds.includes(a.kind)) : accounts;
  return (
    <label>
      {label}
      <select name={name} required>
        {list.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VentureSelect({ only, defaultValue }: { only?: string[]; defaultValue?: string }) {
  const all = [
    ["websites", "Websites"],
    ["vending", "Vending"],
    ["cashouts", "Cashouts"],
    ["reselling", "Reselling"],
    ["general", "General"],
  ];
  const list = only ? all.filter(([id]) => only.includes(id)) : all;
  return (
    <label>
      Venture
      <select name="venture_id" defaultValue={defaultValue} required>
        {list.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
