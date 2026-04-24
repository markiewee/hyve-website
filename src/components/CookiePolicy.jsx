import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-6 md:px-8">
        {/* Header */}
        <div className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center text-[#006b5f] hover:text-[#005048] mb-6 font-['Plus_Jakarta_Sans'] font-bold text-sm gap-2 hover:-translate-x-1 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="text-4xl md:text-5xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#121c2a] tracking-tight mb-4">
            Cookie Policy
          </h1>
          <p className="text-base text-[#555f6f] font-['Manrope']">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(187,202,198,0.15)] p-8 md:p-12 prose prose-lg max-w-none prose-headings:font-['Plus_Jakarta_Sans'] prose-headings:text-[#121c2a] prose-headings:tracking-tight prose-p:font-['Manrope'] prose-p:text-[#3c4947] prose-li:font-['Manrope'] prose-li:text-[#3c4947] prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-bold prose-h3:mt-6 prose-h3:mb-3 prose-ul:my-4 prose-li:my-1 prose-strong:text-[#121c2a]">
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