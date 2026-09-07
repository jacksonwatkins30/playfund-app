# PlayFund — pilot readiness plan (5 clubs, real families, real money)

## Context

PlayFund has a real, working frontend (`index.html`, deployed live at `jacksonwatkins30.github.io/playfund-app`) and a real backend (Cloudflare Worker + Supabase) — but the backend, hosting, and GitHub repo are all currently on Jackson's personal accounts, and money doesn't actually move yet: Stripe is 3 hardcoded test-mode Payment Links with no Connect accounts, no fee split, and no real Klarna. The goal is to get to a state where 5 real clubs can be onboarded and real parents will trust entering payment info and their kid's information — which means real payments, a professional web presence, and basic legal/data-safety coverage, not just working code.

Staying blocked on Jackson (no forked/duplicate infrastructure) and no fixed date — sequence by dependency, optimize for 5 clubs' worth of trust and correctness, not speed.

## Phase 0 — Groundwork (do now, doesn't need Jackson)

1. **Commit and push your current fixes.** `index.html` has uncommitted work from this session (Stripe modal bug fixes, athlete-persistence fix, true-cost receipt screen) sitting on the `parent-checkout-screens` branch. Confirm you have push access to `jacksonwatkins30/playfund-app` — if not, that's part of the access conversation with Jackson too.
2. **Send the access/ownership message to Jackson** (drafted earlier): Worker repo access, which Stripe account it's pointed at, Cloudflare account ownership. Everything in Phase 1 is blocked until this resolves.
3. **Buy a real domain** (e.g. `playfund.com` or similar) if you don't already own one. `jacksonwatkins30.github.io/playfund-app` is not a URL a parent will trust with a credit card. Point it at the GitHub Pages / Cloudflare Pages deployment once hosting ownership is sorted — this needs Jackson too, but the purchase itself doesn't.
4. **Verify minors' data minimization.** Confirm the Supabase athlete records only store name, team, and age group (per CLAUDE.md) — nothing extra like birthdate/address/photos. Read-only check once you (or Jackson) can query the DB.

## Phase 1 — Real payments (blocked on Jackson's access)

