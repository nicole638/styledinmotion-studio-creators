import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieSet = { name: string; value: string; options?: CookieOptions };

/**
 * Public routes that don't require auth. All others redirect to /login
 * when the user has no session.
 */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/confirm",
  "/auth/callback",
  // /auth/reset is public so unauthenticated users can land here from
  // the recovery email. The page itself checks for a recovery session
  // and shows an error if one isn't present.
  "/auth/reset",
  // /join is the public creator-acquisition landing page (link-in-bio
  // destination from @styled.in.motion). Indexed by search engines.
  "/join",
  // /delete-account is the public account-deletion page required by the
  // Google Play Data safety form (linked from the store listing, so it
  // must render logged-out).
  "/delete-account",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Next.js internal + static assets
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run any code between createServerClient + getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Logged-out users hitting a non-public path → /login
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users hitting /login or /signup → /
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
