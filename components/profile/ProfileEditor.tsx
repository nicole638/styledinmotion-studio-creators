"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles, Award, Crown } from "lucide-react";
import { ProfilePhotoUploader } from "./ProfilePhotoUploader";
import {
  updateProfileAction,
  markProfileCompletedAction,
  type ProfileDraft,
} from "@/lib/profile/mutations";
import {
  type CreatorProfile,
  type SocialPlatform,
  BODY_TYPE_OPTIONS,
  cmToFeet,
  feetToCm,
  kgToLbs,
  lbsToKg,
  profileCompletionPct,
} from "@/types/profile";

interface Props {
  initial: CreatorProfile;
}

const SOCIAL_LABELS: Record<SocialPlatform, { label: string; placeholder: string }> = {
  instagram: { label: "Instagram", placeholder: "@yourhandle" },
  tiktok: { label: "TikTok", placeholder: "@yourhandle" },
  youtube: { label: "YouTube", placeholder: "@yourchannel" },
  pinterest: { label: "Pinterest", placeholder: "@yourhandle" },
};

export function ProfileEditor({ initial }: Props) {
  const router = useRouter();

  const [username, setUsername] = useState(initial.username);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [bio, setBio] = useState(initial.bio);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [location, setLocation] = useState(initial.location);
  const [socials, setSocials] = useState(initial.socials);
  const [unit, setUnit] = useState<"us" | "metric">(initial.measurements.unit);
  const [heightCm, setHeightCm] = useState<number | null>(
    initial.measurements.heightCm,
  );
  const [weightKg, setWeightKg] = useState<number | null>(
    initial.measurements.weightKg,
  );
  const [topSize, setTopSize] = useState(initial.measurements.topSize);
  const [bottomSize, setBottomSize] = useState(initial.measurements.bottomSize);
  const [dressSize, setDressSize] = useState(initial.measurements.dressSize);
  const [shoeSize, setShoeSize] = useState(initial.measurements.shoeSize);
  const [braSize, setBraSize] = useState(initial.measurements.braSize);
  const [bodyTags, setBodyTags] = useState<string[]>(
    initial.measurements.bodyTypeSelfTags,
  );
  const [amazonTag, setAmazonTag] = useState(initial.amazonAssociatesTag);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  // Live completion preview based on current form state
  const livePreview: CreatorProfile = {
    ...initial,
    bio,
    photoUrl,
    socials,
    measurements: {
      ...initial.measurements,
      heightCm,
      weightKg,
      topSize,
      bottomSize,
      shoeSize,
      bodyTypeSelfTags: bodyTags,
    },
  };
  const completionPct = profileCompletionPct(livePreview);

  const handleSocialChange = (
    platform: SocialPlatform,
    field: "handle" | "enabled",
    value: string | boolean,
  ) => {
    setSocials((prev) =>
      prev.map((s) =>
        s.platform === platform ? { ...s, [field]: value } : s,
      ),
    );
  };

  const handleBodyTagToggle = (value: string) => {
    setBodyTags((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value],
    );
  };

  const handleSave = () => {
    setError(null);
    setNotice(null);
    startSave(async () => {
      const draft: ProfileDraft = {
        username,
        firstName,
        lastName,
        bio,
        photoUrl,
        location,
        socials,
        heightCm,
        weightKg,
        measurementUnit: unit,
        topSize,
        bottomSize,
        dressSize,
        shoeSize,
        braSize,
        bodyTypeSelfTags: bodyTags,
        amazonAssociatesTag: amazonTag,
      };
      const r = await updateProfileAction(draft);
      if (!r.ok) {
        setError(r.error ?? "Could not save.");
        return;
      }
      // Fire-and-forget completion mark; doesn't block the success message
      if (completionPct >= 75) {
        await markProfileCompletedAction();
      }
      setNotice("Saved.");
      router.refresh();
    });
  };

  // Height + weight pickers — show metric or US depending on unit toggle.
  // Internal state stays in cm/kg either way.
  const heightDisplay =
    unit === "us" && heightCm !== null
      ? cmToFeet(heightCm)
      : null;
  const weightDisplay =
    unit === "us" && weightKg !== null ? kgToLbs(weightKg) : null;

  return (
    <div className="space-y-10">
      {/* Header strip with photo + completion bar + badges */}
      <section className="flex flex-wrap items-start gap-6">
        <ProfilePhotoUploader
          value={photoUrl}
          onChange={setPhotoUrl}
          creatorId={initial.creatorId}
        />
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            {initial.isFoundingCreator ? (
              <Badge icon={<Crown size={11} />} label="Founding creator" />
            ) : null}
            {initial.isBetaCreator ? (
              <Badge icon={<Sparkles size={11} />} label="Beta creator" />
            ) : null}
            <Badge icon={<Award size={11} />} label={initial.subscriptionStatus} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted">
            Profile completion · {completionPct}%
          </p>
          <div className="mt-1 h-1.5 w-full max-w-md rounded-full bg-card overflow-hidden">
            <div
              className="h-full bg-rose transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {completionPct >= 100
              ? "Profile complete — shoppers see you in body-type filters."
              : "Fill bio, photo, height, sizes, and a body type tag to reach 100%."}
          </p>
        </div>
      </section>

      {/* Identity */}
      <section className="space-y-4">
        <SectionTitle>Identity</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name">
            <TextInput value={firstName} onChange={setFirstName} />
          </Field>
          <Field label="Last name">
            <TextInput value={lastName} onChange={setLastName} />
          </Field>
        </div>
        <Field label="Username" hint="Letters, numbers, underscore. 3–24 chars.">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">@</span>
            <TextInput
              value={username}
              onChange={(v) => setUsername(v.toLowerCase())}
              placeholder="janedoe"
            />
          </div>
        </Field>
        <Field label="Location">
          <TextInput value={location} onChange={setLocation} placeholder="Brooklyn, NY" />
        </Field>
        <Field label="Bio" hint="20+ characters counts toward completion.">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Mom of two. NYC-based. Outfit ideas for real life."
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose resize-y"
          />
        </Field>
      </section>

      {/* Socials + Amazon */}
      <section className="space-y-4">
        <SectionTitle>Channels</SectionTitle>
        <p className="text-xs text-muted -mt-2">
          Social handles for your public profile, and your Amazon Associates
          tag if you have an existing Amazon storefront. We don't post
          anywhere — handles are display links; the Amazon tag is used to
          attribute commissions on your shop links.
        </p>
        {socials.map((s) => (
          <div key={s.platform} className="flex items-center gap-3">
            <label className="w-28 text-sm">{SOCIAL_LABELS[s.platform].label}</label>
            <TextInput
              value={s.handle}
              onChange={(v) => handleSocialChange(s.platform, "handle", v)}
              placeholder={SOCIAL_LABELS[s.platform].placeholder}
              className="flex-1"
            />
            <label className="inline-flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) =>
                  handleSocialChange(s.platform, "enabled", e.target.checked)
                }
                className="rounded"
              />
              Show
            </label>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <label className="w-28 text-sm">Amazon</label>
          <TextInput
            value={amazonTag}
            onChange={(v) => setAmazonTag(v.toLowerCase())}
            placeholder="mycreator-20"
            className="flex-1"
          />
          <span className="w-[68px] text-[10px] uppercase tracking-widest text-muted text-right">
            Tag
          </span>
        </div>
        <p className="text-xs text-muted -mt-1 ml-[124px]">
          Your existing Amazon Associates tag (e.g. <span className="font-mono">mycreator-20</span>).
          Leave blank if you don't have an Amazon store yet — your shop links
          will fall back to the platform tag and we'll attribute your earnings
          when we reconcile commission reports.
        </p>
      </section>

      {/* Body */}
      <section className="space-y-4">
        <SectionTitle>Body</SectionTitle>
        <p className="text-xs text-muted -mt-2">
          We never show your raw measurements publicly. They power the body-type
          tags shoppers filter by.
        </p>

        {/* Unit toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-muted">Units</span>
          <div className="inline-flex rounded-full border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setUnit("us")}
              className={`px-3 py-1 ${unit === "us" ? "bg-rose text-white" : "bg-card"}`}
            >
              US
            </button>
            <button
              type="button"
              onClick={() => setUnit("metric")}
              className={`px-3 py-1 ${unit === "metric" ? "bg-rose text-white" : "bg-card"}`}
            >
              Metric
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {unit === "us" ? (
            <Field label="Height">
              <div className="flex items-center gap-2">
                <NumberInput
                  value={heightDisplay?.ft ?? null}
                  onChange={(ft) => {
                    const inches = heightDisplay?.inches ?? 0;
                    if (ft === null) setHeightCm(null);
                    else setHeightCm(feetToCm(ft, inches));
                  }}
                  min={3}
                  max={7}
                  className="w-20"
                />
                <span className="text-xs text-muted">ft</span>
                <NumberInput
                  value={heightDisplay?.inches ?? null}
                  onChange={(inches) => {
                    const ft = heightDisplay?.ft ?? 5;
                    if (inches === null) setHeightCm(null);
                    else setHeightCm(feetToCm(ft, inches));
                  }}
                  min={0}
                  max={11}
                  className="w-20"
                />
                <span className="text-xs text-muted">in</span>
              </div>
            </Field>
          ) : (
            <Field label="Height (cm)">
              <NumberInput
                value={heightCm}
                onChange={setHeightCm}
                min={100}
                max={230}
              />
            </Field>
          )}
          {unit === "us" ? (
            <Field label="Weight (lbs)">
              <NumberInput
                value={weightDisplay}
                onChange={(lbs) => {
                  if (lbs === null) setWeightKg(null);
                  else setWeightKg(lbsToKg(lbs));
                }}
                min={66}
                max={550}
              />
            </Field>
          ) : (
            <Field label="Weight (kg)">
              <NumberInput
                value={weightKg}
                onChange={setWeightKg}
                min={30}
                max={250}
                step={0.1}
              />
            </Field>
          )}
        </div>

        <Field label="Body type tags" hint="Pick what you'd want shoppers to filter by.">
          <div className="flex flex-wrap gap-2">
            {BODY_TYPE_OPTIONS.map((opt) => {
              const on = bodyTags.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleBodyTagToggle(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    on
                      ? "bg-rose text-white"
                      : "bg-card border border-border hover:border-rose"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>
      </section>

      {/* Sizes */}
      <section className="space-y-4">
        <SectionTitle>Usual sizes</SectionTitle>
        <p className="text-xs text-muted -mt-2">
          What you typically wear across categories. Free-text — write what
          makes sense.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Top">
            <TextInput value={topSize} onChange={setTopSize} placeholder="M" />
          </Field>
          <Field label="Bottom">
            <TextInput value={bottomSize} onChange={setBottomSize} placeholder="27, 6" />
          </Field>
          <Field label="Dress">
            <TextInput value={dressSize} onChange={setDressSize} placeholder="6" />
          </Field>
          <Field label="Shoe">
            <TextInput value={shoeSize} onChange={setShoeSize} placeholder="8.5" />
          </Field>
          <Field label="Bra">
            <TextInput value={braSize} onChange={setBraSize} placeholder="32B" />
          </Field>
        </div>
      </section>

      {/* Status messages + save */}
      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="text-sm text-text bg-card border border-border rounded-2xl px-4 py-3">
          {notice}
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-6 border-t border-border">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          <Save size={14} strokeWidth={2} />
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

// ──────────── Reusable bits ────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl">{children}</h2>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-widest text-muted mb-1.5">
        {label}
      </div>
      {children}
      {hint ? (
        <div className="mt-1 text-xs text-muted">{hint}</div>
      ) : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose ${className ?? ""}`}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(null);
        else {
          const n = Number.parseFloat(v);
          onChange(Number.isNaN(n) ? null : n);
        }
      }}
      min={min}
      max={max}
      step={step ?? 1}
      className={`rounded-2xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-rose ${className ?? "w-full"}`}
    />
  );
}

function Badge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border bg-card text-[10px] uppercase tracking-widest text-muted">
      {icon}
      {label}
    </span>
  );
}
