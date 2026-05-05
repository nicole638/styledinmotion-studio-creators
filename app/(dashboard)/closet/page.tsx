import { ComingSoon } from "../_components/ComingSoon";

export const metadata = { title: "Closet" };

export default function ClosetPage() {
  return (
    <ComingSoon
      title="Your closet."
      description="Paste a URL or a list of URLs and we'll fetch the photo, brand, and price for each piece. Edit, archive, set your usual size."
    />
  );
}
