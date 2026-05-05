# Studio · Styled in Motion (Creator Web)

Creator-facing web app served at `studio.styledinmotion.studio`.
Phase 1A foundation: Supabase Auth (email + password), invite-only
signup, auth-gated dashboard shell with a sidebar nav. The Closet,
Looks, Collage, Drafts, and Profile surfaces are stubs that ship
in Phase 1B–1D.

For the bigger plan, see `business/creator-web-build-plan.md`.

## Local development

```bash
cd creators-web
cp .env.example .env.local       # then fill in keys
npm install
npm run dev                       # boots on http://localhost:3001
```

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same value as the iOS app + shop.studio |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only, used for invite consumption |
| `NEXT_PUBLIC_BACKEND_URL` | Phase 1B+ | Hono backend for productInfo URL scraping |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3001` locally, `https://studio.styledinmotion.studio` in prod |

## Auth model

- Same Supabase project as the iOS app and `web/` (shop subdomain).
  Credentials are interchangeable: a creator who signed up on iOS
  can sign in here.
- `user_type` in `auth.users.raw_user_meta_data` must be `'creator'`
  to access the dashboard. Shoppers (audience users) hit the
  `/login?error=not_a_creator` redirect.
- Invite-only signup gate via the `creator_web_invites` table. The
  invite list was pre-seeded with all real existing creators on
  2026-05-04. New creators need an invite row added before they can
  sign up.

To add an invite manually:

```sql
insert into public.creator_web_invites (email, notes)
values ('newcreator@example.com', 'manual add - source');
```

## Routes

| Route | Auth | Notes |
|---|---|---|
| `/login` | public | Email + password |
| `/signup` | public | Invite-required |
| `/forgot-password` | public | Sends Supabase reset email |
| `/auth/confirm` | public | Verifies the OTP from auth emails |
| `/` | auth | Dashboard home |
| `/closet` | auth | Phase 1B |
| `/looks` | auth | Phase 1C |
| `/collage` | auth | Phase 2 |
| `/drafts` | auth | Phase 1D |
| `/profile` | auth | Phase 1D |

## Deploy

Vercel project `styledinmotion-studio-creators` (to be created).
Connect to the same monorepo, set Root Directory to `creators-web/`.
Add the env vars above to the Vercel project settings (production
+ preview).

DNS: add a CNAME record `studio` → `cname.vercel-dns.com` at the
DNS host for `styledinmotion.studio`.

## Phase plan

See `business/creator-web-build-plan.md` for the multi-week roadmap.
