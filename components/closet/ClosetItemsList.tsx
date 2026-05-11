"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  rowToClosetItem,
  type ClosetItem,
  type ClosetItemRow,
} from "@/types/closet";
import { ItemCard } from "./ItemCard";
import { ConsignmentModal } from "./ConsignmentModal";

interface Props {
  initialItems: ClosetItem[];
  creatorId: string;
  /** When true, the list is showing the archived bucket — Realtime updates that
   *  flip a row to/from archived should add/remove rather than swap-in-place. */
  archivedView: boolean;
  /** Item ids that already have an open consignment request — used to flip
   *  the "Consign" pill into a "Consigning ✓" state on those cards. */
  openConsignmentItemIds: string[];
}

/**
 * Client-side wrapper around the closet grid that subscribes to Realtime
 * updates on creator_items for the signed-in creator. New rows added via the
 * async pipeline arrive with fetch_status='pending' and re-render as their
 * scrape completes, without the user having to refresh the page.
 *
 * RLS already restricts to the creator's own rows, but we filter at the
 * subscription level too so other creators' inserts (which RLS blocks anyway)
 * don't even get sent down the wire.
 */
export function ClosetItemsList({
  initialItems,
  creatorId,
  archivedView,
  openConsignmentItemIds,
}: Props) {
  const [items, setItems] = useState<ClosetItem[]>(initialItems);
  const [consigningIds, setConsigningIds] = useState<Set<string>>(
    () => new Set(openConsignmentItemIds),
  );
  const [consignModalItem, setConsignModalItem] = useState<ClosetItem | null>(
    null,
  );

  // Re-sync from server props if the parent re-renders with a new initial set
  // (e.g. after navigating with different search/category filters).
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (!creatorId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`closet:${creatorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creator_items",
          filter: `creator_id=eq.${creatorId}`,
        },
        (payload) => {
          const row = payload.new as ClosetItemRow;
          // INSERT events for the wrong archived bucket → ignore.
          if (Boolean(row.archived) !== archivedView) return;
          const item = rowToClosetItem(row);
          setItems((prev) => {
            // Avoid dupes if the server-side fetch already included this row.
            if (prev.some((p) => p.id === item.id)) return prev;
            return [item, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creator_items",
          filter: `creator_id=eq.${creatorId}`,
        },
        (payload) => {
          const row = payload.new as ClosetItemRow;
          const item = rowToClosetItem(row);
          setItems((prev) => {
            // If archive state changed and crossed the view boundary,
            // remove from this list (the other view will pick it up).
            if (Boolean(row.archived) !== archivedView) {
              return prev.filter((p) => p.id !== item.id);
            }
            const idx = prev.findIndex((p) => p.id === item.id);
            if (idx === -1) return [item, ...prev];
            const next = prev.slice();
            next[idx] = item;
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "creator_items",
          filter: `creator_id=eq.${creatorId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;
          setItems((prev) => prev.filter((p) => p.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId, archivedView]);

  // Stable order: pending and failed at top (so users see them immediately),
  // then everything else by created_at desc (which is how the server returned).
  const ordered = useMemo(() => {
    const priority = (s: ClosetItem["fetchStatus"]) =>
      s === "pending" ? 0 : s === "failed" ? 1 : 2;
    return items.slice().sort((a, b) => {
      const pa = priority(a.fetchStatus);
      const pb = priority(b.fetchStatus);
      if (pa !== pb) return pa - pb;
      // Within a priority bucket, keep created_at DESC.
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items]);

  if (ordered.length === 0) {
    return null; // Parent renders <EmptyState> when initialItems is empty.
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {ordered.map((item) => (
          <li key={item.id}>
            <ItemCard
              item={item}
              isConsigning={consigningIds.has(item.id)}
              onConsignTap={(it) => setConsignModalItem(it)}
            />
          </li>
        ))}
      </ul>

      {consignModalItem ? (
        <ConsignmentModal
          item={consignModalItem}
          onClose={() => setConsignModalItem(null)}
          onSubmitted={() => {
            // Mark this item as consigning so the pill swaps to the
            // ✓ state immediately, then stay on the success screen
            // until the user closes the modal themselves.
            setConsigningIds((prev) => {
              const next = new Set(prev);
              next.add(consignModalItem.id);
              return next;
            });
          }}
        />
      ) : null}
    </>
  );
}
