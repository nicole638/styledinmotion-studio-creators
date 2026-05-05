import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client for App Router server components +
 * server actions. Reads cookies via Next.js's cookies() helper so auth
 * state is available SSR.
 *
 * Use the publishable (anon) key here — server components run with the
 * caller's JWT and RLS applies normally. The service role key is only
 * used in lib/supabase/admin.ts (lazy-instantiated for server actions
 * that need to bypass RLS, like consuming creator invites).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    },
  );
}
