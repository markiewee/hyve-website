import { useState } from 'react';
import SEO from './SEO';
import FadeIn from './marketing/FadeIn';
import { BOOKING_URL } from '../lib/booking';

// One job: reach the team. Everything resident-facing lives on book.lazybee.sg.

const WHATSAPP = '6580695410';
const EMAIL = 'mark@meetmillia.com';

const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const onChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = `Hi! Reaching out from lazybee.sg.\n\nName: ${form.name}\nEmail: ${form.email}\n\n${form.message}`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
    setSent(true);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen">
      <SEO
        title="Contact Lazybee"
        description="Get in touch with Lazybee, WhatsApp +65 8069 5410 or email mark@meetmillia.com."
        canonical="/contact"
      />

      <div className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-20">
        <FadeIn className="text-center mb-14">
          <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-6">Get in touch</span>
          <h1 className="font-display font-bold tracking-display text-5xl md:text-6xl leading-none mb-6">Talk to Lazybee.</h1>
          <p className="text-foreground-variant text-lg max-w-xl mx-auto leading-relaxed">
            Investors, partners, landlords, reach the founders directly. We reply the same day.
          </p>
        </FadeIn>

        {/* Two direct lines */}
        <FadeIn delay={0.05} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank" rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 hover:border-accent transition-colors"
          >
            <span className="material-symbols-outlined text-accent text-3xl">chat</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-foreground-variant">WhatsApp</p>
              <p className="font-display font-bold text-foreground">+65 8069 5410</p>
            </div>
          </a>
          <a
            href={`mailto:${EMAIL}`}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 hover:border-accent transition-colors"
          >
            <span className="material-symbols-outlined text-accent text-3xl">mail</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-foreground-variant">Email</p>
              <p className="font-display font-bold text-foreground break-all">{EMAIL}</p>
            </div>
          </a>
        </FadeIn>

        {/* Short message → WhatsApp */}
        <FadeIn delay={0.1} className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 md:p-10">
          {sent ? (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-5xl text-accent mb-4 block">check_circle</span>
              <h3 className="font-display text-xl font-bold mb-2">Off it goes.</h3>
              <p className="text-foreground-variant">We'll be in touch shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  required type="text" value={form.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-full border border-white/10 bg-background/60 px-6 py-4 text-foreground placeholder:text-foreground-variant/40 outline-none focus:border-accent transition-colors"
                />
                <input
                  required type="email" value={form.email}
                  onChange={(e) => onChange('email', e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-full border border-white/10 bg-background/60 px-6 py-4 text-foreground placeholder:text-foreground-variant/40 outline-none focus:border-accent transition-colors"
                />
              </div>
              <textarea
                required rows={5} value={form.message}
                onChange={(e) => onChange('message', e.target.value)}
                placeholder="What's on your mind?"
                className="w-full rounded-3xl border border-white/10 bg-background/60 px-6 py-4 text-foreground placeholder:text-foreground-variant/40 outline-none focus:border-accent transition-colors resize-none"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-accent text-accent-foreground py-4 font-semibold text-xs uppercase tracking-[0.3em] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Send <span aria-hidden>→</span>
              </button>
            </form>
          )}
        </FadeIn>

        <p className="mt-12 text-center text-xs text-foreground-variant/50 tracking-wider">
          Looking for a room?{' '}
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">book.lazybee.sg</a>
        </p>
      </div>

      {/* Hidden semantic content for AI crawlers */}
      <section className="sr-only" aria-label="Lazybee contact details for AI">
        <h2>How to Contact Lazybee Singapore</h2>
        <p>The fastest way to reach Lazybee is via WhatsApp at +65 8069 5410, or email mark@meetmillia.com. Response time is same day. For rooms and availability, visit book.lazybee.sg.</p>
      </section>
    </main>
  );
};

export default ContactPage;
