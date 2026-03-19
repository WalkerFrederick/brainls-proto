import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Terms of Service — BrainLS",
  description: "Terms and conditions for using BrainLS.",
};

export default function TermsPage() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-6 py-16 md:px-12">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By creating an account or using BrainLS, you agree to these Terms of Service. If you
              do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2>2. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the security of your account and password. You
              must provide accurate information when creating your account. You must be at least 13
              years old to use BrainLS.
            </p>
          </section>

          <section>
            <h2>3. Acceptable Use</h2>
            <p>
              You agree not to use BrainLS to upload or share content that is illegal, harmful,
              abusive, or infringes on the intellectual property rights of others. We reserve the
              right to remove content and suspend accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2>4. Your Content</h2>
            <p>
              You retain ownership of all flashcards, decks, and other content you create on
              BrainLS. By making content public, you grant other users the right to view and study
              that content. You can make content private or delete it at any time.
            </p>
          </section>

          <section>
            <h2>5. Free &amp; Paid Plans</h2>
            <p>
              BrainLS offers a free plan and optional paid plans. Paid plans are billed monthly and
              can be cancelled at any time. Upon cancellation, you retain access through the end of
              your billing period. No refunds are issued for partial months.
            </p>
          </section>

          <section>
            <h2>6. AI Features</h2>
            <p>
              AI-generated content (card suggestions, explanations, etc.) is provided as-is and may
              contain inaccuracies. You are responsible for reviewing AI-generated content before
              using it for study. AI usage is subject to the limits of your plan.
            </p>
          </section>

          <section>
            <h2>7. Availability &amp; Changes</h2>
            <p>
              We strive to keep BrainLS available at all times but do not guarantee uninterrupted
              service. We may modify, suspend, or discontinue features at any time. We will provide
              reasonable notice of significant changes.
            </p>
          </section>

          <section>
            <h2>8. Limitation of Liability</h2>
            <p>
              BrainLS is provided &ldquo;as is&rdquo; without warranties of any kind. We are not
              liable for any damages arising from your use of the service, including but not limited
              to loss of data, loss of profits, or interruption of service.
            </p>
          </section>

          <section>
            <h2>9. Termination</h2>
            <p>
              We may terminate or suspend your account at any time for violation of these terms. You
              may delete your account at any time from your account settings. Upon termination, your
              data will be permanently deleted.
            </p>
          </section>

          <section>
            <h2>10. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. We will notify registered users of
              significant changes via email. Continued use of BrainLS after changes constitutes
              acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              If you have questions about these terms, please contact us at{" "}
              <a href="mailto:legal@brainls.com" className="text-primary hover:underline">
                legal@brainls.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </PublicShell>
  );
}
