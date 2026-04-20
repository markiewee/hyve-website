import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-lg text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 prose prose-lg max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using our services, you accept and agree to be bound by the terms 
            and provision of this agreement. If you do not agree to abide by the above, please 
            do not use this service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Hyve provides coliving accommodation services, including but not limited to room 
            rentals, shared living spaces, and related amenities in Singapore.
          </p>

          <h2>3. User Accounts</h2>
          <h3>Registration</h3>
          <ul>
            <li>You must provide accurate and complete information during registration</li>
            <li>You are responsible for maintaining the confidentiality of your account</li>
            <li>You must be at least 18 years old to use our services</li>
            <li>One person may not maintain more than one account</li>
          </ul>

          <h3>Account Security</h3>
          <p>
            You are responsible for all activities that occur under your account. Please notify 
            us immediately of any unauthorized use of your account.
          </p>

          <h2>4. Booking and Payment Terms</h2>
          <h3>Reservations</h3>
          <ul>
            <li>All bookings are subject to availability</li>
            <li>A security deposit may be required</li>
            <li>Payment must be made according to the agreed schedule</li>
            <li>Late payments may result in additional fees</li>
          </ul>

          <h3>Cancellation Policy</h3>
          <ul>
            <li>Cancellations must be made in writing</li>
            <li>Cancellation fees may apply depending on timing</li>
            <li>Refunds are processed according to our refund policy</li>
          </ul>

          <h2>5. House Rules and Conduct</h2>
          <p>All residents must comply with the following:</p>
          <ul>
            <li>Respect other residents and their property</li>
            <li>Maintain cleanliness in shared spaces</li>
            <li>Follow quiet hours and noise policies</li>
            <li>No smoking in designated non-smoking areas</li>
            <li>No illegal activities on the premises</li>
            <li>Guests must be registered and are subject to limitations</li>
          </ul>

          <h2>6. Property Use and Restrictions</h2>
          <h3>Permitted Use</h3>
          <ul>
            <li>Residential use only</li>
            <li>No commercial activities without prior approval</li>
            <li>No modifications to the property without permission</li>
          </ul>

          <h3>Prohibited Activities</h3>
          <ul>
            <li>Subletting or unauthorized sharing of space</li>
            <li>Disturbing other residents</li>
            <li>Damage to property or furnishings</li>
            <li>Violation of local laws and regulations</li>
          </ul>

          <h2>7. Maintenance and Repairs</h2>
          <ul>
            <li>We will maintain the property in good condition</li>
            <li>Residents must report maintenance issues promptly</li>
            <li>Residents are responsible for damage caused by misuse</li>
            <li>We reserve the right to enter units for maintenance with notice</li>
          </ul>

          <h2>8. Liability and Insurance</h2>
          <h3>Our Liability</h3>
          <p>
            Our liability is limited to the extent permitted by law. We are not responsible 
            for personal property loss or damage unless caused by our negligence.
          </p>

          <h3>Resident Responsibility</h3>
          <ul>
            <li>Residents are encouraged to obtain personal insurance</li>
            <li>Residents are liable for damage they cause</li>
            <li>Report incidents immediately</li>
          </ul>

          <h2>9. Termination</h2>
          <h3>By Resident</h3>
          <p>
            Residents may terminate their agreement by providing written notice according 
            to the terms specified in their rental agreement.
          </p>

          <h3>By Hyve</h3>
          <p>
            We may terminate agreements for violations of these terms, non-payment, or 
            other material breaches.
          </p>

          <h2>10. Privacy</h2>
          <p>
            Your privacy is important to us. Please review our Privacy Policy, which also 
            governs your use of our services.
          </p>

          <h2>11. Dispute Resolution</h2>
          <ul>
            <li>We encourage direct communication to resolve disputes</li>
            <li>Formal complaints should be submitted in writing</li>
            <li>Disputes will be governed by Singapore law</li>
          </ul>

          <h2>12. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Changes will be effective 
            immediately upon posting. Continued use of our services constitutes acceptance 
            of modified terms.
          </p>

          <h2>13. Contact Information</h2>
          <p>
            For questions about these Terms of Service, please contact us:
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="mb-2"><strong>Email:</strong> hello@hyve.sg</p>
            <p className="mb-2"><strong>WhatsApp:</strong> +65 80885410</p>
            <p><strong>Address:</strong> Singapore</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;