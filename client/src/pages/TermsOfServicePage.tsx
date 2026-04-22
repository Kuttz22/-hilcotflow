import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground mt-2 text-sm">Last updated: March 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Hilcot TaskFlow ("the Service"), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
              These terms apply to all users, including team members, administrators, and guests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hilcot TaskFlow is a professional task management platform that enables individuals and
              teams to create, assign, track, and collaborate on tasks. Features include priority-based
              reminders, escalation management, activity logging, and team collaboration tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and
                for all activities that occur under your account. You must notify us immediately of any
                unauthorised use of your account.
              </p>
              <p className="leading-relaxed">
                You must provide accurate and complete information when creating an account. Accounts
                created with false information may be suspended or terminated.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Use the Service for any unlawful purpose or in violation of applicable regulations</li>
              <li>Attempt to gain unauthorised access to other users' accounts or task data</li>
              <li>Upload or transmit malicious code, viruses, or harmful content</li>
              <li>Use the Service to harass, intimidate, or harm other users</li>
              <li>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
              <li>Use automated tools to scrape or bulk-extract data from the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Task Data and Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of all task data and content you create within the Service. By using
              the Service, you grant us a limited licence to store, process, and display your content
              solely for the purpose of providing the Service to you and your team members.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Collaboration and Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you share tasks with other users or assign tasks to team members, those users will
              have access to the task content and activity history. You are responsible for ensuring
              that you have appropriate authorisation before sharing sensitive information through the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Notifications and Reminders</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service includes automated reminder and escalation notifications. You can configure
              notification preferences, including quiet hours and daily limits, within your account
              settings. By enabling push notifications, you consent to receiving task-related alerts
              on your registered devices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. We are not liable for any
              indirect, incidental, or consequential damages arising from your use of the Service,
              including but not limited to data loss, missed deadlines, or business interruption. Our
              total liability shall not exceed the amount paid by you for the Service in the preceding
              12 months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Account Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may delete your account at any time through the account settings. We reserve the
              right to suspend or terminate accounts that violate these Terms of Service. Upon
              termination, your data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will be
              communicated via an in-app notification at least 14 days before taking effect. Continued
              use of the Service after changes take effect constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service are governed by applicable law. Any disputes arising from these
              terms or your use of the Service shall be resolved through binding arbitration or in the
              courts of the applicable jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, please contact us at{" "}
              <strong className="text-foreground">legal@hilcot.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
