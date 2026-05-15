import { Capacitor } from "@capacitor/core";
import { ScreenHeader } from "@/components/ScreenHeader";
import SiteNav from "@/components/SiteNav";

export default function TermsOfUse() {
  const isNative = Capacitor.isNativePlatform();
  return (
    <div className={isNative ? "h-screen bg-background overflow-y-auto overscroll-contain" : "min-h-screen bg-background"}>
      {isNative ? <ScreenHeader fallbackPath="/welcome" /> : <SiteNav />}
      <div className="max-w-2xl mx-auto px-5 pb-[max(env(safe-area-inset-bottom,16px),32px)]">

        <h1 className="text-[28px] font-bold text-foreground tracking-[-0.02em] mb-1 pt-8">Terms of Use</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: May 15, 2026</p>

        <div className="space-y-6">
          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">1. Acceptance</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              By creating an account or using ChaseHQ (the "Service"), you agree to these Terms
              of Use. If you do not agree, do not use the Service. The Service is available
              worldwide to individuals and businesses, subject to availability in your country's
              Apple App Store.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">2. Eligibility</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You must be at least 18 years old and legally capable of entering into a binding
              contract in your jurisdiction to use ChaseHQ. By using the Service you represent
              that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">3. Your Account</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You are responsible for safeguarding your account credentials and for all activity
              that occurs under your account. Notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">4. Permitted Use</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You may use ChaseHQ only to send invoice follow-ups to clients with whom you have
              an existing business relationship. You agree not to:
            </p>
            <ul className="text-[14px] text-muted-foreground leading-[1.6] list-disc pl-5 space-y-1 mt-2">
              <li>Send unsolicited bulk email, spam, or marketing communications.</li>
              <li>Send harassing, threatening, or unlawful content.</li>
              <li>Impersonate another person or entity.</li>
              <li>Reverse engineer, scrape, or attempt to disrupt the Service.</li>
              <li>Use the Service in violation of any applicable anti-spam, email-marketing, or consumer-protection laws in your jurisdiction (including CAN-SPAM in the U.S., CASL in Canada, the GDPR/ePrivacy rules in the EU/UK, and similar laws elsewhere).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">5. Sending Follow-ups</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ sends follow-up emails on your behalf from{" "}
              <span className="text-foreground font-medium">noreply@chasehq.app</span> using a
              dedicated transactional email provider. Each message carries your display name
              in the From header and Reply-To set to the email address on your ChaseHQ
              account, so when a client clicks reply the message reaches your inbox directly.
              ChaseHQ does not receive, read, store, or display those replies inside the app.
            </p>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              You remain solely responsible for the content of every follow-up you author and
              send through ChaseHQ, including compliance with applicable email, anti-spam, and
              consumer-protection laws in your jurisdiction (such as the CAN-SPAM Act in the
              U.S., CASL in Canada, and GDPR/ePrivacy in the EU/UK). We may suspend sending from
              your account if we detect abuse or repeated bounces.
            </p>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              Every follow-up email carries a one-click unsubscribe option in the
              <span className="text-foreground font-medium"> List-Unsubscribe</span> and
              <span className="text-foreground font-medium"> List-Unsubscribe-Post</span>{" "}
              headers (surfaced by Gmail, Apple Mail, and Yahoo as a one-tap "Unsubscribe"
              button at the top of the message), with both a signed HTTPS endpoint and a
              mailto:unsubscribe@chasehq.app fallback. Recipients who unsubscribe, mark a
              message as spam, or whose address hard-bounces are added to our suppression
              list and will not receive future ChaseHQ-routed emails from any sender — this
              is enforced server-side before each send and cannot be overridden from the app.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">6. AI-Generated Content</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ uses AI to draft follow-up messages. Drafts are suggestions — you must
              review and approve every message before it is sent. We make no warranty regarding
              the accuracy, tone, or legal sufficiency of AI-generated text.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">7. Your Content</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You retain all rights to the invoices, client information, and follow-up text you
              create or send through ChaseHQ. You grant us a limited license to host, process,
              and transmit that content solely to operate the Service for you.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">8. Subscriptions, Billing &amp; Auto-Renewal</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ Pro is offered as a monthly auto-renewing subscription at
              $9.99 USD per month, with a 14-day free trial for new accounts.
              Pricing may be displayed in your local currency on the App Store.
            </p>
            <ul className="text-[14px] text-muted-foreground leading-[1.6] list-disc pl-5 space-y-1 mt-2">
              <li>Payment is charged to your Apple ID at confirmation of purchase.</li>
              <li>Your subscription automatically renews each month unless auto-renew is turned off at least 24 hours before the end of the current period.</li>
              <li>Your account will be charged for renewal within 24 hours prior to the end of the current period at the then-current price.</li>
              <li>You can manage and cancel your subscription at any time in your App Store account settings. Canceling stops future renewals; access continues until the end of the current paid period.</li>
              <li>If you cancel during your free trial, you will not be charged. If you do not cancel before the trial ends, your subscription will begin and your Apple ID will be charged.</li>
              <li>Refund requests are handled by Apple under their published refund policy.</li>
            </ul>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              ChaseHQ does not store payment card data. All billing on iOS is
              processed by Apple. If you lose access due to a failed renewal,
              your account remains read-only — your data is preserved and
              becomes fully usable again once you resubscribe.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">9. Termination</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You may stop using the Service and delete your account at any time. We may
              suspend or terminate accounts that violate these Terms or that pose a security or
              abuse risk to the Service or other users.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">10. Disclaimers</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6] uppercase">
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any
              kind, whether express or implied, including merchantability, fitness for a
              particular purpose, and non-infringement. We do not warrant that the Service will
              be uninterrupted, error-free, or that follow-ups will result in payment.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">11. Limitation of Liability</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              To the maximum extent permitted by applicable law, ChaseHQ and its affiliates
              shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits, revenue, or data, arising out of or
              related to your use of the Service. Our total aggregate liability for any claim
              relating to the Service shall not exceed the greater of (a) the amount you paid us
              in the 12 months preceding the claim, or (b) USD $100.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">12. Indemnification</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You agree to indemnify and hold harmless ChaseHQ from any claim, demand, loss, or
              damages, including reasonable attorneys' fees, arising out of your use of the
              Service, your content, or your violation of these Terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">13. Governing Law &amp; Venue</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              These Terms are governed by the laws of the Republic of India, without prejudice
              to any mandatory consumer-protection rights you have under the law of your country
              of residence. Any dispute arising out of or related to the Service shall be subject
              to the exclusive jurisdiction of the competent courts of Bhopal, Madhya Pradesh,
              India, except where mandatory local law gives you the right to bring proceedings
              in your country of residence.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">14. Changes</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              We may update these Terms from time to time. Material changes will be communicated
              in-app or by email at least 7 days before they take effect. Your continued use of
              the Service after changes take effect constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">15. Contact</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              Questions about these Terms can be sent to{" "}
              <a href="mailto:support@chasehq.app" className="text-primary underline">
                support@chasehq.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
