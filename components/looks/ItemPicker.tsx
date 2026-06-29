"use client";

import { useMemo, useState } from "react";
import { Search, X, GripVertical } from "lucide-react";
import type { ClosetItem } from "@/types/closet";
import type { ComposerItem } from "@/lib/looks/mutations";
import { CLOSET_CATEGORIES } from "@/lib/closet/categories";

interface Props {
  /** All non-archived closet items the creator can pick from. */
  closet: ClosetItem[];
  /** Currently selected items (in order). */
  selected: ComposerItem[];
  onChange: (next: ComposerItem[]) => void;
}

const MAX_PICKS = 12;

export function ItemPicker({ closet, selected, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const itemById = useMemo(() => {
    const m = new Map<string, ClosetItem>();
    for (const it of closet) m.set(it.id, it);
    return m;
  }, [closet]);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.itemId)),
    [selected],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return closet.filter((it) => {
      if (category && it.category !== category) return false;
      if (!q) return true;
      const hay = [it.name, it.brand, it.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [closet, search, category]);

  const handleAdd = (item: ClosetItem) => {
    if (selected.length >= MAX_PICKS) return;
    if (selectedIds.has(item.id)) return;
    onChange([
      ...selected,
      { itemId: item.id, wornSize: item.defaultWornSize ?? "" },
    ]);
  };

  const handleRemove = (itemId: string) => {
    onChange(selected.filter((s) => s.itemId !== itemId));
  };

  const handleSizeChange = (itemId: string, size: string) => {
    onChange(
      selected.map((s) =>
        s.itemId === itemId ? { ...s, wornSize: size } : s,
      ),
    );
  };

  const handleMove = (itemId: string, direction: -1 | 1) => {
    const idx = selected.findIndex((s) => s.itemId === itemId);
    if (idx < 0) return;
    const next = [...selected];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* Selected list */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs uppercase tracking-widest text-muted">
            Tagged pieces ({selected.length}/{MAX_PICKS})
          </h3>
        </div>

        {selected.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-muted">
              No pieces tagged yet. Pick from your closet below.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selected.map((sel, idx) => {
              const item = itemById.get(sel.itemId);
              if (!item) return null;
              return (
                <li
                  key={sel.itemId}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card"
                >
                  <div className="flex flex-col -gap-px">
                    <button
                      type="button"
                      aria-label="Move up"
                      onClick={() => handleMove(sel.itemId, -1)}
                      disabled={idx === 0}
                      className="text-muted hover:text-text disabled:opacity-30 leading-none px-1"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      onClick={() => handleMove(sel.itemId, 1)}
                      disabled={idx === selected.length - 1}
                      className="text-muted hover:text-text disabled:opacity-30 leading-none px-1"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="w-12 h-14 rounded-md bg-bg overflow-hidden shrink-0">
                    {item.photoUrl ? (
                      // object-contain keeps tall garments (dresses) fully
                      // visible in the small selected-items strip.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photoUrl}
                        alt={item.name ?? "Piece"}
                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.brand ? (
                      <div className="text-[10px] uppercase tracking-widest text-muted truncate">
                        {item.brand}
                      </div>
                    ) : null}
                    <div className="text-sm truncate">
                      {item.name ?? "Untitled"}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={sel.wornSize}
                    onChange={(e) =>
                      handleSizeChange(sel.itemId, e.target.value)
                    }
                    placeholder={
                      item.defaultWornSize
                        ? `Size (${item.defaultWornSize})`
                        : "Size worn"
                    }
                    className="w-24 rounded-full border border-border bg-bg px-3 py-1.5 text-xs outline-none focus:border-rose"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(sel.itemId)}
                    aria-label="Remove piece"
                    className="text-muted hover:text-text"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Picker */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-muted mb-2">
          Pick from your closet
        </h3>
        <div className="relative max-w-md mb-3">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, brand, category"
            className="w-full rounded-full border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-rose"
          />
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {[
            { label: "All", value: null as string | null },
            ...CLOSET_CATEGORIES.map((c) => ({
              label: c.label,
              value: c.value as string | null,
            })),
          ].map((chip) => {
            const active = (category ?? null) === chip.value;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => setCategory(chip.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                  active
                    ? "bg-text text-white"
                    : "bg-card border border-border hover:border-rose"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        {closet.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted">
              Your closet is empty. Add pieces in Closet first, then come back
              to tag them.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted">No pieces match your search.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {filtered.map((item) => {
              const isPicked = selectedIds.has(item.id);
              const atMax = selected.length >= MAX_PICKS && !isPicked;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      isPicked ? handleRemove(item.id) : handleAdd(item)
                    }
                    disabled={atMax}
                    className={`group block w-full rounded-xl border overflow-hidden transition-colors disabled:opacity-40 ${
                      isPicked
                        ? "border-rose ring-2 ring-rose/30"
                        : "border-border hover:border-rose bg-card"
                    }`}
                  >
                    <div className="relative aspect-[4/5] bg-bg">
                      {item.photoUrl ? (
                        // object-contain — full garment stays visible in
                        // the picker grid, matching the closet card style.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photoUrl}
                          alt={item.name ?? "Piece"}
                          className="absolute inset-0 w-full h-full object-contain p-2"
                        />
                      ) : null}
                    </div>
                    <div className="p-2 text-left">
                      <div className="text-[11px] truncate">
                        {item.name ?? item.category ?? "Untitled"}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
