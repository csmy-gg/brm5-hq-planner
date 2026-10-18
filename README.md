# BRM5 HQ Planner

A public-ready, manual HQ tracker with a 96-item research catalogue, session check-ins, delivery timers, staff and resource tracking, optional Google/Discord accounts, dark mode, history, and JSON backups. It does not connect to Roblox or perform game actions.

## Run locally

Use Node 22.12+ or Node 24. Run `npm ci`, then `npm run dev`. `npm test` runs the planner and persistence checks. `npm run build` creates deployable `dist/`; source lives in `src/`. `npm run preview` serves a built version.

Without Supabase configuration the full planner works as a guest. New profiles have no research, money, resources, staff, timers, deliveries or session history. The setup guide asks players to enter real values. Only the suggested 12-hour visit interval and 90% uptime estimate start with nonzero values.

## Supabase setup

1. Apply the SQL files in `supabase/migrations/` in filename order to a new Supabase project. Existing installations already applied through the integration must not reapply them.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from that project's dashboard. These values are public. Never put `service_role`, `sb_secret_`, provider client secrets or personal access tokens in a `VITE_` variable.
3. Enable Google and Discord under Authentication → Sign In / Providers. Create a web OAuth client in Google Cloud and an application in the Discord Developer Portal. Add the Supabase callback URL shown in each provider's settings: `https://<project-ref>.supabase.co/auth/v1/callback`. Enter client IDs and secrets directly in Supabase's provider settings, never in the repository or chat.
4. In Authentication → URL Configuration, set Site URL to the production website origin. Allow the exact `https://<site>/auth/callback` redirect. For development, also allow `http://127.0.0.1:5173/auth/callback` in the development project. Do not use a production callback wildcard for untrusted previews.
5. The app reads Auth's public settings and enables a sign-in button only after its provider is enabled. PKCE codes are exchanged on `/auth/callback` and removed from the address bar.

One account owns one row in `hq_profiles`. RLS permits owner reads only. Writes go through an authenticated compare-and-swap RPC; the privileged implementation is in a non-exposed `private` schema, and the public function runs as its caller. Guests receive no table access. Direct table writes are denied to browser roles.

`supabase/tests/security.sql` verifies owner access, cross-account isolation, guest denial, direct-write denial, stale-save rejection and idempotent retries inside a transaction that rolls back its disposable users and profiles. `npm run test:database` tests the hosted Auth settings and unauthenticated REST boundaries using public environment values.

## Vercel deployment

Import the private GitHub repository into Vercel, choose Vite, use `npm test && npm run build` and output directory `dist`. The checked-in `vercel.json` configures this, the OAuth callback route and browser security headers. The production branch is `main`. Preview branches receive separate preview URLs.

Production environment variables:

```
VITE_SUPABASE_URL=https://<production-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_PRODUCTION_SUPABASE_URL=https://<production-ref>.supabase.co
```

For previews, leave the first two values empty for guest-only use, or point both to a **separate development Supabase project**. Set `VITE_PRODUCTION_SUPABASE_URL` to the production project's URL so the build rejects accidental production-database use in a preview. The production build also checks that its project matches that explicit production setting. Vercel runs the test suite before every build; a failing check prevents that deployment.

## Save behavior and recovery

Guests save to their browser. Signing in asks whether to use the guest HQ, an existing cloud HQ, or a new empty HQ. Account caches are keyed by Supabase project and user ID, separately from the guest save. Signing out returns to the guest HQ; unsynced account drafts stay under that account and a backup is offered.

Account edits persist locally first, then send complete snapshots through a serialized queue. The server checks the expected revision and records a mutation UUID. Retrying a request after a lost response cannot replay a payout. Newer device edits are queued against the acknowledged revision. Conflicts stop automatic writes, retain both copies and offer an explicit choice. Resolving a choice stores a recovery copy and downloads both versions. Cash and completed actions are never automatically merged.

The app retries on reconnect/focus and checks while visible every 30 seconds. Browser storage must be available. Device copies and backups contain the HQ data, not authentication tokens. Shared computers should use separate browser profiles. Clearing site data removes local drafts and recovery copies.

## Move an existing private tracker

Export a backup from the old website, then import it here and verify balances, staff, completed research, delivery payouts and remaining timers. Sign in to save that HQ to your account. Browser storage cannot automatically transfer across different website addresses. Keep the old tracker until migration is verified.

Imports keep stable research IDs and absolute timer deadlines. Backups without a timezone use Europe/Prague for compatibility with the original app. Future catalogue entries must have explicit new IDs; never reuse IDs. No personal starting profile, correction snapshot, recordings or historical personal session plan is included in this repository.

## Data and planning limits

Research costs and dependencies use the in-game tree recorded on 18 October 2026; nominal staff rates and sale prices use the [HQ wiki](https://roblox-blackhawk-rescue-mission-5.fandom.com/wiki/Headquarters). Cobra HD 3000, Matrix 2 and M320A1 retain named academic prerequisite subsets from the wiki where the video was unreadable. The planner is a constraint-respecting heuristic, not a proof of the fastest possible schedule. Injuries, raids, deaths and actual game balances require manual updates.

Changing timezone alone preserves session, research and delivery instants. Visit intervals use elapsed hours across daylight-saving changes. Nonexistent spring times are rejected; repeated autumn times use the first occurrence.
