# STC FoundIt

> The university lost-and-found network. Students report lost items and match them with found objects -- photos, descriptions, campus location, category-based matching, secure contact between students.

Stack: **Next.js + Tailwind** (web) + **React Native/Expo** (Android pilot app) + **Supabase** (auth, Postgres, storage), TypeScript throughout, shared types/validation in `packages/shared`.

## Run it (5 minutes)

### 1. Supabase project
1. Create a free project at supabase.com.
2. Storage -> create a **private** bucket named `report-images`.
3. Run every SQL migration in `supabase/migrations/` in filename order (`0001` through `0008`). If earlier migrations are already applied, apply only the migrations after the latest one you ran.
4. Project Settings -> API -> copy the Project URL and anon key.

### 2. Install and run the web app
```bash
npm install                      # from the repo root -- installs everything, web + shared
cd apps/web
cp ../../.env.example .env.local # paste in your Supabase URL + anon key
npm run dev
```
Open http://localhost:3000 -- visitors can view the public landing page and sign in or create an account. Browsing, posting, report details, and messaging require a signed-in account.

### Run the Android app
1. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and add the Supabase URL and public key from **Project Settings -> API**.
2. From the repository root, run `npm run dev:mobile`.
3. Open the project in Expo Go on an Android phone, or press `a` in the terminal with an Android emulator open.

See [`apps/mobile/README.md`](apps/mobile/README.md) for APK build and Android email-link setup.

### Enable account email verification
1. In Supabase, open **Authentication -> Sign In / Providers -> Email** and turn on **Confirm email**.
2. Open **Authentication -> URL Configuration**. Set **Site URL** to your deployed site (use `http://localhost:3000` while developing) and add the callback URL `https://your-domain.example/auth/confirm` to **Redirect URLs**. For local development, add `http://localhost:3000/auth/confirm` too.
3. Open **Authentication -> Email Templates -> Confirm signup**. Set the confirmation link to:
   `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email</a>`
4. Save, sign up with an email you can access, click the message link, and confirm you reach the signed-in reports page.

Supabase's built-in email sender is restricted for production use; configure custom SMTP before inviting students outside the project team.

## Where to change things

| I want to change... | Edit this file |
|---|---|
| Colors, dark/light background, accent green | `apps/web/src/app/globals.css` -- every color is one CSS variable at the top |
| Nav bar / logo text | `apps/web/src/app/layout.tsx` |
| Home page copy | `apps/web/src/app/page.tsx` |
| The lost/found form (both share one component) | `apps/web/src/components/ReportForm.tsx` |
| The feed / filters | `apps/web/src/app/reports/page.tsx` |
| Login / signup forms | `apps/web/src/app/login/page.tsx`, `apps/web/src/app/signup/page.tsx` |

You genuinely only need `globals.css` for a color/branding pass -- everything else reads from those variables.

## What's already built and working
- **Web app** (`apps/web`) -- pages: home, sign up, sign in, browse/filter feed, report-lost form, report-found form, private messaging, and admin moderation. Protected routes are redirected to sign-in and database/storage access is protected by RLS.
- **Android app** (`apps/mobile`) -- Expo pilot app with verified sign-in, report discovery and posting, private report photos, secure conversations, password recovery, profile, and report history.
- `supabase/migrations/0001_init.sql` -- core schema **with RLS**: reports are readable by any signed-in student; conversations/messages are locked to `conversation_members` only.
- `supabase/migrations/0002_locations_matching.sql`:
  - `campus_locations` -- hierarchical (faculty -> building -> floor), read-only from the client, managed via the Supabase dashboard/service role. `reports.location_id` points at it; the old free-text `location` is kept as a fallback.
  - `matches` -- a match row is visible **only to the two reporters involved**, never public. That's what protects against the "5 people claim the same iPhone" problem.
  - `compute_match_confidence()` / `generate_matches_for_report()` -- v1 matching: category (60%) + same location (25%) + within 3 days (15%), no AI needed. The report form calls this automatically right after posting.
- `supabase/migrations/0007_private_report_images.sql` makes report photos private; signed-in users receive short-lived image links.
- `supabase/migrations/0008_authz_hardening.sql` adds admin and ban controls enforced by RLS, limits uploads, and denies suspended accounts access.

After migration `0008`, promote your verified account to admin in the Supabase SQL Editor (replace the example address):
```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```
- `packages/shared` -- TypeScript types + zod validation for every table, shared so web and the future mobile app can't drift apart.

## Not built yet
- Push notifications, campus map UI, AI-based match scoring, university email verification, and multi-campus support are deferred until after the pilot.
- Before a real pilot, review account verification rules, moderation procedures, and privacy wording with the university.

## Roadmap
| Phase | Scope | Status |
|---|---|---|
| 1 -- Foundation | Repo, Supabase, auth, navigation | ✅ done |
| 2 -- Reports | Lost/found forms, categories, locations, images | ✅ done |
| 3 -- Discovery | Feed, search, filters | ✅ done |
| 4 -- Matching | Auto-match generation, notifications | ✅ generation done, notifications pending |
| 5 -- Contact | Secure messaging, ownership verification | ✅ basic private messaging |
| 6 -- Moderation | Admin dashboard, report abuse, bans | ✅ basic admin page |
| 7 -- Pilot | Web + Android app for 20-50 students, fix issues, polish branding | ⏳ |

## Next step
Run the migrations, add your Supabase keys, start the web app, and test the sign-in gate plus the lost/found flows with a few students before inviting a wider pilot group.
