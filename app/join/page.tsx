import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

// Override the root layout's robots:noindex — /join is the public creator
// acquisition page and SHOULD be indexed. Also opens up the OG tags so
// link previews from IG / Pinterest / SMS look right.
export const metadata: Metadata = {
  title: "Become a Styled in Motion creator",
  description:
    "Looks you'll love. Shops that work. No follower minimum. Built by two women for creators who deserve to keep 100% of what they earn.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Become a Styled in Motion creator",
    description:
      "No follower minimum. Just style. Keep 100% of what you earn.",
    type: "website",
  },
};

// Live counts pulled per-request from Supabase. ISR'd at 30 min so the
// page is fast but the numbers stay current. If the query fails we fall
// back to stable defaults so the page still renders.
export const revalidate = 1800;

const APP_STORE_URL = "https://apps.apple.com/app/styled-in-motion/id6739000000"; // TODO: replace with the real App Store URL when iOS launches publicly

async function getLiveCounts() {
  try {
    const admin = createAdminClient();
    const [creators, items, looks, brands] = await Promise.all([
      admin
        .from("creator_profiles")
        .select("creator_id", { count: "exact", head: true })
        .eq("is_seed", false)
        .not("username", "is", null),
      admin
        .from("creator_items")
        .select("id", { count: "exact", head: true })
        .eq("archived", false),
      admin
        .from("looks")
        .select("id", { count: "exact", head: true })
        .not("published_at", "is", null)
        .eq("archived", false),
      admin
        .from("affiliate_merchants")
        .select("id", { count: "exact", head: true }),
    ]);
    return {
      creators: creators.count ?? 31,
      items: items.count ?? 435,
      looks: looks.count ?? 98,
      brands: brands.count ?? 63,
    };
  } catch {
    return { creators: 31, items: 435, looks: 98, brands: 63 };
  }
}

// Look up the referrer by code so we can show "Invited by @username".
// Returns null if the code is missing, malformed, or no match.
async function getReferrer(rawCode: string | undefined) {
  if (!rawCode) return null;
  const code = rawCode.trim().toLowerCase();
  // Codes are formatted as `username-xxxx` — keep the lookup surgical
  if (!/^[a-z0-9]{1,16}-[a-z0-9]{4}$/.test(code)) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("creator_profiles")
      .select("username, first_name, photo_url, is_founding_creator")
      .eq("referral_code", code)
      .maybeSingle();
    if (!data?.username) return null;
    return {
      code,
      username: data.username as string,
      first_name: (data.first_name as string | null) ?? null,
      photo_url: (data.photo_url as string | null) ?? null,
      is_founding_creator: Boolean(data.is_founding_creator),
    };
  } catch {
    return null;
  }
}

