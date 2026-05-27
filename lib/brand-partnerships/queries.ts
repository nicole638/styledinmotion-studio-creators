import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PriorityCreator = {
  creator_id: string;
  username: string | null;
  first_name: string | null;
  follower_count: number | null;
  is_founding_creator: boolean;
  priority_until: string | null;
  priority_reason: string | null;
  priority_reason_human: string;
  days_remaining: number | null;
};

export type BrandPartnership = {
  id: string;
  brand_name: string;
  campaign_name: string;
  brief: string | null;
  payout_per_creator: string | null;
  payout_currency: string;
  total_budget: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_creators: number | null;
  status: string;
  affiliate_merchant_network: string | null;
  affiliate_merchant_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  offer_count: number;
  accepted_count: number;
};

export async function listPriorityCreators(): Promise<PriorityCreator[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_priority_creators")
    .select("*")
    .order("days_remaining", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`listPriorityCreators: ${error.message}`);
  return (data ?? []) as PriorityCreator[];
}

export async function listBrandPartnerships(): Promise<BrandPartnership[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_partnerships")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listBrandPartnerships: ${error.message}`);

  // Fold in counts per partnership (small table — N+1 is fine here)
  const partnerships = data ?? [];
  if (partnerships.length === 0) return [];

  const ids = partnerships.map((p) => p.id);
  const { data: offers } = await admin
    .from("brand_partnership_offers")
    .select("partnership_id, status")
    .in("partnership_id", ids);

  const offerMap = new Map<string, { offer: number; accepted: number }>();
  for (const o of offers ?? []) {
    const k = o.partnership_id as string;
    const v = offerMap.get(k) ?? { offer: 0, accepted: 0 };
    v.offer += 1;
    if (["accepted", "completed", "paid"].includes(o.status as string)) v.accepted += 1;
    offerMap.set(k, v);
  }

  return partnerships.map((p) => {
    const c = offerMap.get(p.id as string) ?? { offer: 0, accepted: 0 };
    return {
      ...p,
      offer_count: c.offer,
      accepted_count: c.accepted,
    } as BrandPartnership;
  });
}

export async function createBrandPartnership(input: {
  brand_name: string;
  campaign_name: string;
  brief?: string;
  payout_per_creator?: number;
  total_budget?: number;
  starts_at?: string;
  ends_at?: string;
  max_creators?: number;
  status?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_partnerships")
    .insert({
      brand_name: input.brand_name.trim(),
      campaign_name: input.campaign_name.trim(),
      brief: input.brief?.trim() || null,
      payout_per_creator: input.payout_per_creator ?? null,
      total_budget: input.total_budget ?? null,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      max_creators: input.max_creators ?? null,
      status: input.status || "draft",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id as string };
}
