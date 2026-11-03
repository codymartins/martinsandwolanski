-- Run once after the migrations. Replace the emails with each owner's real login email.
insert into owners (name, email) values
  ('Cody',   'cody@example.com'),
  ('Connor', 'connor@example.com'),
  ('Mike',   'mike@example.com')
on conflict (name) do nothing;

-- M&W's own accounts. Personal cards are added from the Owners screen.
insert into accounts (name, kind) values
  ('LLC Bank',       'llc_bank'),
  ('LLC Card',       'llc_card'),
  ('Stripe',         'stripe'),
  ('Nayax',          'nayax'),
  ('Venmo Business', 'venmo'),
  ('Cash',           'cash');
