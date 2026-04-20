import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
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
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 prose prose-lg max-w-none">
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create an account, 
            make a reservation, contact us, or otherwise communicate with us.
          </p>
          
          <h3>Personal Information</h3>
          <ul>
            <li>Name, email address, and phone number</li>
            <li>Government-issued identification</li>
            <li>Payment information</li>
            <li>Communication preferences</li>
            <li>Emergency contact information</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <ul>
            <li>Device information and IP address</li>
            <li>Browser type and version</li>
            <li>Usage data and analytics</li>
            <li>Location information (with your permission)</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Communicate with you about products, services, and events</li>
            <li>Monitor and analyze trends and usage</li>
            <li>Detect, investigate, and prevent fraudulent transactions</li>
          </ul>

          <h2>3. Information Sharing and Disclosure</h2>
          <p>We may share your information in the following circumstances:</p>
          
          <h3>With Your Consent</h3>
          <p>We may share your information when you give us your consent to do so.</p>
          
          <h3>Service Providers</h3>
          <p>
            We may share your information with third-party service providers who perform services 
            on our behalf, such as payment processing, data analysis, and customer service.
          </p>
          
          <h3>Legal Requirements</h3>
          <p>
            We may disclose your information if required to do so by law or in response to 
            valid requests by public authorities.
          </p>

          <h2>4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your 
            personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to fulfill the purposes 
            outlined in this privacy policy, unless a longer retention period is required by law.
          </p>

          <h2>6. Your Rights</h2>
          <p>Depending on your location, you may have the following rights:</p>
          <ul>
            <li>Access to your personal information</li>
            <li>Correction of inaccurate information</li>
            <li>Deletion of your personal information</li>
            <li>Restriction of processing</li>
            <li>Data portability</li>
            <li>Objection to processing</li>
          </ul>

          <h2>7. Cookies and Tracking Technologies</h2>
          <p>
            We use cookies and similar tracking technologies to collect and track information 
            and to improve and analyze our service. You can control cookies through your 
            browser settings.
          </p>

          <h2>8. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your 
            country of residence. We ensure appropriate safeguards are in place for such transfers.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of any 
            changes by posting the new policy on this page and updating the "Last updated" date.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have any questions about this privacy policy, please contact us at:
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

export default PrivacyPolicy;