5. Decide **PlayFund's fee %** — needed before any charge logic is written.
6. Confirm the Worker will point at **your PlayFund Stripe sandbox**, not Jackson's personal account (pending his answer).
7. Build **Stripe Connect Express onboarding** in the Worker (new route: create connected account + generate Account Link). At 5 clubs, wire this to the *existing* onboarding screens (`screen-club-register-1` through `-4`, and the design reference's club-onboarding flow) rather than onboarding each club by hand — the UI already exists, it just posts nowhere real yet.
8. Store `stripe_account_id` + onboarding status on each club record in Supabase.
9. Replace the 3 hardcoded `STRIPE_LINKS` (`index.html`, `openStripeCheckout()`) with a real **Checkout Session created server-side** in the Worker, carrying `application_fee_amount` + `transfer_data.destination` = the club's connected account.
10. Enable **Klarna** as a payment method on that same session (this is what makes "club paid now, parent pays over time" work — no custom installment logic needed).
11. Add a **Stripe webhook route** in the Worker (`payment_intent.succeeded`, Connect account `capability.updated` / onboarding-complete events) so payment status and club onboarding status are driven by Stripe, not the client-side "I've paid" button.
12. Handle the **Klarna decline path** for real — the UI fork (split with another payer / deposit / club's own plan) already exists as a static screen; wire it to an actual decline webhook event.

## Phase 2 — Trust surface

13. **Custom domain + HTTPS** live (from Phase 0 purchase).
14. **Privacy Policy + Terms of Service pages**, linked from the footer/trust lines already in the UI ("Secured by Stripe"). Real requirement before collecting minors' data and payment info from strangers.
15. **BNPL credit disclosure copy** on the Klarna option — CLAUDE.md already locks this: never claim BNPL doesn't affect credit. Confirm the live copy says something accurate, not silent.
16. **A real support contact** (email at minimum) visible somewhere in the parent flow — what does a confused/worried parent do when something goes wrong with their payment?
17. **Basic security pass**: confirm no real secrets are hardcoded in `index.html` beyond the Supabase anon key (safe by design), and that admin login isn't a client-side-checked passcode.

## Phase 3 — Real club onboarding + end-to-end proof

18. Replace demo data (`BBALL1`, seeded fake roster) — onboard the actual 5 pilot clubs for real through the flow built in Phase 1.
19. **Full test-mode run per club**: onboard the club, register a test athlete, pay in full, pay via Klarna, confirm the fee split lands correctly, trigger a decline, trigger a refund.
20. **One small real-money live transaction** per club once test mode is clean, before opening it to real families — the actual final trust check.

## Verification

- Phase 0: `git status`/`git log` on the branch confirm work is committed and pushed; a `curl` to the live GitHub Pages URL confirms it still serves the current build.
- Phase 1: Stripe Dashboard (test mode) shows a connected account per club with `charges_enabled: true`; a test Checkout Session shows the correct `application_fee_amount` and destination in the Stripe Dashboard's payment detail view; Supabase athlete row flips to "funded" only after the webhook fires, not before.
- Phase 2: privacy/terms pages resolve at real URLs; the Klarna screen's copy is read back verbatim to confirm no credit-impact claim.
- Phase 3: for each of the 5 clubs, a full test-mode dry run (steps in item 19) before any live transaction.

## Test credentials & fixtures

Real, working test-mode fixtures built while testing the embedded checkout — reuse these instead of creating new ones each session. Everything here is Stripe **test mode** and Supabase data clearly labeled as throwaway (never used for a real pilot club).

**Test club:** "Claude QA Test Club 3 (delete me)"
- Club ID: `d60d69fa-61d0-4e15-bd1b-7655c2b63899`
- Club code: `5D2GU64`
- Stripe Connect (Express, test mode): `acct_1UD3r8Pyhg7pV7GM` — fully onboarded (test data), `charges_enabled`
- Club admin email: `ajjurko4+claudetest3@gmail.com` (Gmail +alias, lands in AJ's own inbox). No password is set — this account was created via Supabase magic-link invite, not signup. To get a fresh session token for it, call `POST /club/register` again for a new test club (returns `invite_url` directly in the JSON response) or use Supabase's admin API to generate a new invite link for this same user.

**Test team:** "QA Team" — ID `30db569f-3f33-404d-b242-f19c6c0f7424`, dues $500.00

**Test athlete:** "QA Test Athlete" — ID `c0e4b995-b993-483d-b042-30f6a8ed42b3`, approved, parent email `ajjurko4+claudeparent@gmail.com`. Already has real succeeded test payments on it (one Klarna, one card) — good for testing "already paid" screens; register a fresh athlete under the same club/team for testing the unpaid → paid flow from scratch.

**Deep links straight into checkout** (bypasses registration, uses the athlete above):
- Pay in full: `https://playfundai.github.io/playfund-app/?code=5D2GU64&athlete=c0e4b995-b993-483d-b042-30f6a8ed42b3&method=full`
- Installments (Klarna): `https://playfundai.github.io/playfund-app/?code=5D2GU64&athlete=c0e4b995-b993-483d-b042-30f6a8ed42b3&method=bnpl`

**Stripe test card numbers** (any future expiry, any 3-digit CVC, any ZIP):
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declines (generic decline)
- `4000 0000 0000 9995` — declines (insufficient funds)
- Klarna in test mode doesn't need a card — it's a simple "Confirm test payment" click-through.

**Stripe config:** `PAY_IN_FULL_PMC_ID` = `pmc_1UD4SnPyhgYp24ebsPEd8LSJ` — the Payment Method Configuration that keeps Link/Klarna/Affirm/Afterpay off the "pay in full" checkout (see `worker/index.js`). Not a secret, safe to reference.

**Known cleanup owed:** two earlier throwaway test clubs also exist in Supabase from this same testing pass — "Claude QA Test Club (delete me)" and "Claude QA Test Club 2 (delete me)" — both inactive, no Stripe account, harmless but unused. Delete via Supabase directly whenever convenient.
