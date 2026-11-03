import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: isOwner } = await supabase.rpc("claim_owner");
      if (!isOwner) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not-an-owner`);
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link-invalid`);
}
