import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav>
      <Link href="/" className="brand">M&amp;W</Link>
      {user && (
        <>
          <Link href="/">Overview</Link>
          <Link href="/deals">Deals</Link>
          <Link href="/owners">Owners</Link>
          <Link href="/transactions">Transactions</Link>
          <Link href="/subscriptions">Subscriptions</Link>
          <form action={signOut}>
            <button className="secondary" type="submit">Sign out</button>
          </form>
        </>
      )}
    </nav>
  );
}
