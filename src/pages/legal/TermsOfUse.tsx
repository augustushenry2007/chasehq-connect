import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfUse() {
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

        <h1 className="text-2xl font-bold text-foreground mb-2">Terms of Use</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: April 17, 2026</p>

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By creating an account or using ChaseHQ (the "Service"), you agree to these Terms
              of Use. If you do not agree, do not use the Service. The Service is intended for
              use by individuals and businesses located in the United States.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Eligibility</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You must be at least 18 years old and able to form a binding contract under U.S.
              law to use ChaseHQ. By using the Service you represent that you meet these
              requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Your account</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for safeguarding your account credentials and for all activity
              that occurs under your account. Notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Permitted use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You may use ChaseHQ only to send invoice follow-ups to clients with whom you have
              an existing business relationship. You agree not to:
            </p>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1 mt-2">
              <li>Send unsolicited bulk email, spam, or marketing communications.</li>
              <li>Send harassing, threatening, or unlawful content.</li>
              <li>Impersonate another person or entity.</li>
              <li>Reverse engineer, scrape, or attempt to disrupt the Service.</li>
              <li>Use the Service in violation of the CAN-SPAM Act or other U.S. laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Gmail integration</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you connect Gmail, ChaseHQ sends emails on your behalf using credentials you
              authorize. You remain solely responsible for the content of every follow-up sent
              from your account, including compliance with applicable email and consumer
              protection laws. You may revoke access at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. AI-generated content</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ChaseHQ uses AI to draft follow-up messages. Drafts are suggestions — you must
              review and approve every message before it is sent. We make no warranty regarding
              the accuracy, tone, or legal sufficiency of AI-generated text.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Your content</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You retain all rights to the invoices, client information, and follow-up text you
              create or send through ChaseHQ. You grant us a limited license to host, process,
              and transmit that content solely to operate the Service for you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Fees</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pricing for paid plans, if any, will be disclosed at the point of purchase. Free
              tiers may be modified or discontinued at our discretion with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Termination</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You may stop using the Service and delete your account at any time. We may
              suspend or terminate accounts that violate these Terms or that pose a security or
              abuse risk to the Service or other users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Disclaimers</h2>
            <p className="text-sm text-muted-foreground leading-relaxed uppercase">
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any
              kind, whether express or implied, including merchantability, fitness for a
              particular purpose, and non-infringement. We do not warrant that the Service will
              be uninterrupted, error-free, or that follow-ups will result in payment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Limitation of liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To the maximum extent permitted by U.S. law, ChaseHQ and its affiliates shall not
              be liable for any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits, revenue, or data, arising out of or related to
              your use of the Service. Our total aggregate liability for any claim relating to
              the Service shall not exceed the greater of (a) the amount you paid us in the 12
              months preceding the claim, or (b) USD $100.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Indemnification</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless ChaseHQ from any claim, demand, loss, or
              damages, including reasonable attorneys' fees, arising out of your use of the
              Service, your content, or your violation of these Terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">13. Governing law &amp; venue</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the State of Delaware, United States,
              without regard to its conflict-of-law principles. Any dispute arising out of or
              related to the Service shall be brought exclusively in the state or federal
              courts located in Delaware, and you consent to personal jurisdiction there.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">14. Changes</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. Material changes will be communicated
              in-app or by email. Your continued use of the Service after changes take effect
              constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">15. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions about these Terms can be sent to{" "}
              <a href="mailto:legal@chasehq.app" className="text-primary underline">
                legal@chasehq.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
