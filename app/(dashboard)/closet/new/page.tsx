import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AddItemForm } from "./AddItemForm";

export const metadata = { title: "Add piece" };

export default function NewClosetItemPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/closet"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Closet
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Add piece
      </p>
      <h1 className="font-display text-4xl">Drop in a URL.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Paste a product link from any retailer. We pull the photo, brand,
        and price using the same scraper your iOS app uses, including
        Amazon short links and tricky merchant CDNs.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <AddItemForm />
      </div>
    </div>
  );
}