type SearchParams = { ref?: string | string[] };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const refParam = Array.isArray(searchParams?.ref)
    ? searchParams.ref[0]
    : searchParams?.ref;
  const [counts, referrer] = await Promise.all([
    getLiveCounts(),
    getReferrer(refParam),
  ]);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Top bar with sign-in link for returning creators */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.25em] text-rose">
            Studio
          </span>
          <span className="text-xs text-muted">·</span>
          <span className="font-display text-lg">Styled in Motion</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted hover:text-text underline underline-offset-4 transition"
        >
          Already a creator? Sign in →
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-24">
        {referrer ? <InvitedByBanner referrer={referrer} /> : null}

        {/* Hero */}
        <section className="pt-12 sm:pt-20 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-5">
            Become a creator
          </p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight">
            Looks you&apos;ll love.
            <br />
            <span className="italic">Shops that work.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted max-w-xl mx-auto leading-relaxed">
            No follower minimum. Just style. Built by two women, for
            creators who deserve to keep 100% of what they earn.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href={APP_STORE_URL}
              className="inline-flex items-center justify-center px-8 py-4 bg-text text-bg text-base font-medium rounded-full hover:opacity-90 transition min-w-[280px]"
            >
              Get the app · iPhone
            </a>
            <p className="text-xs text-muted">
              Free during beta. Cancel any time.
            </p>
          </div>
        </section>

        <div className="editorial-divider my-20" />

        {/* Live numbers */}
        <section>
          <p className="text-center text-xs uppercase tracking-[0.25em] text-rose mb-10">
            The platform · right now
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-4 text-center">
            <Stat n={counts.creators} label="creators" />
            <Stat n={counts.items} label="items in closets" />
            <Stat n={counts.looks} label="published looks" />
            <Stat n={counts.brands} label="partner brands" />
          </div>
        </section>

        <div className="editorial-divider my-20" />

        {/* How it works */}
        <section>
          <p className="text-center text-xs uppercase tracking-[0.25em] text-rose mb-3">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl text-center mb-12">
            Your first look in under five minutes.
          </h2>
          <div className="space-y-10">
            <Step
              n="01"
              title="Build your closet"
              body="Paste a link from anywhere — Bloomingdale's, Amazon, your favorite small shop. We tag it, wrap the link, keep the full image gallery. You don't lift a finger."
            />
            <Step
              n="02"
              title="Compose a look"
              body="Drag, drop, layer. Our cutouts are clean — backgrounds removed, ghost mannequins on apparel — so your collages look editorial without Photoshop."
            />
            <Step
              n="03"
              title="Share once. Earn forever."
              body="One link goes to Instagram, TikTok, or Pinterest. Every shopper who clicks through and buys is yours — 100% of the commission, no creator cut."
            />
          </div>
        </section>

        <div className="editorial-divider my-20" />

        {/* Creator voices */}
        <section>
          <p className="text-center text-xs uppercase tracking-[0.25em] text-rose mb-10">
            Creators on the platform
          </p>
          <div className="space-y-8">
            <Testimonial
              quote="29 looks, 137 items, 108 clicks — and I'm not chasing it. SiM just feels like the way styling content should have worked all along."
              name="Reilly"
              handle="@reillyrose_styles"
            />
            <Testimonial
              quote="I started as a tester. Now my looks live somewhere a shopper can actually buy them. The cutouts alone saved me three hours a week."
              name="Kerri"
              handle="@kerri.styled.in.motion"
            />
          </div>
        </section>

        <div className="editorial-divider my-20" />

        {/* FAQ */}
        <section>
          <p className="text-center text-xs uppercase tracking-[0.25em] text-rose mb-3">
            Common questions
          </p>
          <h2 className="font-display text-3xl sm:text-4xl text-center mb-12">
            Before you sign up.
          </h2>
          <div className="space-y-8">
            <Faq
              q="Do I need a minimum follower count?"
              a="No. Not 5,000. Not 1,000. Not 100. If you have style, we want you on the platform. We compete with LTK (5K minimum) and ShopMy (1K) — we don't gate."
            />
            <Faq
              q="How do creators get paid?"
              a="100% of the affiliate commission goes to you. We don't take a cut from creator earnings. Our money comes from brand partnerships, not from skimming yours."
            />
            <Faq
              q="What brands can I link to?"
              a={`63 partner brands and counting — Bloomingdale's, Amazon, Diesel, Under Armour, Champion, Vera Bradley, Bolsa Nova, Forme.Science, Heyjoanie, and growing weekly. If a brand isn't connected, you can still link to them; we wrap the URL automatically.`}
            />
            <Faq
              q="What's the catch with the beta?"
              a={`We're inviting our first hundred creators personally so we can stay close to feedback. Beta is free and there's no exit — you don't lose anything when we open up. Founding Creators (the first ${counts.creators}+) keep that title permanently.`}
            />
            <Faq
              q="How long does it take to publish a first look?"
              a={`Under 5 minutes from "I just opened the app" to "my first look is live." We pre-load a starter pack of trending items in your closet so you don't start at zero.`}
            />
          </div>
        </section>

        <div className="editorial-divider my-20" />

        {/* Final CTA */}
        <section className="text-center">
          <h2 className="font-display text-4xl sm:text-5xl leading-[1.1] mb-6">
            Made for women who already
            <br />
            know what looks good.
          </h2>
          <p className="text-muted max-w-md mx-auto mb-10">
            Download the app. Build a look. Keep what you earn.
          </p>
          <a
            href={APP_STORE_URL}
            className="inline-flex items-center justify-center px-8 py-4 bg-text text-bg text-base font-medium rounded-full hover:opacity-90 transition min-w-[280px]"
          >
            Get the app · iPhone
          </a>
          <div className="mt-6 text-xs text-muted">
            On a laptop right now?{" "}
            <Link
              href="/signup"
              className="underline underline-offset-4 hover:text-text transition"
            >
              Sign up here
            </Link>{" "}
            and download the app later.
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <div>© Styled in Motion</div>
          <div className="flex items-center gap-5">
            <a
              href="https://www.instagram.com/styled.in.motion"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text transition"
            >
              @styled.in.motion
            </a>
            <Link href="/login" className="hover:text-text transition">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InvitedByBanner({
  referrer,
}: {
  referrer: {
    code: string;
    username: string;
    first_name: string | null;
    photo_url: string | null;
    is_founding_creator: boolean;
  };
}) {
  const displayName =
    referrer.first_name && referrer.first_name.trim().length > 0
      ? referrer.first_name
      : referrer.username;
  return (
    <section className="pt-8">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 flex items-start gap-4 sm:items-center">
        {referrer.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={referrer.photo_url}
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover shrink-0 border border-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-rose/15 text-rose font-display text-xl flex items-center justify-center shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{displayName}</span>
            <span className="text-muted"> invited you to Styled in Motion 🖤</span>
          </p>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            When you publish 3 looks, you both get a multi-Reel spotlight on{" "}
            <span className="text-text">@styled.in.motion</span> and priority
            access to paid brand partnerships.
          </p>
          <p className="mt-2 text-xs">
            <span className="text-muted">Your code: </span>
            <code className="px-2 py-0.5 rounded bg-bg border border-border text-text font-mono text-[11px]">
              {referrer.code}
            </code>
            <span className="text-muted"> — keep it handy for signup.</span>
          </p>
        </div>
        {referrer.is_founding_creator ? (
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-rose/15 text-rose text-[10px] uppercase tracking-wider font-medium shrink-0">
            Founding Creator
          </span>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-4xl sm:text-5xl text-text">{n}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.15em] text-muted">
        {label}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-6">
      <div className="font-display text-3xl text-rose shrink-0 w-12">
        {n}
      </div>
      <div>
        <h3 className="font-display text-2xl mb-2">{title}</h3>
        <p className="text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Testimonial({
  quote,
  name,
  handle,
}: {
  quote: string;
  name: string;
  handle: string;
}) {
  return (
    <blockquote className="bg-card border border-border rounded-2xl p-7">
      <p className="font-display text-xl leading-relaxed text-text">
        &ldquo;{quote}&rdquo;
      </p>
      <footer className="mt-4 text-sm">
        <span className="text-text font-medium">{name}</span>{" "}
        <span className="text-muted">· {handle}</span>
      </footer>
    </blockquote>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="font-display text-xl mb-2">{q}</h3>
      <p className="text-muted leading-relaxed">{a}</p>
    </div>
  );
}
