"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createBrandPartnership } from "@/lib/brand-partnerships/queries";

function parseNum(v: FormDataEntryValue | null): number | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseStr(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export async function createPartnershipAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (!admin.ok) return { ok: false, error: admin.reason ?? "Not authorized." };

  const brand_name = parseStr(formData.get("brand_name"));
  const campaign_name = parseStr(formData.get("campaign_name"));
  if (!brand_name || !campaign_name) {
    return { ok: false, error: "Brand and campaign name are required." };
  }

  const res = await createBrandPartnership({
    brand_name,
    campaign_name,
    brief: parseStr(formData.get("brief")),
    payout_per_creator: parseNum(formData.get("payout_per_creator")),
    total_budget: parseNum(formData.get("total_budget")),
    starts_at: parseStr(formData.get("starts_at")),
    ends_at: parseStr(formData.get("ends_at")),
    max_creators: parseNum(formData.get("max_creators")),
    status: parseStr(formData.get("status")) ?? "draft",
    notes: parseStr(formData.get("notes")),
  });

  if (!res.ok) return { ok: false, error: res.error ?? "Insert failed." };
  return { ok: true };
}
