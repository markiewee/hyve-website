import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';
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

    const phoneNumber = '6580885410';
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
    <div className="min-h-screen bg-[#FAF6EC] pt-24">
      <SEO
        title="Contact Lazybee"
        description="Get in touch with Lazybee co-living. WhatsApp us at +65 8088 5410, email admin@lazybee.sg, or schedule a property viewing today."
        canonical="/contact"
        schema={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Lazybee Co-living",
          telephone: "+6580885410",
          email: "admin@lazybee.sg",
          url: "https://www.lazybee.sg",
          address: { "@type": "PostalAddress", addressCountry: "SG", addressLocality: "Singapore" },
          openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "00:00", closes: "23:59" }
        }}
      />
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#D9A441] text-[#1F2937] font-['Inter'] text-xs font-bold uppercase tracking-widest mb-6">
            {t('public.contact.badge')}
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-4xl md:text-5xl font-extrabold tracking-tight text-[#1F2937] mb-4">
            {t('public.contact.title')}
          </h1>
          <p className="text-xl text-[#1F2937] max-w-2xl mx-auto font-['Manrope']">
            {t('public.contact.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white p-8 md:p-10 rounded-2xl shadow-sm border border-[rgba(187,202,198,0.15)]">
              <h2 className="text-2xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#1F2937] mb-2">
                {t('public.contact.sendMessage')}
              </h2>
              <p className="text-[#1F2937] text-sm mb-8 font-['Manrope']">
                Fill out the form below and we&apos;ll get back to you within a few hours
              </p>

              {isSubmitted ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-6xl text-[#D9A441] mb-4 block">check_circle</span>
                  <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] mb-2">Message Sent!</h3>
                  <p className="text-[#1F2937]">Thank you for reaching out. We&apos;ll be in touch soon.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#1F2937] mb-2">
                        {t('public.contact.fullName')} *
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full bg-[#F2D88A] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A87813] focus:border-transparent outline-none font-['Manrope']"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#1F2937] mb-2">
                        {t('public.contact.email')} *
                      </label>
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full bg-[#F2D88A] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A87813] focus:border-transparent outline-none font-['Manrope']"
                        placeholder="hello@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#1F2937] mb-2">
                        {t('public.contact.phone')}
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full bg-[#F2D88A] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A87813] focus:border-transparent outline-none font-['Manrope']"
                        placeholder="+65 1234 5678"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#1F2937] mb-2">
                        {t('public.contact.subject')}
                      </label>
                      <select
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        className="w-full bg-[#F2D88A] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A87813] focus:border-transparent outline-none appearance-none font-['Manrope']"
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
                    <label className="block text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#1F2937] mb-2">
                      {t('public.contact.message')} *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="w-full bg-[#F2D88A] border-transparent rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#A87813] focus:border-transparent outline-none resize-none font-['Manrope']"
                      placeholder="Tell us about your requirements, preferred location, budget, move-in date..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#A87813] text-white py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#A87813]/90 transition-all active:scale-95 shadow-lg shadow-[#A87813]/20 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">send</span>
                    {t('public.contact.send')}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-[rgba(187,202,198,0.15)]">
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-6">{t('public.contact.quickContact')}</h3>
              <div className="space-y-6">
                <a
                  href="https://wa.me/6580885410"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-[#F2D88A] transition-colors"
                >
                  <div className="w-10 h-10 bg-[#D9A441]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#A87813]">chat</span>
                  </div>
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937]">{t('public.contact.whatsapp')}</h4>
                    <p className="text-sm text-[#1F2937]">+65 8088 5410</p>
                    <p className="text-xs text-[#A87813] font-['Inter'] font-semibold mt-1">Message us now</p>
                  </div>
                </a>
                <a
                  href="mailto:admin@lazybee.sg"
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-[#F2D88A] transition-colors"
                >
                  <div className="w-10 h-10 bg-[#D9A441]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#A87813]">mail</span>
                  </div>
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937]">{t('public.contact.email')}</h4>
                    <p className="text-sm text-[#1F2937]">admin@lazybee.sg</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Office Hours */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-[rgba(187,202,198,0.15)]">
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#A87813]">schedule</span>
                {t('public.contact.responseTime')}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-[#1F2937]">{t('public.contact.whatsapp')}</span>
                  <span className="font-['Inter'] font-semibold text-[#1F2937]">Within a few hours</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#1F2937]">{t('public.contact.email')}</span>
                  <span className="font-['Inter'] font-semibold text-[#1F2937]">Same day</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#1F2937]">Viewings</span>
                  <span className="font-['Inter'] font-semibold text-[#1F2937]">Same day / next day</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#D9A441]/10 rounded-xl">
                <p className="text-sm text-[#A87813] font-['Manrope']">
                  <strong>24/7 Support</strong> for current residents
                </p>
              </div>
            </div>

            {/* Quick link to properties */}
            <Link
              to="/properties"
              className="block bg-[#A87813] text-white p-6 rounded-2xl text-center hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined text-3xl mb-2 block">home_work</span>
              <p className="font-['Plus_Jakarta_Sans'] font-bold">{t('public.contact.browseProperties')}</p>
              <p className="text-white/70 text-sm font-['Manrope'] mt-1">{t('public.contact.findIdealRoom')}</p>
            </Link>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#1F2937] mb-4">
              {t('public.faq.title')}
            </h2>
            <p className="text-[#1F2937] font-['Manrope']">Quick answers to common questions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl border border-[rgba(187,202,198,0.15)] hover:shadow-sm transition-shadow"
              >
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] mb-3">{faq.question}</h4>
                <p className="text-[#1F2937] text-sm font-['Manrope'] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/faqs"
              className="text-[#A87813] font-['Plus_Jakarta_Sans'] font-bold hover:underline underline-offset-4 inline-flex items-center gap-1"
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
        <p>The fastest way to reach Lazybee is via WhatsApp at +65 8088 5410. Response time is typically within a few hours. Email: admin@lazybee.sg (same day response). Property viewings can be arranged same-day or next-day. Lazybee offers 24/7 support for current residents. For room availability and pricing, visit lazybee.sg/properties or message on WhatsApp. No appointment needed for inquiries.</p>
      </section>
    </div>
  );
};

export default ContactPage;
