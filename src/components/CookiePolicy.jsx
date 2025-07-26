import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const CookiePolicy = () => {
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
            Cookie Policy
          </h1>
          <p className="text-lg text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 prose prose-lg max-w-none">
          <h2>1. What Are Cookies?</h2>
          <p>
            Cookies are small text files that are placed on your computer or mobile device 
            when you visit a website. They are widely used to make websites work more 
            efficiently and to provide information to website owners.
          </p>

          <h2>2. How We Use Cookies</h2>
          <p>
            We use cookies to improve your browsing experience, analyze site traffic, 
            personalize content, and serve targeted advertisements.
          </p>

          <h2>3. Types of Cookies We Use</h2>
          
          <h3>Essential Cookies</h3>
          <p>
            These cookies are necessary for the website to function properly. They enable 
            basic functions like page navigation and access to secure areas of the website.
          </p>
          <ul>
            <li>Session management</li>
            <li>Security features</li>
            <li>Load balancing</li>
          </ul>

          <h3>Analytics Cookies</h3>
          <p>
            These cookies help us understand how visitors interact with our website by 
            collecting and reporting information anonymously.
          </p>
          <ul>
            <li>Google Analytics</li>
            <li>Page view tracking</li>
            <li>User behavior analysis</li>
            <li>Performance monitoring</li>
          </ul>

          <h3>Functional Cookies</h3>
          <p>
            These cookies enable enhanced functionality and personalization, such as 
            remembering your preferences and settings.
          </p>
          <ul>
            <li>Language preferences</li>
            <li>Location settings</li>
            <li>User interface customization</li>
            <li>Form data retention</li>
          </ul>

          <h3>Marketing Cookies</h3>
          <p>
            These cookies are used to track visitors across websites to display relevant 
            and engaging advertisements.
          </p>
          <ul>
            <li>Social media integration</li>
            <li>Targeted advertising</li>
            <li>Conversion tracking</li>
            <li>Retargeting campaigns</li>
          </ul>

          <h2>4. Third-Party Cookies</h2>
          <p>
            We may use third-party services that place cookies on your device. These include:
          </p>
          
          <h3>Google Services</h3>
          <ul>
            <li><strong>Google Analytics:</strong> Website analytics and reporting</li>
            <li><strong>Google Maps:</strong> Interactive maps and location services</li>
            <li><strong>Google Ads:</strong> Advertising and conversion tracking</li>
          </ul>

          <h3>Social Media</h3>
          <ul>
            <li><strong>Facebook:</strong> Social sharing and advertising</li>
            <li><strong>Instagram:</strong> Content integration</li>
            <li><strong>LinkedIn:</strong> Professional networking features</li>
          </ul>

          <h3>Communication Tools</h3>
          <ul>
            <li><strong>WhatsApp:</strong> Customer communication</li>
            <li><strong>Email providers:</strong> Newsletter and marketing emails</li>
          </ul>

          <h2>5. Managing Cookies</h2>
          
          <h3>Browser Settings</h3>
          <p>
            Most web browsers allow you to control cookies through their settings preferences. 
            You can:
          </p>
          <ul>
            <li>View what cookies are stored on your device</li>
            <li>Delete existing cookies</li>
            <li>Block cookies from specific websites</li>
            <li>Block all cookies (note: this may affect website functionality)</li>
          </ul>

          <h3>Browser-Specific Instructions</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p><strong>Chrome:</strong> Settings → Privacy and Security → Cookies and other site data</p>
            <p><strong>Firefox:</strong> Options → Privacy & Security → Cookies and Site Data</p>
            <p><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</p>
            <p><strong>Edge:</strong> Settings → Cookies and site permissions</p>
          </div>

          <h3>Opt-Out Tools</h3>
          <ul>
            <li><strong>Google Analytics:</strong> Use the Google Analytics Opt-out Browser Add-on</li>
            <li><strong>Advertising:</strong> Visit www.youronlinechoices.com for opt-out options</li>
            <li><strong>Do Not Track:</strong> Enable this browser setting to signal your preference</li>
          </ul>

          <h2>6. Cookie Consent</h2>
          <p>
            By continuing to use our website, you consent to our use of cookies as described 
            in this policy. You can withdraw your consent at any time by adjusting your 
            browser settings.
          </p>

          <h2>7. Cookie Retention</h2>
          <p>Cookies have different lifespans:</p>
          <ul>
            <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
            <li><strong>Persistent cookies:</strong> Remain until their expiration date or manual deletion</li>
            <li><strong>Analytics cookies:</strong> Typically expire after 2 years</li>
            <li><strong>Marketing cookies:</strong> May last from 30 days to 2 years</li>
          </ul>

          <h2>8. Updates to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in our 
            practices or for legal, operational, or regulatory reasons. Please check this 
            page periodically for updates.
          </p>

          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about our use of cookies, please contact us:
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

export default CookiePolicy;