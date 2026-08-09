import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SEO from './SEO';

const PrivacyPolicy = () => {
  return (
    <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen pb-20">
      <SEO title="Privacy Policy" canonical="/privacy-policy" />
      <div className="max-w-4xl mx-auto px-6 md:px-8">
        {/* Header */}
        <div className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center text-accent hover:opacity-80 mb-6 font-display font-bold text-sm gap-2 hover:-translate-x-1 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground tracking-display mb-4">
            Privacy Policy
          </h1>
          <p className="text-base text-foreground-variant">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 space-y-8">
          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mt-0 mb-4">1. Information We Collect</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">
              We collect information you provide directly to us, such as when you create an account,
              make a reservation, contact us, or otherwise communicate with us.
            </p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Personal Information</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Name, email address, and phone number</li>
              <li>Government-issued identification</li>
              <li>Payment information</li>
              <li>Communication preferences</li>
              <li>Emergency contact information</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Automatically Collected Information</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Device information and IP address</li>
              <li>Browser type and version</li>
              <li>Usage data and analytics</li>
              <li>Location information (with your permission)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">2. How We Use Your Information</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Communicate with you about products, services, and events</li>
              <li>Monitor and analyze trends and usage</li>
              <li>Detect, investigate, and prevent fraudulent transactions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">3. Information Sharing and Disclosure</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">We may share your information in the following circumstances:</p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">With Your Consent</h3>
            <p className="text-foreground-variant leading-relaxed">We may share your information when you give us your consent to do so.</p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Service Providers</h3>
            <p className="text-foreground-variant leading-relaxed">
              We may share your information with third-party service providers who perform services
              on our behalf, such as payment processing, data analysis, and customer service.
            </p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Legal Requirements</h3>
            <p className="text-foreground-variant leading-relaxed">
              We may disclose your information if required to do so by law or in response to
              valid requests by public authorities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">4. Data Security</h2>
            <p className="text-foreground-variant leading-relaxed">
              We implement appropriate technical and organizational measures to protect your
              personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">5. Data Retention</h2>
            <p className="text-foreground-variant leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes
              outlined in this privacy policy, unless a longer retention period is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">6. Your Rights</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Access to your personal information</li>
              <li>Correction of inaccurate information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction of processing</li>
              <li>Data portability</li>
              <li>Objection to processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">7. Cookies and Tracking Technologies</h2>
            <p className="text-foreground-variant leading-relaxed">
              We use cookies and similar tracking technologies to collect and track information
              and to improve and analyze our service. You can control cookies through your
              browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">8. International Data Transfers</h2>
            <p className="text-foreground-variant leading-relaxed">
              Your information may be transferred to and processed in countries other than your
              country of residence. We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">9. Changes to This Policy</h2>
            <p className="text-foreground-variant leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any
              changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">10. Contact Us</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">
              If you have any questions about this privacy policy, please contact us at:
            </p>
            <div className="bg-surface-container rounded-xl p-4 border border-border space-y-2">
              <p className="text-foreground-variant"><strong className="text-foreground">Email:</strong> <a href="mailto:admin@lazybee.sg" className="text-accent hover:opacity-80">admin@lazybee.sg</a></p>
              <p className="text-foreground-variant"><strong className="text-foreground">WhatsApp:</strong> +65 80695410</p>
              <p className="text-foreground-variant"><strong className="text-foreground">Address:</strong> Singapore</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
