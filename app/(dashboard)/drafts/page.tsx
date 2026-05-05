import { redirect } from "next/navigation";

export const metadata = { title: "Drafts" };

export default function DraftsPage() {
  // Drafts live on the Looks tab under the "Draft" view filter. This page
  // is a quick-jump shortcut from the sidebar.
  redirect("/looks?view=draft");
}
