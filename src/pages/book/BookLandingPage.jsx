import { Link, useSearchParams } from "react-router-dom";
import { PROPERTY_META } from "./_propertyMeta";

// /book — pick a property to start a viewing booking.
// Mobile-first: cards stack on phone, 3-up on tablet+.
export default function BookLandingPage() {
  const [params] = useSearchParams();
  const src = params.get("src");
  // Forward source attribution to the property page so we keep the chain.
  const srcQuery = src ? `?src=${encodeURIComponent(src)}` : "";

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e]">
      {/* Sticky brand bar — matches existing /view/* pages */}
      <header className="bg-white shadow-sm flex justify-between items-center px-6 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <Link to="/" className="text-xl font-bold tracking-tighter text-teal-700 font-['Plus_Jakarta_Sans']">
          Lazybee
        </Link>
        <a
          href="https://wa.me/6580885410"
          className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors"
          aria-label="Chat with us on WhatsApp"
        >
          help_outline
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
        {/* Hero */}
        <section className="text-center mb-10 sm:mb-14">
          <span className="inline-block px-3 py-1 mb-4 bg-[#14b8a6]/15 text-[#006b5f] text-[10px] font-bold uppercase tracking-wider rounded-full">
            Lazybee Viewings
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-5xl font-extrabold tracking-tight text-[#191c1e] mb-4 text-balance">
            Book a viewing in 30 seconds
          </h1>
          <p className="text-[#3c4947] text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Pick the place you want to see. We&apos;ll show you free slots in
            real time — no back-and-forth.
          </p>
        </section>

        {/* Property cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Object.values(PROPERTY_META).map((prop) => (
            <Link
              key={prop.code}
              to={`/book/${prop.code}${srcQuery}`}
              className="group bg-white rounded-2xl overflow-hidden editorial-shadow border border-slate-100 hover:border-teal-300 hover:-translate-y-0.5 transition-all flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={prop.image}
                  alt={`${prop.name} interior`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  <span
                    className={`${prop.badge.bg} ${prop.badge.text} text-[10px] font-bold px-2 py-1 rounded`}
                  >
                    {prop.code}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#191c1e] mb-1 tracking-tight">
                  {prop.name}
                </h2>
                <p className="text-[#3c4947] text-sm leading-snug mb-4 flex-1">
                  {prop.blurb}
                </p>
                <div className="flex items-center justify-between text-xs text-[#6c7a77] font-medium mb-4">
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">bed</span>
                    {prop.rooms} rooms
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    S${prop.priceFrom}–{prop.priceTo}/mo
                  </span>
                </div>
                <span className="w-full py-3 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm rounded-lg group-hover:bg-[#006b5f]/90 transition-all flex items-center justify-center gap-2">
                  Book a viewing
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </span>
              </div>
            </Link>
          ))}
        </section>

        {/* What to expect */}
        <section className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: "schedule", title: "Pick a slot", body: "Real-time availability — no chasing." },
            { icon: "mark_email_read", title: "Instant confirmation", body: "Email + calendar invite right away." },
            { icon: "key", title: "We meet you there", body: "Door code + captain WhatsApp 2h before." },
          ].map((step) => (
            <div key={step.title} className="px-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#14b8a6]/15 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[#006b5f]">{step.icon}</span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#191c1e] mb-1 tracking-tight">
                {step.title}
              </h3>
              <p className="text-[#3c4947] text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </section>

        <footer className="mt-16 opacity-50 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">Lazybee</span>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <Link to="/">About</Link>
            <Link to="/properties">Properties</Link>
            <a href="https://wa.me/6580885410">Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
