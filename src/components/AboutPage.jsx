import { Link } from 'react-router-dom';
import SEO from './SEO';
import { useLanguage } from '../i18n/LanguageContext';

const AboutPage = () => {
  const { t } = useLanguage();
  const team = [
    {
      name: 'Mark Wee',
      role: 'Co-Founder & CEO',
      bio: 'Visionary leader driving Hyve\'s growth and strategic direction in Singapore\'s coliving market.',
      photo: '/mark.jpeg'
    },
    {
      name: 'Jason Park',
      role: 'Co-Founder & CTO',
      bio: 'Operations-driven co-founder managing technology and resident experience across all Hyve properties.',
      photo: '/jason.jpeg'
    },
    {
      name: 'Matthew Mbarek',
      role: 'Co-Founder',
      bio: 'Innovation-focused co-founder dedicated to creating exceptional community experiences.',
      photo: '/matt.jpeg'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-24">
      <SEO
        title="About Hyve"
        description="Hyve is Singapore's premium co-living brand. Learn about our mission to create urban sanctuaries for modern professionals."
        canonical="/about"
        schema={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Hyve",
          legalName: "Makery Pte. Ltd.",
          url: "https://www.hyve.sg",
          email: "hello@hyve.sg",
          telephone: "+6580885410",
          description: "Singapore's leading co-living operator offering fully furnished rooms from S$950/month across Thomson, Hougang, and Bukit Batok.",
          foundingDate: "2023",
          areaServed: { "@type": "Country", name: "Singapore" },
          sameAs: ["https://www.instagram.com/hyve.sg"]
        }}
      />
      {/* Hero Section */}
      <section className="relative px-6 md:px-8 py-20 lg:py-32 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div className="z-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#71f8e4] text-[#00201c] font-['Inter'] text-xs font-bold uppercase tracking-widest mb-6">
            {t('public.about.badge')}
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tighter text-[#121c2a] leading-[1.1] mb-8">
            Architecting the <span className="text-[#006b5f] italic">future</span> of urban sanctuary.
          </h1>
          <p className="text-[#3c4947] text-lg lg:text-xl leading-relaxed max-w-xl font-['Manrope']">
            We believe living spaces should be more than a residence. Hyve is a movement toward intentional, community-driven living that honors design and connection.
          </p>
        </div>
        <div className="relative">
          <div className="aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl">
            <img
              className="w-full h-full object-cover"
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&h=1200&fit=crop&q=80"
              alt="Modern architectural coliving space"
              loading="lazy"
            />
          </div>
          <div className="absolute -bottom-10 -left-10 hidden lg:block w-64 h-64 bg-[#14b8a6]/20 rounded-3xl backdrop-blur-3xl -z-10 border border-white/20"></div>
        </div>
      </section>

      {/* Company Story */}
      <section className="bg-[#eff4ff] py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <h2 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold tracking-tight text-[#121c2a] mb-6">
                The Hyve Story
              </h2>
              <div className="w-20 h-1.5 bg-[#006b5f] rounded-full mb-8"></div>
            </div>
            <div className="lg:col-span-7 space-y-6 text-[#3c4947] text-lg font-['Manrope'] leading-loose">
              <p>
                Founded in 2023, Hyve was born from a simple observation: young professionals and students in Singapore were seeking connection, not just square footage.
              </p>
              <p>
                Our journey began with a small team sketching a model for living that balanced private sanctuary with vibrant shared ecosystems. Today, we operate 3 properties across Singapore&apos;s most vibrant neighborhoods, housing over 100 residents from 15+ nationalities.
              </p>
              <p>
                Everything is designed to foster connection while respecting personal space. From sun-drenched common areas to private, well-appointed rooms, Hyve isn&apos;t just a place to stay &mdash; it&apos;s a curated lifestyle for the modern professional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 lg:py-32 px-6 md:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold tracking-tight mb-4">Core Pillars</h2>
          <p className="font-['Manrope'] text-[#3c4947]">The foundation of every Hyve residence.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: 'groups',
              title: 'Community',
              description: 'Fostering genuine human connection through curated events and shared experiences that turn neighbors into lifelong collaborators.'
            },
            {
              icon: 'architecture',
              title: 'Design',
              description: 'Thoughtfully designed environments that optimize light, flow, and wellness, creating physical sanctuaries for the soul.'
            },
            {
              icon: 'hub',
              title: 'Technology',
              description: 'A seamless digital layer that handles everything from access control to maintenance requests with absolute precision.'
            }
          ].map((value, index) => (
            <div
              key={index}
              className="bg-white p-10 rounded-[2rem] flex flex-col gap-6 group hover:-translate-y-1 transition-transform duration-300 shadow-[0_20px_40px_rgba(18,28,42,0.06)]"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#14b8a6]/20 flex items-center justify-center text-[#006b5f]">
                <span className="material-symbols-outlined text-3xl">{value.icon}</span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold">{value.title}</h3>
              <p className="text-[#3c4947] leading-relaxed font-['Manrope']">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Leadership */}
      <section className="bg-[#e6eeff] py-24 lg:py-32 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold tracking-tight mb-4">The Team</h2>
            <p className="font-['Manrope'] text-[#3c4947]">Led by visionaries in property and community.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {team.map((member, index) => (
              <div key={index} className="flex flex-col items-center text-center">
                <div className="w-48 h-48 rounded-[2rem] overflow-hidden bg-slate-200 mb-6">
                  {member.photo ? (
                    <img
                      className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                      src={member.photo}
                      alt={member.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-teal-100">
                      <span className="text-3xl font-bold text-teal-600">{member.name.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                  )}
                </div>
                <span className="font-['Inter'] text-xs font-bold text-[#006b5f] uppercase tracking-widest block mb-2">
                  {member.role}
                </span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold mb-4">{member.name}</h3>
                <p className="text-[#3c4947] leading-relaxed font-['Manrope'] max-w-xs">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 md:px-8 bg-[#f8f9ff]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { number: '100+', label: 'Happy Residents' },
            { number: '3', label: 'Properties' },
            { number: '15+', label: 'Nationalities' },
            { number: '4.9', label: 'Average Rating' }
          ].map((stat, index) => (
            <div key={index}>
              <div className="text-4xl font-['Plus_Jakarta_Sans'] font-extrabold text-[#006b5f] mb-2">{stat.number}</div>
              <div className="text-[#3c4947] font-['Manrope']">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32 px-6 md:px-8 max-w-5xl mx-auto text-center">
        <div className="bg-[#006b5f] p-12 lg:p-20 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#14b8a6]/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#006a61]/20 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-3xl lg:text-5xl font-extrabold text-white mb-8 relative z-10">
            Ready to find your sanctuary?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Link
              to="/properties"
              className="bg-white text-[#006b5f] px-10 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-extrabold hover:scale-95 transition-transform duration-200 shadow-lg inline-block"
            >
              {t('public.about.exploreLocations')}
            </Link>
            <a
              href="https://wa.me/6580885410?text=Hi!%20I'm%20interested%20in%20a%20room%20at%20Hyve."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#14b8a6]/20 text-white border border-[#71f8e4]/30 backdrop-blur-md px-10 py-4 rounded-xl font-['Plus_Jakarta_Sans'] font-extrabold hover:bg-[#14b8a6]/30 transition-colors inline-block"
            >
              {t('public.about.contactUs')}
            </a>
          </div>
        </div>
      </section>
      {/* Hidden semantic content for AI crawlers */}
      <section className="sr-only" aria-label="About Hyve detailed summary">
        <h2>About Hyve Co-living Singapore</h2>
        <p>Hyve is operated by Makery Pte. Ltd. and is Singapore&apos;s fastest-growing co-living brand. Founded with the mission to make quality urban living accessible, Hyve manages 19 rooms across 3 properties in Singapore. The brand is known for its all-inclusive pricing model (from S$950/month), zero agent fees, and 3-month minimum lease. Hyve properties are strategically located near MRT stations in Thomson, Hougang, and Bukit Batok, making them ideal for professionals working anywhere in Singapore. Hyve is expanding to Johor Bahru, Malaysia in 2026 with The Pureloft brand.</p>
      </section>
    </div>
  );
};

export default AboutPage;
