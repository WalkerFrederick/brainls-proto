import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — BrainLS",
  description: "How BrainLS collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-6 py-16 md:px-12">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2">
          <section>
            <h2>1. Information We Collect</h2>
            <p>
              When you create an account we collect your name, email address, and a hashed version
              of your password. When you use BrainLS we store the flashcards, decks, folders, and
              study data you create. We also collect basic usage analytics such as page views and
              session duration to improve the product.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>
              We use your information to provide and improve BrainLS, send transactional emails
              (e.g. password resets, email verification), and communicate product updates. We do not
              sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2>3. Data Storage &amp; Security</h2>
            <p>
              Your data is stored on secure, encrypted servers. Passwords are hashed using
              industry-standard algorithms and are never stored in plain text. We use HTTPS for all
              data in transit.
            </p>
          </section>

          <section>
            <h2>4. Cookies &amp; Sessions</h2>
            <p>
              We use session cookies to keep you signed in. We do not use third-party advertising
              cookies. You can clear cookies at any time through your browser settings.
            </p>
          </section>

          <section>
            <h2>5. Third-Party Services</h2>
            <p>
              We may use third-party services for hosting, email delivery, file storage, and
              analytics. These services have access only to the data necessary to perform their
              functions and are bound by their own privacy policies.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>
              You can access, update, or delete your account and personal data at any time from your
              account settings. If you delete your account, all associated data will be permanently
              removed.
            </p>
          </section>

          <section>
            <h2>7. Children&apos;s Privacy</h2>
            <p>
              BrainLS is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If you believe we have collected such data, please
              contact us.
            </p>
          </section>

          <section>
            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify registered users
              of significant changes via email. Continued use of BrainLS after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>
              If you have questions about this privacy policy, please contact us at{" "}
              <a href="mailto:privacy@brainls.com" className="text-primary hover:underline">
                privacy@brainls.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </PublicShell>
  );
}
