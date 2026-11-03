# M&W Dashboard: Build Spec

One place to see the revenue, expenses and profit of every Martins & Wolanski Capital venture, and to see what M&W owes each owner for purchases made on their personal cards.

Stack: Next.js on Vercel, Supabase (Postgres + Auth). QuickBooks Online is the official set of books. The dashboard is the operating view, and it reconciles to QuickBooks.

## 1. Ventures and where their money moves

| Venture | Money in | Money out | Detail source |
|---|---|---|---|
| Websites (Web Systems Group) | Stripe, paid out to the LLC bank | Hostinger and tools, on the LLC card | Stripe API |
| Pokemon vending | Nayax, paid out to the LLC bank | Inventory, on the LLC card or personal cards | Nayax API |
| Cashouts | Buyer pays the LLC bank | Purchases on personal cards | Deals (manual) + LLC bank feed |
| Reselling | Venmo Business, cash | Purchases on personal cards | Deals (manual) + Venmo CSV + cash form |
| General / overhead | n/a | Subscriptions, fees, LLC costs | LLC bank and LLC card feed |

## 2. Core accounting rules

1. **Every dollar is a row in `transactions`.** Amounts are integer cents, signed from M&W's point of view: positive is money in, negative is money out.
2. **A personal-card purchase is an M&W expense paid by an owner.** It is recorded against that owner's personal card account. That creates a balance M&W owes the owner. Card rewards belong to the cardholder and are never recorded.
3. **Paying an owner back is a reimbursement, not an expense.** It is a transaction from the LLC bank with `kind = 'member_reimbursement'` and the owner set. It reduces the owner's balance and does not touch profit.
4. **Owed balance per owner = sum of their personal-card purchases − sum of their reimbursements.** It comes from the `member_balances` view and should match QuickBooks "Due to Members: <name>".
5. **Count revenue once.** Stripe and Nayax report gross sales and fees. Their payouts to the bank are marked `kind = 'transfer'` and are excluded from P&L. The bank deposit for a cashout sale is the revenue row itself, linked to its deal.
6. **Owner contributions and distributions** are their own kinds (`member_contribution`, `member_distribution`) and are excluded from P&L.

## 3. Deals (cashouts and reselling)

A deal groups everything about one flip:

- **Purchases:** one or more rows on personal cards (owner, card, merchant, amount, date).
- **Sales:** one or more rows where the money came in (LLC bank deposit, Venmo, cash), net of platform fees.
- **Status:** `open` (bought, not sold), `sold` (sale recorded), `closed` (every owner who paid has been reimbursed for it).
- **Profit:** sales − purchases − fees.

Logging flow on the phone: "New deal" → pick the venture, card and amount → save. When the sale hits the LLC bank, the deposit shows up in an **Unmatched deposits** queue, and one tap links it to the open deal.

## 4. Data sources and syncs

| Source | How | When | Notes |
|---|---|---|---|
| QuickBooks Online (LLC bank + LLC card) | Intuit OAuth app, Accounting API | Nightly Vercel cron + manual "Sync now" | Needs an Intuit developer app and an M&W QBO company |
| Stripe | Stripe API (restricted read key) | Nightly | Charges, fees, refunds, payouts per website client |
| Nayax | Nayax Lynx API | Nightly | Sales per machine. Need to confirm API access with Nayax |
| Venmo Business | CSV upload screen | Monthly | No usable public API |
| Cash | Quick-entry form | At the moment of the sale | Deposit to the bank is then marked as a transfer |
| Personal cards | Manual, through deals | When you buy | Deliberately not auto-synced (would pull in personal spending) |

Every synced row stores `source` and `external_id`, with a unique constraint, so re-running a sync never creates duplicates. Each run is logged in `sync_runs`.

**Categorization rules** (`categorization_rules`): a match on description, merchant or source sets the venture and category on incoming rows (for example "HOSTINGER" → Websites / Hosting). Anything unmatched lands in a **Needs review** queue.

## 5. Screens

1. **Overview:** this month and YTD revenue, expenses and profit, overall and for each venture. A monthly trend chart. Cards showing what M&W owes Cody, Connor and Mike.
2. **Venture page:** P&L by month, top expenses, and venture-specific stats (MRR and clients for Websites, sales per machine for Vending, deal count and average margin for Cashouts and Reselling).
3. **Deals:** open, sold and closed deals with profit, plus a "New deal" form.
4. **Owners and reimbursements:** each owner's running balance, the open purchases behind it, and a "Record reimbursement" button.
5. **Inbox:** unmatched deposits and uncategorized transactions.
6. **Subscriptions:** every recurring cost with amount, cadence, venture, next renewal and a monthly total.
7. **Imports and syncs:** Venmo CSV upload, "Sync now" buttons, and the last-run status of each source.

## 6. Access

Supabase Auth with magic links, limited to the three owners. Row-level security allows authenticated users who appear in `owners` and denies everyone else. Every row records `created_by`.

## 7. Build phases

1. **Foundation:** schema, auth, manual entry (deals, cash, reimbursements, subscriptions), Overview and Owners screens. Usable on day one, before any sync exists.
2. **Stripe sync + Venmo CSV import + categorization rules.**
3. **QuickBooks sync** (LLC bank and card), Unmatched deposits queue, **Nayax sync**.
4. **Write-back to QuickBooks:** push deal purchases as expenses paid from "Due to Members: <owner>" and reimbursements as payments against it, so the books need no double entry.

## 8. Setup the owners need to do

- Create a QuickBooks Online company for M&W, separate from Parteewagon. Add the "Due to Members: Cody / Connor / Mike" liability accounts.
- Link the LLC bank account and an LLC card to QBO. Move every subscription onto the LLC card.
- Open a Venmo Business profile for the LLC.
- Ask Nayax for API access (a Lynx API token).
- Create a Supabase project and a Vercel project for this repo.
