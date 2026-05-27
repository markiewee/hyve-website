import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SEO from './SEO';

const TermsOfService = () => {
  return (
    <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen pb-20">
      <SEO title="Terms of Service" canonical="/terms-of-service" />
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
            Terms of Service
          </h1>
          <p className="text-base text-foreground-variant">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 space-y-8">
          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-foreground-variant leading-relaxed">
              By accessing and using our services, you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to abide by the above, please
              do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-foreground-variant leading-relaxed">
              Lazybee provides coliving accommodation services, including but not limited to room
              rentals, shared living spaces, and related amenities in Singapore.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">3. User Accounts</h2>
            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Registration</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>You must provide accurate and complete information during registration</li>
              <li>You are responsible for maintaining the confidentiality of your account</li>
              <li>You must be at least 18 years old to use our services</li>
              <li>One person may not maintain more than one account</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Account Security</h3>
            <p className="text-foreground-variant leading-relaxed">
              You are responsible for all activities that occur under your account. Please notify
              us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">4. Booking and Payment Terms</h2>
            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Reservations</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>All bookings are subject to availability</li>
              <li>A security deposit may be required</li>
              <li>Payment must be made according to the agreed schedule</li>
              <li>Late payments may result in additional fees</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Cancellation Policy</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Cancellations must be made in writing</li>
              <li>Cancellation fees may apply depending on timing</li>
              <li>Refunds are processed according to our refund policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">5. House Rules and Conduct</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">All residents must comply with the following:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Respect other residents and their property</li>
              <li>Maintain cleanliness in shared spaces</li>
              <li>Follow quiet hours and noise policies</li>
              <li>No smoking in designated non-smoking areas</li>
              <li>No illegal activities on the premises</li>
              <li>Guests must be registered and are subject to limitations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">6. Property Use and Restrictions</h2>
            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Permitted Use</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Residential use only</li>
              <li>No commercial activities without prior approval</li>
              <li>No modifications to the property without permission</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Prohibited Activities</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Subletting or unauthorized sharing of space</li>
              <li>Disturbing other residents</li>
              <li>Damage to property or furnishings</li>
              <li>Violation of local laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">7. Maintenance and Repairs</h2>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>We will maintain the property in good condition</li>
              <li>Residents must report maintenance issues promptly</li>
              <li>Residents are responsible for damage caused by misuse</li>
              <li>We reserve the right to enter units for maintenance with notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">8. Liability and Insurance</h2>
            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Our Liability</h3>
            <p className="text-foreground-variant leading-relaxed">
              Our liability is limited to the extent permitted by law. We are not responsible
              for personal property loss or damage unless caused by our negligence.
            </p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Resident Responsibility</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Residents are encouraged to obtain personal insurance</li>
              <li>Residents are liable for damage they cause</li>
              <li>Report incidents immediately</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">9. Termination</h2>
            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">By Resident</h3>
            <p className="text-foreground-variant leading-relaxed">
              Residents may terminate their agreement by providing written notice according
              to the terms specified in their rental agreement.
            </p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">By Lazybee</h3>
            <p className="text-foreground-variant leading-relaxed">
              We may terminate agreements for violations of these terms, non-payment, or
              other material breaches.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">10. Privacy</h2>
            <p className="text-foreground-variant leading-relaxed">
              Your privacy is important to us. Please review our{' '}
              <Link to="/privacy-policy" className="text-accent hover:opacity-80">Privacy Policy</Link>,
              which also governs your use of our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">11. Dispute Resolution</h2>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>We encourage direct communication to resolve disputes</li>
              <li>Formal complaints should be submitted in writing</li>
              <li>Disputes will be governed by Singapore law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">12. Changes to Terms</h2>
            <p className="text-foreground-variant leading-relaxed">
              We reserve the right to modify these terms at any time. Changes will be effective
              immediately upon posting. Continued use of our services constitutes acceptance
              of modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">13. Contact Information</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">
              For questions about these Terms of Service, please contact us:
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

export default TermsOfService;
