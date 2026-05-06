/**
 * Creator profile shape served to the editor. Mirrors creator_profiles
 * columns we expose on web. Read-only flags (is_founding_creator,
 * is_beta_creator, follower_count, subscription_status) are surfaced
 * but the editor doesn't write them.
 */
export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "pinterest";

export interface SocialHandle {
  platform: SocialPlatform;
  handle: string;
  enabled: boolean;
}

export interface ProfileMeasurements {
  heightCm: number | null;
  weightKg: number | null;
  unit: "us" | "metric";
  topSize: string;
  bottomSize: string;
  dressSize: string;
  shoeSize: string;
  braSize: string;
  bodyTypeSelfTags: string[];
}

export interface CreatorProfile {
  creatorId: string;
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  photoUrl: string;
  location: string;
  socials: SocialHandle[];
  measurements: ProfileMeasurements;
  /** Amazon Associates tag for Creator Connections — e.g. "mycreator-20" */
  amazonAssociatesTag: string;
  // Read-only badges
  isBetaCreator: boolean;
  isFoundingCreator: boolean;
  subscriptionStatus: string;
  followerCount: number;
  followerCountSource: string;
  profileCompletedAt: string | null;
}

export interface CreatorProfileRow {
  creator_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  photo_url: string | null;
  location: string | null;
  instagram_handle: string | null;
  instagram_enabled: boolean | null;
  tiktok_handle: string | null;
  tiktok_enabled: boolean | null;
  youtube_handle: string | null;
  youtube_enabled: boolean | null;
  pinterest_handle: string | null;
  pinterest_enabled: boolean | null;
  height_cm: number | null;
  weight_kg: string | null; // numeric comes through as string
  measurement_unit: string | null;
  top_size: string | null;
  bottom_size: string | null;
  dress_size: string | null;
  shoe_size: string | null;
  bra_size: string | null;
  body_type_self_tags: string[] | null;
  amazon_associates_tag: string | null;
  is_beta_creator: boolean;
  is_founding_creator: boolean;
  subscription_status: string;
  follower_count: number | null;
  follower_count_source: string | null;
  profile_completed_at: string | null;
}

export function rowToProfile(row: CreatorProfileRow): CreatorProfile {
  return {
    creatorId: row.creator_id,
    username: row.username ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    bio: row.bio ?? "",
    photoUrl: row.photo_url ?? "",
    location: row.location ?? "",
    socials: [
      {
        platform: "instagram",
        handle: row.instagram_handle ?? "",
        enabled: row.instagram_enabled ?? false,
      },
      {
        platform: "tiktok",
        handle: row.tiktok_handle ?? "",
        enabled: row.tiktok_enabled ?? false,
      },
      {
        platform: "youtube",
        handle: row.youtube_handle ?? "",
        enabled: row.youtube_enabled ?? false,
      },
      {
        platform: "pinterest",
        handle: row.pinterest_handle ?? "",
        enabled: row.pinterest_enabled ?? false,
      },
    ],
    measurements: {
      heightCm: row.height_cm,
      weightKg: row.weight_kg ? Number.parseFloat(row.weight_kg) : null,
      unit: (row.measurement_unit === "metric" ? "metric" : "us") as "us" | "metric",
      topSize: row.top_size ?? "",
      bottomSize: row.bottom_size ?? "",
      dressSize: row.dress_size ?? "",
      shoeSize: row.shoe_size ?? "",
      braSize: row.bra_size ?? "",
      bodyTypeSelfTags: row.body_type_self_tags ?? [],
    },
    amazonAssociatesTag: row.amazon_associates_tag ?? "",
    isBetaCreator: row.is_beta_creator,
    isFoundingCreator: row.is_founding_creator,
    subscriptionStatus: row.subscription_status,
    followerCount: row.follower_count ?? 0,
    followerCountSource: row.follower_count_source ?? "manual",
    profileCompletedAt: row.profile_completed_at,
  };
}

/**
 * Inches/cm + pounds/kg conversions. We store metric in DB; the unit field
 * is purely a display preference for the editor.
 */
export function cmToFeet(cm: number): { ft: number; inches: number } {
  const totalInches = cm / 2.54;
  return {
    ft: Math.floor(totalInches / 12),
    inches: Math.round(totalInches % 12),
  };
}

export function feetToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54);
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 100) / 100;
}

/**
 * Derived body-type tags shoppers actually filter by. Mirrors the Postgres
 * derive_body_type_tags() function so the editor can preview what the
 * public view will surface without round-tripping.
 */
export const BODY_TYPE_OPTIONS = [
  { value: "petite", label: "Petite" },
  { value: "tall", label: "Tall" },
  { value: "midsize", label: "Midsize" },
  { value: "plus", label: "Plus" },
  { value: "straight", label: "Straight" },
  { value: "curvy", label: "Curvy" },
  { value: "athletic", label: "Athletic" },
] as const;

/** 8-field profile completeness % matching the SQL view. */
export function profileCompletionPct(profile: CreatorProfile): number {
  let count = 0;
  if (profile.bio.trim().length >= 20) count++;
  if (profile.photoUrl) count++;
  if (
    profile.socials.some((s) => s.handle.trim().length > 0)
  )
    count++;
  if (profile.measurements.heightCm !== null) count++;
  if (profile.measurements.topSize) count++;
  if (profile.measurements.bottomSize) count++;
  if (profile.measurements.shoeSize) count++;
  if (profile.measurements.bodyTypeSelfTags.length > 0) count++;
  return Math.round((count / 8) * 100);
}
