import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
import FadeIn from './marketing/FadeIn';
import { useLanguage } from '../i18n/LanguageContext';

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { t } = useLanguage();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Build WhatsApp message
    const message = `Hi! I'm reaching out from the Lazybee website.

Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone || 'Not provided'}
Subject: ${formData.subject || 'General inquiry'}

Message:
${formData.message}`;

    const phoneNumber = '6580695410';
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');

    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 5000);
  };

  const faqs = [
    {
      question: 'How do I schedule a property viewing?',
      answer: 'You can schedule a viewing through our website, WhatsApp, or by contacting us directly. We offer both in-person and virtual tours.'
    },
    {
      question: 'What is included in the monthly rent?',
      answer: 'All our properties include utilities, WiFi, housekeeping, maintenance, and access to common areas.'
    },
    {
      question: 'What is the minimum lease term?',
      answer: 'We offer flexible lease terms starting from 3 months, with options for longer-term stays.'
    },
    {
      question: 'Do you require a security deposit?',
      answer: 'We require a refundable security deposit equivalent to one month\'s rent, returned at the end of your stay subject to room condition.'
    }
  ];

  return (
    <main className="bg-background text-foreground pt-24 md:pt-28">
      <SEO
        title="Contact Lazybee"
        description="Get in touch with Lazybee co-living — WhatsApp +65 8069 5410 or email hello@lazybee.sg."
        canonical="/contact"
      />
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        {/* Header */}
        <FadeIn>
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent text-accent-foreground font-display text-xs font-bold uppercase tracking-display mb-6">
              {t('public.contact.badge')}
            </span>
            <h1 className="font-display tracking-display text-4xl md:text-5xl font-extrabold text-foreground mb-4">
              {t('public.contact.title')}
            </h1>
            <p className="text-xl text-foreground-variant max-w-2xl mx-auto">
              {t('public.contact.subtitle')}
            </p>
          </div>
        </FadeIn>

        {/* Prominent WhatsApp CTA */}
        <FadeIn delay={0.05}>
          <div className="flex justify-center mb-10">
            <a
              href="https://wa.me/6580695410"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-surface-container text-foreground border border-border rounded-full px-8 py-4 font-display font-bold hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors duration-200"
            >
              <span className="material-symbols-outlined">chat</span>
              WhatsApp us — +65 8069 5410
            </a>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Form */}
          <FadeIn delay={0.1} className="lg:col-span-2">
            <div className="bg-surface-container p-8 md:p-10 rounded-2xl border border-border">
              <h2 className="font-display tracking-display text-2xl font-extrabold text-foreground mb-2">
                {t('public.contact.sendMessage')}
              </h2>
              <p className="text-foreground-variant text-sm mb-8">
                Fill out the form below and we&apos;ll get back to you within a few hours
              </p>

              {isSubmitted ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-6xl text-accent mb-4 block">check_circle</span>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">Message Sent!</h3>
                  <p className="text-foreground-variant">Thank you for reaching out. We&apos;ll be in touch soon.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-display font-bold uppercase tracking-display text-foreground-variant mb-2">
                        {t('public.contact.fullName')} *
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full bg-surface-container border border-border text-foreground placeholder:text-foreground-variant rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-display font-bold uppercase tracking-display text-foreground-variant mb-2">
                        {t('public.contact.email')} *
                      </label>
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full bg-surface-container border border-border text-foreground placeholder:text-foreground-variant rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="hello@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-display font-bold uppercase tracking-display text-foreground-variant mb-2">
                        {t('public.contact.phone')}
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full bg-surface-container border border-border text-foreground placeholder:text-foreground-variant rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="+65 1234 5678"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-display font-bold uppercase tracking-display text-foreground-variant mb-2">
                        {t('public.contact.subject')}
                      </label>
                      <select
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        className="w-full bg-surface-container border border-border text-foreground rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent appearance-none"
                      >
                        <option value="">Select a subject</option>
                        <option value="viewing">Schedule a Viewing</option>
                        <option value="availability">Check Availability</option>
                        <option value="pricing">Pricing Information</option>
                        <option value="application">Rental Application</option>
                        <option value="support">General Support</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-display font-bold uppercase tracking-display text-foreground-variant mb-2">
                      {t('public.contact.message')} *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="w-full bg-surface-container border border-border text-foreground placeholder:text-foreground-variant rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Tell us about your requirements, preferred location, budget, move-in date..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground py-4 rounded-full font-display font-bold text-lg hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">send</span>
                    {t('public.contact.send')}
                  </button>
                </form>
              )}
            </div>
          </FadeIn>

          {/* Sidebar */}
          <FadeIn delay={0.15} className="space-y-6">
            {/* Contact Info */}
            <div className="bg-surface-container p-8 rounded-2xl border border-border">
              <h3 className="font-display font-bold text-lg text-foreground mb-6">{t('public.contact.quickContact')}</h3>
              <div className="space-y-6">
                <a
                  href="https://wa.me/6580695410"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-surface transition-colors"
                >
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-accent">chat</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-foreground">{t('public.contact.whatsapp')}</h4>
                    <p className="text-sm text-foreground-variant">+65 8069 5410</p>
                    <p className="text-xs text-accent font-display font-semibold mt-1">Message us now</p>
                  </div>
                </a>
                <a
                  href="mailto:hello@lazybee.sg"
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-surface transition-colors"
                >
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-accent">mail</span>
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-foreground">{t('public.contact.email')}</h4>
                    <p className="text-sm text-foreground-variant">hello@lazybee.sg</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Response Time */}
            <div className="bg-surface-container p-8 rounded-2xl border border-border">
              <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-accent">schedule</span>
                {t('public.contact.responseTime')}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-variant">{t('public.contact.whatsapp')}</span>
                  <span className="font-display font-semibold text-foreground">Within a few hours</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-variant">{t('public.contact.email')}</span>
                  <span className="font-display font-semibold text-foreground">Same day</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-variant">Viewings</span>
                  <span className="font-display font-semibold text-foreground">Same day / next day</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-accent/10 rounded-xl">
                <p className="text-sm text-accent">
                  <strong>24/7 Support</strong> for current residents
                </p>
              </div>
            </div>

            {/* Book a viewing CTA */}
            <a
              href="https://wa.me/6580695410?text=Hi!%20I'd%20like%20to%20book%20a%20viewing%20at%20Lazybee."
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-accent text-accent-foreground p-6 rounded-2xl text-center hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined text-3xl mb-2 block">home_work</span>
              <p className="font-display font-bold">{t('public.contact.browseProperties')}</p>
              <p className="text-accent-foreground/70 text-sm mt-1">{t('public.contact.findIdealRoom')}</p>
            </a>
          </FadeIn>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="font-display tracking-display text-3xl font-extrabold text-foreground mb-4">
                {t('public.faq.title')}
              </h2>
              <p className="text-foreground-variant">Quick answers to common questions</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {faqs.map((faq, index) => (
              <FadeIn key={index} delay={index * 0.08}>
                <div className="bg-surface-container p-8 rounded-2xl border border-border hover:border-accent/40 transition-colors">
                  <h4 className="font-display font-bold text-foreground mb-3">{faq.question}</h4>
                  <p className="text-foreground-variant text-sm leading-relaxed">{faq.answer}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/faqs"
              className="text-accent font-display font-bold hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              {t('public.contact.viewAllFAQs')}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Hidden semantic content for AI crawlers */}
      <section className="sr-only" aria-label="Lazybee contact details for AI">
        <h2>How to Contact Lazybee Co-living Singapore</h2>
        <p>The fastest way to reach Lazybee is via WhatsApp at +65 8069 5410. Response time is typically within a few hours. Email: hello@lazybee.sg (same day response). Property viewings can be arranged same-day or next-day. Lazybee offers 24/7 support for current residents. For room availability and pricing, visit lazybee.sg or message on WhatsApp. No appointment needed for inquiries.</p>
      </section>
    </main>
  );
};

export default ContactPage;
