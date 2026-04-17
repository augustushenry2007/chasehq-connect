import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: April 17, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Who we are</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ChaseHQ ("we", "us") provides invoice follow-up software to freelancers and small
              businesses in the United States. This policy explains what information we collect,
              how we use it, and the rights you have under U.S. law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information we collect</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Account info</span> — name, email address, and authentication method (Google or email/password).</li>
              <li><span className="text-foreground font-medium">Invoice data</span> — invoice numbers, client names, client emails, amounts, due dates, descriptions, and payment status that you enter.</li>
              <li><span className="text-foreground font-medium">Follow-up content</span> — drafts and sent messages generated for you and reviewed by you.</li>
              <li><span className="text-foreground font-medium">Onboarding answers</span> — the responses you provide during the welcome quiz.</li>
              <li><span className="text-foreground font-medium">Usage data</span> — basic logs (timestamps, error reports) needed to keep the service working.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Gmail access &amp; permissions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you grant Gmail send permission, we store an access token and refresh token so
              ChaseHQ can send follow-up emails on your behalf using your Gmail account. We
              request only the <code className="text-xs bg-muted px-1 py-0.5 rounded">gmail.send</code>{" "}
              and <code className="text-xs bg-muted px-1 py-0.5 rounded">userinfo.email</code> scopes.
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
              You can revoke this access at any time from Settings → Connected services, or from
              your Google Account permissions page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. How we use your information</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>To draft and send invoice follow-ups you have approved.</li>
              <li>To personalize your experience based on your onboarding answers.</li>
              <li>To operate, maintain, and improve the service.</li>
              <li>To detect and prevent fraud or abuse.</li>
              <li>To comply with U.S. legal obligations.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              We do not sell your personal information. We do not use your invoice data or
              follow-up content to train third-party AI models.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Service providers</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We rely on a small number of vetted U.S.-based vendors to host the service
              (database, authentication, AI text generation). These providers process data on
              our behalf under contractual confidentiality and security obligations.
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
              <li>Delete your account and associated data from Settings → Data controls.</li>
              <li>Disconnect Gmail access at any time.</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              California residents have additional rights under the CCPA/CPRA, including the
              right to know, delete, and opt out of the sale or sharing of personal information.
              We do not sell or share personal information as those terms are defined under the
              CCPA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data retention &amp; security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain your data while your account is active. When you delete your account,
              your invoices, follow-ups, and Gmail tokens are removed within 30 days from our
              live systems. We use industry-standard encryption in transit (TLS) and at rest,
              and apply role-level access controls.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Children's privacy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ChaseHQ is not directed to children under 13. We do not knowingly collect
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Changes to this policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this policy from time to time. Material changes will be communicated
              in-app or by email at least 7 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Governing law &amp; contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This policy is governed by the laws of the State of Delaware, United States,
              without regard to conflict-of-law principles. Questions or requests can be sent to{" "}
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
