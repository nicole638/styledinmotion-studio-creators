"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import type {
  BrandRole,
  BrandStatus,
  FulfillmentEntry,
  MembershipStatus,
} from "@/types/storefronts";

// Shape of the form data the create + update server actions accept.
export interface StorefrontFormInput {
  name: string;
  slug: string;
  brandStory: string;
  // commission_pct as a 0-100 number string from the form
  commissionPct: number;
  promoCode: string;
  contactEmail: string;
  fulfillment: FulfillmentEntry[];
  status: BrandStatus;
  isTest: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveAmazonTrackingId(slug: string): string {
  // Amazon Associates tracking ids are 1-20 chars + a country suffix. Pattern
  // matches what was seeded for Golden Bear: styledinmotio-<brand>-20.
  const sanitized = slug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16); // leave room for the prefix + -20
  return `styledinmotio-${sanitized}-20`;
}

function validateSlug(slug: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) {
    return "Slug must be lowercase letters, numbers, and hyphens (2-40 chars).";
  }
  return null;
}

function validateInput(input: StorefrontFormInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  const slugErr = validateSlug(input.slug);
  if (slugErr) return slugErr;
  if (!input.contactEmail.trim()) return "Contact email is required.";
  if (input.commissionPct < 0 || input.commissionPct > 100) {
    return "Commission must be between 0 and 100.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Atomic create — replicates the seed pattern from
 * supabase/migrations/20260605211000_seed_golden_bear_garage.sql.
 * Performs: auth.users → creators → creator_profiles → brand_storefronts.
 * Service-role client; the route is gated by isAdmin().
 *
 * Returns the new brand_storefronts.id on success, or an error message.
 */
export async function createStorefrontAction(
  input: StorefrontFormInput,
): Promise<{ ok: boolean; storefrontId?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };

  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createAdminClient();

  // 0. Slug uniqueness
  const { data: existing } = await supabase
    .from("brand_storefronts")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();
  if (existing) return { ok: false, error: "Slug already taken." };

  const storefrontCreatorId = crypto.randomUUID();
  const amazonTag = deriveAmazonTrackingId(input.slug);
  const syntheticEmail = `${input.slug}-storefront@styledinmotion.app`;

  // 1. auth.users — admin API. Email-confirmed so no signup email sent.
  const { error: authError } = await supabase.auth.admin.createUser({
    id: storefrontCreatorId,
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      system_account: true,
      display_name: input.name,
      storefront: input.slug,
      is_test: input.isTest,
    },
    app_metadata: {
      provider: "system",
      providers: ["system"],
      storefront: input.slug,
    },
  });
  if (authError) {
    return {
      ok: false,
      error: `auth.users insert failed: ${authError.message}`,
    };
  }

  // 2. creators row carrying the brand-specific Amazon tracking id.
  const { error: creatorsError } = await supabase.from("creators").insert({
    id: storefrontCreatorId,
    email: syntheticEmail,
    name: input.name,
    first_name: input.name, // human convention; ok to store full name here
    last_name: null,
    amazon_tracking_id: amazonTag,
  });
  if (creatorsError) {
    // Rollback auth user so we don't leak orphan auth rows.
    await supabase.auth.admin.deleteUser(storefrontCreatorId).catch(() => {});
    return {
      ok: false,
      error: `creators insert failed: ${creatorsError.message}`,
    };
  }

  // 3. creator_profiles row — account_type='partner_brand' is THE flag the
  // mobile feed/profile reads to branch brand vs creator rendering.
  const { error: profileError } = await supabase
    .from("creator_profiles")
    .insert({
      creator_id: storefrontCreatorId,
      username: input.slug.replace(/-/g, ""),
      account_type: "partner_brand",
      bio: input.brandStory.trim() || null,
      amazon_associates_tag: amazonTag,
      amazon_own_tag_enabled: true,
      is_seed: input.isTest,
      // payout fields left null — admin can edit on detail page.
    });
  if (profileError) {
    await supabase.from("creators").delete().eq("id", storefrontCreatorId);
    await supabase.auth.admin.deleteUser(storefrontCreatorId).catch(() => {});
    return {
      ok: false,
      error: `creator_profiles insert failed: ${profileError.message}`,
    };
  }

  // 4. The business record itself.
  const { data: sf, error: sfError } = await supabase
    .from("brand_storefronts")
    .insert({
      storefront_creator_id: storefrontCreatorId,
      name: input.name,
      slug: input.slug,
      brand_story: input.brandStory.trim() || null,
      commission_pct: input.commissionPct,
      promo_code: input.promoCode.trim() || null,
      fulfillment: input.fulfillment,
      contact_email: input.contactEmail.trim(),
      status: input.status,
      is_test: input.isTest,
    })
    .select("id")
    .single();
  if (sfError || !sf) {
    await supabase
      .from("creator_profiles")
      .delete()
      .eq("creator_id", storefrontCreatorId);
    await supabase.from("creators").delete().eq("id", storefrontCreatorId);
    await supabase.auth.admin.deleteUser(storefrontCreatorId).catch(() => {});
    return {
      ok: false,
      error: `brand_storefronts insert failed: ${sfError?.message ?? "unknown"}`,
    };
  }

  revalidatePath("/admin/storefronts");
  return { ok: true, storefrontId: sf.id as string };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateStorefrontAction(
  id: string,
  input: StorefrontFormInput,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };

  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createAdminClient();

  // Slug-change uniqueness check (only when the slug differs from current).
  const { data: current } = await supabase
    .from("brand_storefronts")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (current && current.slug !== input.slug) {
    const { data: clash } = await supabase
      .from("brand_storefronts")
      .select("id")
      .eq("slug", input.slug)
      .maybeSingle();
    if (clash) return { ok: false, error: "Slug already taken." };
  }

  const { error } = await supabase
    .from("brand_storefronts")
    .update({
      name: input.name,
      slug: input.slug,
      brand_story: input.brandStory.trim() || null,
      commission_pct: input.commissionPct,
      promo_code: input.promoCode.trim() || null,
      fulfillment: input.fulfillment,
      contact_email: input.contactEmail.trim(),
      status: input.status,
      is_test: input.isTest,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/storefronts");
  revalidatePath(`/admin/storefronts/${id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Archive (soft delete)
// ---------------------------------------------------------------------------

export async function archiveStorefrontAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_storefronts")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/storefronts");
  revalidatePath(`/admin/storefronts/${id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Logo upload — replaces the object at the wired storage path so
// brand_storefronts.logo_url + creator_profiles.photo_url keep working.
// ---------------------------------------------------------------------------

export async function uploadStorefrontLogoAction(
  storefrontId: string,
  formData: FormData,
): Promise<{ ok: boolean; logoUrl?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };

  const file = formData.get("logo") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file uploaded." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Logo must be under 5MB." };
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Logo must be JPEG, PNG, or WebP." };
  }

  const supabase = createAdminClient();

  // Resolve the storefront's content account id (storefront_creator_id) so
  // we know which storage folder to write into.
  const { data: sf, error: sfErr } = await supabase
    .from("brand_storefronts")
    .select("storefront_creator_id")
    .eq("id", storefrontId)
    .maybeSingle();
  if (sfErr) return { ok: false, error: sfErr.message };
  if (!sf) return { ok: false, error: "Storefront not found." };

  const storefrontCreatorId = sf.storefront_creator_id as string;
  // Always write to profile.jpg regardless of the upload's mimetype — the
  // mobile app uses this exact path. The bucket is public; the URL never
  // changes so cache-busting is the caller's responsibility (UI re-fetches
  // after upload).
  const path = `${storefrontCreatorId}/profile.jpg`;

  // Convert File → ArrayBuffer for the supabase-js upload.
  const bytes = await file.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from("profile-photos")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "60", // 1 min — admin re-uploads should propagate fast
    });
  if (upErr) return { ok: false, error: `upload: ${upErr.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-photos").getPublicUrl(path);

  // Add a cache-bust query so existing references re-fetch.
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  // Reflect into both brand_storefronts.logo_url and
  // creator_profiles.photo_url so byline + brand page agree.
  await supabase
    .from("brand_storefronts")
    .update({ logo_url: bustedUrl })
    .eq("id", storefrontId);
  await supabase
    .from("creator_profiles")
    .update({ photo_url: bustedUrl })
    .eq("creator_id", storefrontCreatorId);

  revalidatePath(`/admin/storefronts/${storefrontId}`);
  return { ok: true, logoUrl: bustedUrl };
}

// ---------------------------------------------------------------------------
// Memberships — add / change role / pause / resume / revoke
// ---------------------------------------------------------------------------

export async function addMembershipAction(args: {
  brandId: string;
  creatorId: string;
  role: BrandRole;
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };
  if (!auth.userId) return { ok: false, error: "Missing admin user id." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("brand_memberships").insert({
    brand_id: args.brandId,
    creator_id: args.creatorId,
    role: args.role,
    status: "active",
    assigned_by: auth.userId,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "That user is already a member of this brand." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/storefronts/${args.brandId}`);
  return { ok: true };
}

export async function changeMembershipAction(args: {
  membershipId: string;
  brandId: string;
  role?: BrandRole;
  status?: MembershipStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };

  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (args.role) patch.role = args.role;
  if (args.status) patch.status = args.status;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("brand_memberships")
    .update(patch)
    .eq("id", args.membershipId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/storefronts/${args.brandId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Email lookup wrapper for the add-member form (server action callable from
// client). Returns the human's id + display name if found.
// ---------------------------------------------------------------------------

export async function lookupCreatorByEmailAction(
  email: string,
): Promise<{ ok: boolean; creatorId?: string; displayName?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason ?? "Admin only." };

  // Reuse the read path from queries.ts.
  const { findCreatorByEmail } = await import("./queries");
  const found = await findCreatorByEmail(email);
  if (!found) return { ok: false, error: "No creator account with that email." };

  const displayName = found.name ?? found.username ?? email;
  return { ok: true, creatorId: found.creatorId, displayName };
}
