import type { Metadata } from "next";

// Public account-deletion page. Required by Google Play's Data safety form
// (the "Delete account URL" is shown on the store listing and reviewers open
// it logged-out), and useful for App Store/GDPR/CCPA requests too. Must:
//   1. refer to the app name as it appears on the listing,
//   2. prominently feature the steps to request deletion,
//   3. specify what data is deleted vs. kept, and retention periods.
export const metadata: Metadata = {
  title: "Delete your Styled in Motion account",
  description:
    "How to permanently delete your Styled in Motion account and data — in the app or by email.",
  robots: { index: true, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
          Styled in Motion
        </p>
        <h1 className="font-display text-4xl">Delete your account.</h1>
        <p className="mt-3 text-sm text-muted">
          You can permanently delete your Styled in Motion account — and the
          data that goes with it — at any time. There are two ways:
        </p>

        <h2 className="font-display text-2xl mt-10">1. In the app (instant)</h2>
        <ol className="mt-3 space-y-2 text-sm list-decimal list-inside">
          <li>Open the Styled in Motion app and sign in.</li>
          <li>
            Go to <strong>Profile → Account Settings</strong>.
          </li>
          <li>
            Tap <strong>Delete Account</strong> and confirm.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          Deletion runs immediately and can't be undone.
        </p>

        <h2 className="font-display text-2xl mt-10">2. By email</h2>
        <p className="mt-3 text-sm">
          Email{" "}
          <a
            href="mailto:support@styledinmotion.app?subject=Delete%20my%20account"
            className="text-rose underline underline-offset-2"
          >
            support@styledinmotion.app
          </a>{" "}
          from the address on your account with the subject{" "}
          <em>"Delete my account"</em>. We verify the request and complete the
          deletion within 30 days.
        </p>

        <h2 className="font-display text-2xl mt-10">
          Delete specific data without deleting your account
        </h2>
        <p className="mt-3 text-sm">
          You can remove individual closet items, looks, and saved try-on
          photos anytime in the app — deleting them removes the underlying
          data from our servers. For anything else (for example, a specific
          photo or your date of birth), email{" "}
          <a
            href="mailto:support@styledinmotion.app?subject=Delete%20specific%20data"
            className="text-rose underline underline-offset-2"
          >
            support@styledinmotion.app
          </a>{" "}
          and tell us what you'd like removed — we complete verified requests
          within 30 days.
        </p>

        <h2 className="font-display text-2xl mt-10">What gets deleted</h2>
        <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
          <li>Your account and sign-in credentials</li>
          <li>Your profile (name, email address, date of birth)</li>
          <li>Your closet items, looks, and uploaded photos</li>
          <li>Your saved try-on photos and shopper activity tied to you</li>
        </ul>

        <h2 className="font-display text-2xl mt-10">What we keep</h2>
        <ul className="mt-3 space-y-2 text-sm list-disc list-inside">
          <li>
            Records we're legally required to retain (for example, payout and
            tax records for creators who earned money), kept only as long as
            the law requires
          </li>
          <li>
            Aggregated, de-identified analytics that no longer identify you
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          Copies in encrypted backups are purged within 30 days. For more
          detail, see our{" "}
          <a
            href="https://shop.styledinmotion.studio/privacy"
            className="text-rose underline underline-offset-2"
          >
            privacy policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
