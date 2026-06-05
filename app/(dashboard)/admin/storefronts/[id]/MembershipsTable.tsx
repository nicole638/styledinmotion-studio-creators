"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Image from "next/image";
import { Plus, Search } from "lucide-react";
import {
  addMembershipAction,
  changeMembershipAction,
  lookupCreatorByEmailAction,
} from "@/lib/storefronts/actions";
import type {
  BrandRole,
  MembershipStatus,
  MembershipWithMember,
} from "@/types/storefronts";

const ROLE_OPTIONS: BrandRole[] = ["owner", "stylist", "analyst"];
const STATUS_OPTIONS: MembershipStatus[] = ["active", "paused", "revoked"];

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose";

export function MembershipsTable({
  brandId,
  memberships,
}: {
  brandId: string;
  memberships: MembershipWithMember[];
}) {
  return (
    <div className="bg-white border border-border rounded-2xl">
      <AddMemberRow brandId={brandId} />

      {/* Existing members list */}
      {memberships.length === 0 ? (
        <p className="p-5 text-sm text-muted italic">No members yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {memberships.map((m) => (
            <MembershipRow key={m.id} brandId={brandId} membership={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddMemberRow({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [resolved, setResolved] = useState<
    { creatorId: string; displayName: string } | null
  >(null);
  const [role, setRole] = useState<BrandRole>("stylist");
  const [error, setError] = useState<string | null>(null);

  function onLookup() {
    setError(null);
    setResolved(null);
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await lookupCreatorByEmailAction(email.trim());
      if (!res.ok || !res.creatorId) {
        setError(res.error ?? "Lookup failed.");
        return;
      }
      setResolved({ creatorId: res.creatorId, displayName: res.displayName ?? email });
    });
  }

  function onAdd() {
    if (!resolved) return;
    setError(null);
    startTransition(async () => {
      const res = await addMembershipAction({
        brandId,
        creatorId: resolved.creatorId,
        role,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not add member.");
        return;
      }
      setEmail("");
      setResolved(null);
      router.refresh();
    });
  }

  return (
    <div className="p-5 border-b border-border">
      <p className="text-sm font-medium text-ink mb-3">Add member</p>
      <div className="flex flex-wrap gap-2 items-start">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setResolved(null);
            setError(null);
          }}
          placeholder="email@example.com"
          className={`${INPUT_CLS} flex-1 min-w-[220px]`}
        />
        <button
          type="button"
          onClick={onLookup}
          disabled={pending || !email.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-bg/40 disabled:opacity-50"
        >
          <Search size={14} /> Look up
        </button>
        {resolved ? (
          <>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as BrandRole)}
              className={`${INPUT_CLS} w-32`}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAdd}
              disabled={pending}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-ink text-white text-sm hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={14} /> Add as {role}
            </button>
          </>
        ) : null}
      </div>
      {resolved ? (
        <p className="mt-2 text-sm text-emerald-700">
          Found: <span className="font-medium">{resolved.displayName}</span>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}

function MembershipRow({
  brandId,
  membership: m,
}: {
  brandId: string;
  membership: MembershipWithMember;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(args: { role?: BrandRole; status?: MembershipStatus }) {
    setError(null);
    startTransition(async () => {
      const res = await changeMembershipAction({
        membershipId: m.id,
        brandId,
        ...args,
      });
      if (!res.ok) {
        setError(res.error ?? "Update failed.");
        return;
      }
      router.refresh();
    });
  }

  const displayName =
    m.memberName ?? m.memberUsername ?? m.memberEmail ?? "Unknown";

  return (
    <li className="p-4 flex flex-wrap items-center gap-3">
      {m.memberPhotoUrl ? (
        <Image
          src={m.memberPhotoUrl}
          alt={displayName}
          width={36}
          height={36}
          className="rounded-full object-cover"
          unoptimized
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-bg-alt border border-border flex items-center justify-center text-xs text-muted">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-medium">{displayName}</p>
        <p className="text-xs text-muted">{m.memberEmail ?? "—"}</p>
      </div>
      <select
        value={m.role}
        disabled={pending}
        onChange={(e) => update({ role: e.target.value as BrandRole })}
        className={`${INPUT_CLS} w-28`}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select
        value={m.status}
        disabled={pending}
        onChange={(e) => update({ status: e.target.value as MembershipStatus })}
        className={`${INPUT_CLS} w-28`}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error ? (
        <p className="basis-full text-sm text-red-700 mt-1">{error}</p>
      ) : null}
    </li>
  );
}
