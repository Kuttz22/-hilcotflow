import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2 text-sm">Last updated: March 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Hilcot TaskFlow ("we", "our", or "the application") is committed to protecting your
              personal information. This Privacy Policy explains what data we collect, how we use it,
              and the rights you have over your information when you use our task management platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                <strong className="text-foreground">Account Information:</strong> When you register or
                sign in, we collect your name, email address, and authentication credentials. If you
                use OAuth (Manus login), we receive your profile information from the OAuth provider.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Task Data:</strong> We store the tasks you create,
                including titles, descriptions, due dates, priority levels, status, and assignment
                information.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Activity Data:</strong> We maintain an audit log of
                actions performed on tasks (create, update, assign, complete, share) to support
                collaboration and accountability.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Device Tokens:</strong> If you enable push
                notifications, we store your device token to deliver reminders and alerts. These tokens
                are associated with your account and removed when you revoke notification permissions or
                delete your account.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Usage Preferences:</strong> We store your
                notification preferences, including quiet hours and maximum daily reminder limits.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>To provide and operate the task management service</li>
              <li>To send task reminders and escalation notifications based on your preferences</li>
              <li>To enable collaboration features such as task sharing and assignment</li>
              <li>To maintain activity logs for audit and accountability purposes</li>
              <li>To authenticate your identity and maintain session security</li>
              <li>To improve the application based on usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, rent, or share your personal information with third parties for marketing
              purposes. Your task data may be visible to other users within your organisation when you
              explicitly share tasks or assign them to team members. We do not disclose your information
              to external parties except as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your account and task data for as long as your account is active. When you
              delete your account, all associated data — including tasks, activity logs, device tokens,
              and preferences — is permanently deleted within 30 days. Activity logs for shared tasks
              may be retained for up to 90 days to support audit requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including encrypted transmission (HTTPS),
              hashed password storage (bcrypt), signed session tokens (JWT), and access controls that
              restrict task visibility to authorised participants only. No system is completely secure,
              and we encourage you to use a strong, unique password.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal data at any time. You can
              update your profile information within the application settings. To permanently delete your
              account and all associated data, use the "Delete Account" option in your account settings.
              For other data requests, please contact us at the address below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies and Sessions</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use a single HTTP-only session cookie to maintain your authenticated session. This
              cookie is essential for the operation of the application and cannot be disabled while
              using the service. We do not use tracking cookies or third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Significant changes will be
              communicated via an in-app notification. Continued use of the application after changes
              take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your data rights,
              please contact us at <strong className="text-foreground">privacy@hilcot.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
