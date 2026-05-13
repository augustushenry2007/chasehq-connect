import { Capacitor } from "@capacitor/core";
import { ScreenHeader } from "@/components/ScreenHeader";
import SiteNav from "@/components/SiteNav";

export default function PrivacyPolicy() {
  const isNative = Capacitor.isNativePlatform();
  return (
    <div className={isNative ? "h-screen bg-background overflow-y-auto overscroll-contain" : "min-h-screen bg-background"}>
      {isNative ? <ScreenHeader fallbackPath="/welcome" /> : <SiteNav />}
      <div className="max-w-2xl mx-auto px-5 pb-[max(env(safe-area-inset-bottom,16px),32px)]">

        <h1 className="text-[28px] font-bold text-foreground tracking-[-0.02em] mb-1 pt-8">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: May 13, 2026</p>

        <div className="space-y-6">
          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">1. Who we are</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ ("we", "us") provides invoice follow-up software to freelancers and small
              businesses worldwide. This policy explains what information we collect,
              how we use it, and the rights you have.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">2. Information we collect</h2>
            <ul className="text-[14px] text-muted-foreground leading-[1.6] list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Account info</span> — name, email address, and authentication method (email one-time code).</li>
              <li><span className="text-foreground font-medium">Invoice data</span> — invoice numbers, client names, client emails, amounts, due dates, descriptions, and payment status that you enter.</li>
              <li><span className="text-foreground font-medium">Follow-up content</span> — drafts and sent messages generated for you and reviewed by you.</li>
              <li><span className="text-foreground font-medium">Onboarding answers</span> — the responses you provide during the welcome quiz.</li>
              <li><span className="text-foreground font-medium">Usage data</span> — basic logs (timestamps, error reports) needed to keep the service working.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">3. How we send follow-ups</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ sends follow-up emails on your behalf from{" "}
              <span className="text-foreground font-medium">noreply@chasehq.app</span> using a
              dedicated transactional email provider (Resend). Each message is sent with your
              display name in the From header (e.g. "Jane Smith via ChaseHQ") and{" "}
              <span className="text-foreground font-medium">Reply-To set to the email address
              on your ChaseHQ account</span>, so when a client clicks reply the message goes
              directly to your inbox.
            </p>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              ChaseHQ does not receive, read, store, display, or sync inbound replies, and we
              do not access any of your email accounts. We only handle the follow-up messages
              you author and approve inside the app.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">4. How we use your information</h2>
            <ul className="text-[14px] text-muted-foreground leading-[1.6] list-disc pl-5 space-y-1">
              <li>To draft and send invoice follow-ups you have approved.</li>
              <li>To operate, maintain, and improve the service.</li>
              <li>To comply with applicable legal obligations.</li>
            </ul>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              We do not sell your personal information. We do not use your invoice data or
              follow-up content to train third-party AI models.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">5. Service providers</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              We use third-party service providers to operate the Service, including for database
              hosting, authentication, and AI text generation. These providers may process your
              data on our behalf. We take reasonable steps to ensure they handle data
              responsibly, but we do not guarantee their security or compliance posture
              independently of our own.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">6. Your rights</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              You may at any time:
            </p>
            <ul className="text-[14px] text-muted-foreground leading-[1.6] list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you (visible in-app).</li>
              <li>Correct your display name in Settings; correct invoice and client details from each invoice's detail page.</li>
              <li>Delete your account and all associated data permanently from Settings → Data controls.</li>
              <li>Export a copy of your data from <span className="text-foreground font-medium">Settings → Data controls</span>.</li>
            </ul>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              If you are a California resident, you have additional rights under the CCPA/CPRA,
              including the right to know, delete, and opt out of the sale or sharing of personal
              information. We do not sell or share personal information as those terms are
              defined under the CCPA.
            </p>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              If you are located in the European Economic Area or the United Kingdom, you have
              rights under the GDPR (and UK GDPR), including the right to access, rectify, erase,
              restrict or object to processing, data portability, and to lodge a complaint with
              your local supervisory authority. You can exercise these rights from within the
              app (Settings → Data controls) or by contacting{" "}
              <a href="mailto:support@chasehq.app" className="text-primary underline">
                support@chasehq.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">7. Data Retention &amp; Security</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              We retain your data while your account is active. When you delete your account
              from Settings → Data controls, your invoices, follow-ups, and profile are
              deleted immediately from our live systems. Database
              backups maintained by our hosting provider may retain a copy for a limited period
              before automatic purging. We use
              TLS for data in transit. Data at rest is protected by infrastructure-level
              encryption provided by our hosting provider. We apply row-level access controls
              so that each user can only access their own data.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">8. Children's Privacy</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ is not directed to children under 13. We do not knowingly collect
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">9. Subscriptions &amp; Billing</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              ChaseHQ offers a paid subscription. On iOS, all purchases are
              processed by Apple through the App Store using your Apple ID. We
              never see, store, or process your payment card details. Apple
              shares with us a transaction identifier and subscription status
              (active, expired, canceled, refunded) so we can grant or revoke
              access. We store this information together with your account so
              you can use ChaseHQ on multiple devices.
            </p>
            <p className="text-[14px] text-muted-foreground leading-[1.6] mt-2">
              You can manage, pause, or cancel your subscription at any time
              from <span className="text-foreground font-medium">Settings → Apple ID → Subscriptions</span> on your
              device, or from Settings → Billing inside ChaseHQ. Refunds for
              App Store purchases are handled by Apple under their{" "}
              <a href="https://support.apple.com/billing" target="_blank" rel="noreferrer" className="text-primary underline">refund policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">10. Changes to This Policy</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              We may update this policy from time to time. Material changes will be communicated
              in-app or by email at least 7 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground mb-2 mt-1">11. Governing Law &amp; Contact</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.6]">
              This policy is governed by the laws of the Republic of India, without prejudice to
              any mandatory consumer-protection rights you have under the law of your country of
              residence. Disputes shall be subject to the exclusive jurisdiction of the competent
              courts of Bhopal, Madhya Pradesh, India, except where mandatory local law gives you
              the right to bring proceedings in your country of residence. Questions or requests
              can be sent to{" "}
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
