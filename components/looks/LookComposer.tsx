"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Archive, ArchiveRestore, Eye, EyeOff } from "lucide-react";
import { CoverPhotoUploader } from "./CoverPhotoUploader";
import { ItemPicker } from "./ItemPicker";
import {
  type ComposerDraft,
  type ComposerItem,
  createLookAction,
  updateLookAction,
  publishLookAction,
  archiveLookAction,
} from "@/lib/looks/mutations";
import type { ClosetItem } from "@/types/closet";

export type ComposerMode = "create" | "edit";

interface InitialLookSnapshot {
  id: string;
  title: string;
  caption: string;
  coverPhotoUrl: string;
  archived: boolean;
  isDraft: boolean;
}

interface Props {
  mode: ComposerMode;
  /** Required: signed-in creator id (for storage path). */
  creatorId: string;
  /** Closet items available for tagging (already filtered to non-archived). */
  closet: ClosetItem[];
  /** Edit mode: prefilled look + items. */
  initialLook?: InitialLookSnapshot;
  initialItems?: ComposerItem[];
}

export function LookComposer({
  mode,
  creatorId,
  closet,
  initialLook,
  initialItems = [],
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initialLook?.title ?? "");
  const [caption, setCaption] = useState(initialLook?.caption ?? "");
  const [coverUrl, setCoverUrl] = useState(initialLook?.coverPhotoUrl ?? "");
  const [items, setItems] = useState<ComposerItem[]>(initialItems);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const buildDraft = (): ComposerDraft => ({
    id: initialLook?.id,
    title,
    caption,
    coverPhotoUrl: coverUrl,
    items,
  });

  const validate = (): string | null => {
    if (!title.trim()) return "Give the look a title.";
    return null;
  };

  const handleSave = (publish: boolean) => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setNotice(null);
    setBusyAction(publish ? "publish" : "draft");
    startTransition(async () => {
      const draft = buildDraft();
      let r;
      if (mode === "create") {
        r = await createLookAction(draft, publish);
      } else {
        // Edit mode: update fields first, then optionally toggle published_at.
        r = await updateLookAction(draft);
        if (r.ok && initialLook) {
          // If user clicks Publish on a draft, also flip published_at.
          // If user clicks Save Draft on a published look, leave it published
          // (un-publish is a separate dedicated button below).
          if (publish && initialLook.isDraft) {
            const pr = await publishLookAction(initialLook.id, true);
            if (!pr.ok) r = { ok: false, error: pr.error };
          }
        }
      }
      setBusyAction(null);

      if (!r.ok) {
        setError(r.error ?? "Could not save.");
        return;
      }

      if (mode === "create") {
        router.push(publish ? `/looks/${r.lookId}` : `/looks?view=draft`);
        router.refresh();
      } else {
        setNotice(publish ? "Saved + published." : "Saved.");
        router.refresh();
      }
    });
  };

  const handlePublishToggle = () => {
    if (!initialLook) return;
    const next = initialLook.isDraft;
    setBusyAction(next ? "publish" : "unpublish");
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await publishLookAction(initialLook.id, next);
      setBusyAction(null);
      if (!r.ok) {
        setError(r.error ?? "Could not change publish state.");
        return;
      }
      setNotice(next ? "Published." : "Moved to drafts.");
      router.refresh();
    });
  };

  const handleArchiveToggle = () => {
    if (!initialLook) return;
    const next = !initialLook.archived;
    setBusyAction(next ? "archive" : "unarchive");
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await archiveLookAction(initialLook.id, next);
      setBusyAction(null);
      if (!r.ok) {
        setError(r.error ?? "Could not update archive.");
        return;
      }
      router.push("/looks");
      router.refresh();
    });
  };

  const isBusy = busyAction !== null;

  return (
    <div className="space-y-8">
      {/* Cover */}
      <section>
        <label className="block text-xs uppercase tracking-widest text-muted mb-2">
          Cover photo
        </label>
        <CoverPhotoUploader
          value={coverUrl}
          onChange={setCoverUrl}
          creatorId={creatorId}
        />
      </section>

      {/* Title + caption */}
      <section className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunday Brunch in SoHo"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tell shoppers what made this look click."
            rows={3}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose resize-y"
          />
        </div>
      </section>

      {/* Items */}
      <section>
        <ItemPicker
          closet={closet}
          selected={items}
          onChange={setItems}
        />
      </section>

      {/* Status messages */}
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

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-border">
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          <Send size={14} strokeWidth={2} />
          {busyAction === "publish"
            ? "Publishing…"
            : mode === "create" || (initialLook?.isDraft ?? false)
              ? "Publish"
              : "Save & keep published"}
        </button>

        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm hover:border-rose disabled:opacity-60 transition-colors"
        >
          <Save size={14} strokeWidth={2} />
          {busyAction === "draft"
            ? "Saving…"
            : mode === "create"
              ? "Save draft"
              : "Save"}
        </button>

        {mode === "edit" && initialLook ? (
          <>
            {!initialLook.isDraft ? (
              <button
                type="button"
                onClick={handlePublishToggle}
                disabled={isBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-rose disabled:opacity-60 transition-colors"
              >
                <EyeOff size={14} strokeWidth={2} />
                {busyAction === "unpublish" ? "Unpublishing…" : "Move to drafts"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-rose disabled:opacity-60 transition-colors"
            >
              {initialLook.archived ? (
                <>
                  <ArchiveRestore size={14} strokeWidth={2} />
                  {busyAction === "unarchive" ? "Unarchiving…" : "Unarchive"}
                </>
              ) : (
                <>
                  <Archive size={14} strokeWidth={2} />
                  {busyAction === "archive" ? "Archiving…" : "Archive"}
                </>
              )}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
