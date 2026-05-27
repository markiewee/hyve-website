import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SEO from './SEO';

const CookiePolicy = () => {
  return (
    <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen pb-20">
      <SEO title="Cookie Policy" canonical="/cookie-policy" />
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
            Cookie Policy
          </h1>
          <p className="text-base text-foreground-variant">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 space-y-8">
          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">1. What Are Cookies?</h2>
            <p className="text-foreground-variant leading-relaxed">
              Cookies are small text files that are placed on your computer or mobile device
              when you visit a website. They are widely used to make websites work more
              efficiently and to provide information to website owners.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">2. How We Use Cookies</h2>
            <p className="text-foreground-variant leading-relaxed">
              We use cookies to improve your browsing experience, analyze site traffic,
              personalize content, and serve targeted advertisements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">3. Types of Cookies We Use</h2>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Essential Cookies</h3>
            <p className="text-foreground-variant leading-relaxed mb-3">
              These cookies are necessary for the website to function properly. They enable
              basic functions like page navigation and access to secure areas of the website.
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Session management</li>
              <li>Security features</li>
              <li>Load balancing</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Analytics Cookies</h3>
            <p className="text-foreground-variant leading-relaxed mb-3">
              These cookies help us understand how visitors interact with our website by
              collecting and reporting information anonymously.
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Google Analytics</li>
              <li>Page view tracking</li>
              <li>User behavior analysis</li>
              <li>Performance monitoring</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Functional Cookies</h3>
            <p className="text-foreground-variant leading-relaxed mb-3">
              These cookies enable enhanced functionality and personalization, such as
              remembering your preferences and settings.
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Language preferences</li>
              <li>Location settings</li>
              <li>User interface customization</li>
              <li>Form data retention</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Marketing Cookies</h3>
            <p className="text-foreground-variant leading-relaxed mb-3">
              These cookies are used to track visitors across websites to display relevant
              and engaging advertisements.
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>Social media integration</li>
              <li>Targeted advertising</li>
              <li>Conversion tracking</li>
              <li>Retargeting campaigns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">4. Third-Party Cookies</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">
              We may use third-party services that place cookies on your device. These include:
            </p>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Google Services</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li><strong className="text-foreground">Google Analytics:</strong> Website analytics and reporting</li>
              <li><strong className="text-foreground">Google Maps:</strong> Interactive maps and location services</li>
              <li><strong className="text-foreground">Google Ads:</strong> Advertising and conversion tracking</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Social Media</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li><strong className="text-foreground">Facebook:</strong> Social sharing and advertising</li>
              <li><strong className="text-foreground">Instagram:</strong> Content integration</li>
              <li><strong className="text-foreground">LinkedIn:</strong> Professional networking features</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Communication Tools</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li><strong className="text-foreground">WhatsApp:</strong> Customer communication</li>
              <li><strong className="text-foreground">Email providers:</strong> Newsletter and marketing emails</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">5. Managing Cookies</h2>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Browser Settings</h3>
            <p className="text-foreground-variant leading-relaxed mb-3">
              Most web browsers allow you to control cookies through their settings preferences.
              You can:
            </p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li>View what cookies are stored on your device</li>
              <li>Delete existing cookies</li>
              <li>Block cookies from specific websites</li>
              <li>Block all cookies (note: this may affect website functionality)</li>
            </ul>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Browser-Specific Instructions</h3>
            <div className="bg-surface-container rounded-xl p-4 border border-border space-y-2">
              <p className="text-foreground-variant"><strong className="text-foreground">Chrome:</strong> Settings → Privacy and Security → Cookies and other site data</p>
              <p className="text-foreground-variant"><strong className="text-foreground">Firefox:</strong> Options → Privacy &amp; Security → Cookies and Site Data</p>
              <p className="text-foreground-variant"><strong className="text-foreground">Safari:</strong> Preferences → Privacy → Manage Website Data</p>
              <p className="text-foreground-variant"><strong className="text-foreground">Edge:</strong> Settings → Cookies and site permissions</p>
            </div>

            <h3 className="text-lg font-display font-bold text-foreground mt-6 mb-3">Opt-Out Tools</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li><strong className="text-foreground">Google Analytics:</strong> Use the Google Analytics Opt-out Browser Add-on</li>
              <li><strong className="text-foreground">Advertising:</strong> Visit <a href="https://www.youronlinechoices.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-80">www.youronlinechoices.com</a> for opt-out options</li>
              <li><strong className="text-foreground">Do Not Track:</strong> Enable this browser setting to signal your preference</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">6. Cookie Consent</h2>
            <p className="text-foreground-variant leading-relaxed">
              By continuing to use our website, you consent to our use of cookies as described
              in this policy. You can withdraw your consent at any time by adjusting your
              browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">7. Cookie Retention</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">Cookies have different lifespans:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground-variant">
              <li><strong className="text-foreground">Session cookies:</strong> Deleted when you close your browser</li>
              <li><strong className="text-foreground">Persistent cookies:</strong> Remain until their expiration date or manual deletion</li>
              <li><strong className="text-foreground">Analytics cookies:</strong> Typically expire after 2 years</li>
              <li><strong className="text-foreground">Marketing cookies:</strong> May last from 30 days to 2 years</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">8. Updates to This Policy</h2>
            <p className="text-foreground-variant leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in our
              practices or for legal, operational, or regulatory reasons. Please check this
              page periodically for updates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-bold text-foreground mb-4">9. Contact Us</h2>
            <p className="text-foreground-variant leading-relaxed mb-4">
              If you have any questions about our use of cookies, please contact us:
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

export default CookiePolicy;
