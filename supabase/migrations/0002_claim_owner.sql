-- Links the signed-in auth user to their row in owners, matched by email.
-- Called by the app right after login. Non-owners get false and see nothing (RLS).
create function claim_owner() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  user_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null or user_email is null then
    return false;
  end if;
  update owners
     set auth_user_id = auth.uid()
   where lower(email) = user_email
     and (auth_user_id is null or auth_user_id = auth.uid());
  return exists (select 1 from owners where auth_user_id = auth.uid());
end $$;

revoke all on function claim_owner() from public;
grant execute on function claim_owner() to authenticated;
