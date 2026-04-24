import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="h-screen bg-background overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-5 py-6 pb-[max(env(safe-area-inset-bottom,16px),32px)]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: April 22, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Who we are</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ChaseHQ ("we", "us") provides invoice follow-up software to freelancers and small
              businesses in the United States. This policy explains what information we collect,
              how we use it, and the rights you have.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information we collect</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Account info</span> — name, email address, and authentication method (Google).</li>
              <li><span className="text-foreground font-medium">Invoice data</span> — invoice numbers, client names, client emails, amounts, due dates, descriptions, and payment status that you enter.</li>
              <li><span className="text-foreground font-medium">Follow-up content</span> — drafts and sent messages generated for you and reviewed by you.</li>
              <li><span className="text-foreground font-medium">Onboarding answers</span> — the responses you provide during the welcome quiz.</li>
              <li><span className="text-foreground font-medium">Usage data</span> — basic logs (timestamps, error reports) needed to keep the service working.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Email Access &amp; Permissions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you sign up with Google, ChaseHQ requests the{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">gmail.send</code>{" "}
              and <code className="text-xs bg-muted px-1 py-0.5 rounded">userinfo.email</code> scopes
              as part of the sign-up flow. This grants ChaseHQ permission to send follow-up emails
              from your Gmail address on your behalf. We store the resulting access token and
              refresh token for this purpose.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              We do not read your inbox. We do not access, store, or share the contents of any
              email other than the follow-ups you author and approve. ChaseHQ's use of
              information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              You can revoke this access at any time from your Google Account permissions page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. How we use your information</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>To draft and send invoice follow-ups you have approved.</li>
              <li>To operate, maintain, and improve the service.</li>
              <li>To detect and prevent fraud or abuse.</li>
              <li>To comply with applicable legal obligations.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              We do not sell your personal information. We do not use your invoice data or
              follow-up content to train third-party AI models.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Service providers</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use third-party service providers to operate the Service, including for database
              hosting, authentication, and AI text generation. These providers may process your
              data on our behalf. We take reasonable steps to ensure they handle data
              responsibly, but we do not guarantee their security or compliance posture
              independently of our own.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Your rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You may at any time:
            </p>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you (visible in-app).</li>
              <li>Correct inaccurate information by editing it in Settings.</li>
              <li>Delete your account and all associated data permanently from Settings → Data controls.</li>
              <li>Export a copy of your data from <span className="text-foreground font-medium">Settings → Data controls</span>.</li>
              <li>Disconnect Google email access at any time from your Google Account permissions page.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              California residents have additional rights under the CCPA/CPRA, including the
              right to know, delete, and opt out of the sale or sharing of personal information.
              We do not sell or share personal information as those terms are defined under the
              CCPA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data Retention &amp; Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain your data while your account is active. When you delete your account
              from Settings → Data controls, your invoices, follow-ups, connected email
              credentials, and profile are deleted immediately from our live systems. Database
              backups maintained by our hosting provider may retain a copy for a limited period
              before automatic purging. We use
              TLS for data in transit. Data at rest is protected by infrastructure-level
              encryption provided by our hosting provider. We apply row-level access controls
              so that each user can only access their own data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Children's Privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ChaseHQ is not directed to children under 13. We do not knowingly collect
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Subscriptions &amp; Billing</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ChaseHQ offers a paid subscription. On iOS, all purchases are
              processed by Apple through the App Store using your Apple ID. We
              never see, store, or process your payment card details. Apple
              shares with us a transaction identifier and subscription status
              (active, expired, canceled, refunded) so we can grant or revoke
              access. We store this information together with your account so
              you can use ChaseHQ on multiple devices.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              You can manage, pause, or cancel your subscription at any time
              from <span className="text-foreground font-medium">Settings → Apple ID → Subscriptions</span> on your
              device, or from Settings → Billing inside ChaseHQ. Refunds for
              App Store purchases are handled by Apple under their{" "}
              <a href="https://support.apple.com/billing" target="_blank" rel="noreferrer" className="text-primary underline">refund policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this policy from time to time. Material changes will be communicated
              in-app or by email at least 7 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Governing Law &amp; Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This policy is governed by the laws of the Republic of India. Disputes shall be
              subject to the exclusive jurisdiction of the competent courts of Bhopal, Madhya
              Pradesh, India. Questions or requests can be sent to{" "}
              <a href="mailto:privacy@chasehq.app" className="text-primary underline">
                privacy@chasehq.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
