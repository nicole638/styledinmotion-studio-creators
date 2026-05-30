#!/usr/bin/env bash
# One-shot commit+push for tonight's web work. Three logical commits so
# the git history reads cleanly, then push to origin/main (triggers the
# Vercel deploy).
#
# Run from your Mac Terminal:
#   cd ~/Documents/Styled-in-Motion/creators-web
#   bash _push_to_main.sh
#
# After it's done, you can delete this file: `rm _push_to_main.sh`

set -euo pipefail

cd "$(dirname "$0")"

# Clean up any stale lock from sandbox attempts
rm -f .git/index.lock 2>/dev/null || true

if ! git diff-index --quiet HEAD --; then
  : # has uncommitted changes — proceed
else
  echo "Nothing to commit. Aborting."
  exit 1
fi

# ─── Commit 1: Async pipeline frontend + photo upload + brand dropdown ───
git add \
  types/closet.ts \
  lib/closet/queries.ts \
  lib/closet/mutations.ts \
  components/closet/ItemCard.tsx \
  components/closet/ClosetItemsList.tsx \
  "app/(dashboard)/closet/page.tsx" \
  "app/(dashboard)/closet/new/AddItemForm.tsx" \
  "app/(dashboard)/closet/[id]/EditItemForm.tsx" \
  "app/(dashboard)/closet/[id]/page.tsx"

git commit -m "Closet: async/queued scrape pipeline frontend + UX polish

Wires the creators-web closet to the new Supabase Edge Function scrape
pipeline. Closet card flips from a 'Fetching…' placeholder to populated
content via Realtime when the EF writes back — slow merchants no longer
block the Add flow.

- types/closet: add fetchStatus + fetchError to ClosetItem; legacy NULL
  rows coerce to 'complete'.
- lib/closet/queries: include fetch_status + fetch_error in SELECT. Add
  fetchCreatorBrands() for the brand autocomplete typeahead.
- lib/closet/mutations: quickAddItemPendingAction +
  bulkQuickAddItemsPendingAction (insert with fetch_status='pending',
  trigger handles the rest) and refetchItemAsyncAction. Legacy
  addClosetItemAction kept during the transition.
- components/closet/ItemCard: spinner overlay when pending; failed
  border + retry hint; partial-fields nudge.
- components/closet/ClosetItemsList: NEW client component, Realtime
  subscription on creator_items filtered by creator_id. Sorts pending +
  failed to the top.
- closet/new/AddItemForm: drop the preview-then-edit flow; single URL
  or bulk-paste both go straight to pending insert + redirect.
- closet/[id]/EditItemForm: 'Upload product photo' button + handler
  (uploads to item-photos, calls applyEditedPhotoAction). Brand input
  uses <datalist> backed by fetchCreatorBrands for autocomplete.
- closet/[id]/page: fetch brands + item in parallel, pass to form.

Closes #80, #74, #53."

# ─── Commit 2: Collage Phase 3 layout-discovery (web side) ───
git add \
  lib/collage/layouts.ts \
  components/collage/LayoutCarousel.tsx \
  components/collage/CollageEditor.tsx

git commit -m "Collage Phase 3: layout-discovery carousel

Creators select cutouts → carousel above the canvas shows 10 layout
options (5 hand-curated + 5 algorithmic) for the current item count.
Tap a layout, items snap into its cells. Existing Phase 2 drag/pinch/
rotate continues to work — layout is a starting point, not a constraint.
Text + photo layers stay untouched on layout change.

- lib/collage/layouts: LayoutTemplate schema with normalized cells.
  30 hand-designed templates (5 each for item counts 1-6) tuned for
  portrait-skewed clothing photos. generateAlgorithmicLayouts uses
  mulberry32 PRNG + recursive binary partition (split largest rect along
  longer axis at 0.35-0.65 ratio) for 5 deterministic 'Mix' variants per
  count. applyLayoutToCutouts maps cells → cutout positions
  (anchor at cell center, scale = min(cellW, cellH) × 0.95).
- components/collage/LayoutCarousel: NEW horizontal-scroll carousel
  with SVG thumbnail previews + Shuffle button to reseed algorithmic
  variants without touching curated.
- components/collage/CollageEditor: render carousel above canvas when
  cutoutCount is 1-6. handleApplyLayout repositions cutouts only;
  photo + text layers preserved. selectedLayoutId clears on item-count
  change so stale highlights don't lie.

Closes #87, #88, #89. iOS parity (#90) is in flight via Vibecode."

# ─── Commit 3: Admin nav + campaigns kw column ───
git add \
  types/campaigns.ts \
  lib/campaigns/mutations.ts \
  "app/(dashboard)/admin/campaigns/new/CampaignForm.tsx" \
  "app/(dashboard)/layout.tsx" \
  components/Sidebar.tsx

git commit -m "Admin: sidebar nav for admin tools + campaigns.kw column

The /admin/campaigns and /admin/ingest-amazon pages were reachable only
by typing the URL. Add an 'Admin' sidebar section that's visible only
to allowlisted admin emails (same gate as the server pages, so safe to
expose in nav). Adds Campaigns + Ingest Amazon links.

Also lands the web side of Sponsored Products kw= support: campaigns
table now has a 'kw' text column (migration applied separately on
Supabase). Admin Campaign form shows the kw input only when
campaign_type='sponsored_products'; values are dropped server-side on
type change so stale data can't leak. Backend /api/shop URL building
is queued as #91 for Vibecode.

Closes #43, web side of #55."

# ─── Push ───
echo
echo "Pushing to origin/main…"
git push origin main

echo
echo "Done. Vercel will auto-deploy. Commits:"
git log --oneline -3
