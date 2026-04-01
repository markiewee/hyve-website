import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useViewings } from "../../hooks/useViewings";

const SOURCE_OPTIONS = [
  "Roomies",
  "Carousell",
  "Airbnb",
  "Facebook",
  "Friend/Referral",
  "Google",
  "Other",
];

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDFW2cVbsvrWWJOpM1oY_6y4QSF9AdTVA2mQjykHHfqm_7FyWVzVhBNcD29yz_HahiJNmRhT26vtpfe8yEEkfbhqLXoqEW05w7gClciP9c7KUxCvqonJ2cNaPwEugPz5cdNdm_BJ9fwixiXi3W16mMOR8bhFb7xg8oqHCi8CjzQbtVRzDOkohGUoe7QUGecIFqzSoI_CmkO5nbaVojyCHLkU2K0XLrroP_bPuhlJHSilwsNJKLB6YJTlHehvGRrEwRVHtxfPfrJ88E";

/**
 * Resolve a property by slug — tries exact `code` match first,
 * then falls back to ILIKE on `name` for full-slug URLs.
 */
async function fetchProperty(slug) {
  // Try code match (IH, TG, CP)
  const { data: byCode } = await supabase
    .from("properties")
    .select("*")
    .eq("code", slug.toUpperCase())
    .single();

  if (byCode) return byCode;

  // Fallback: ILIKE on name
  const { data: byName } = await supabase
    .from("properties")
    .select("*")
    .ilike("name", `%${slug.replace(/-/g, " ")}%`)
    .single();

  return byName || null;
}

async function fetchRoom(slug) {
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("unit_code", slug)
    .single();

  return data || null;
}

export default function ScheduleViewingPage() {
  const { propertySlug, roomSlug } = useParams();
  const { createViewing } = useViewings();

  // Data loading
  const [property, setProperty] = useState(null);
  const [room, setRoom] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [source, setSource] = useState("Roomies");
  const [specialNotes, setSpecialNotes] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [pollToken, setPollToken] = useState(null);

  // Fetch property (and optionally room) on mount
  useEffect(() => {
    async function load() {
      setPageLoading(true);
      setPageError(null);

      try {
        const prop = await fetchProperty(propertySlug);
        if (!prop) {
          setPageError("Property not found.");
          setPageLoading(false);
          return;
        }
        setProperty(prop);

        if (roomSlug) {
          const rm = await fetchRoom(roomSlug);
          if (rm) setRoom(rm);
        }
      } catch (err) {
        console.error("Error loading schedule page:", err);
        setPageError("Something went wrong loading this page.");
      }

      setPageLoading(false);
    }

    load();
  }, [propertySlug, roomSlug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      prospect_name: fullName.trim(),
      prospect_email: email.trim(),
      prospect_whatsapp: `+65${whatsapp.replace(/\s/g, "")}`,
      property_id: property.id,
      room_id: room?.id || null,
      preferred_move_in: moveInDate || null,
      source,
      special_notes: specialNotes.trim() || null,
    };

    const result = await createViewing(payload);

    if (result.error) {
      setSubmitError(
        result.error.message || "Failed to submit. Please try again."
      );
      setSubmitting(false);
      return;
    }

    // Extract prospect poll token
    const poll = result.data?.viewing_polls?.[0];
    if (poll?.prospect_token) {
      setPollToken(poll.prospect_token);
    }

    setSuccess(true);
    setSubmitting(false);
  }

  // --- Loading state ---
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#006b5f] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (pageError) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a] mb-4 block">
            error_outline
          </span>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold mb-2">
            {pageError}
          </h1>
          <p className="text-[#3c4947] text-sm">
            Check the URL and try again, or contact us on WhatsApp.
          </p>
          <a
            href="https://wa.me/6580885410"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-lg font-['Plus_Jakarta_Sans'] font-bold text-sm"
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            Contact Us
          </a>
        </div>
      </div>
    );
  }

  // --- Success state ---
  if (success) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e] flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow overflow-hidden">
          <div className="p-8 text-center">
            {/* Checkmark icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-[#14b8a6] rounded-full flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[#00423b] text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>

            <div className="w-10 h-1 bg-[#14b8a6] mx-auto mb-4" />
            <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#191c1e] mb-2 tracking-tight">
              You're all set!
            </h2>
            <p className="text-[#3c4947] text-sm leading-relaxed mb-8">
              Pick your available times below so we can find the best slot for
              everyone.
            </p>

            {pollToken && (
              <a
                href={`/view/poll/${pollToken}`}
                className="w-full py-4 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#006b5f]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2"
              >
                Pick Your Times
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </a>
            )}
          </div>
        </div>

        {/* Footer Logo */}
        <footer className="mt-12 opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">
            Hyve
          </span>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <a href="/">About</a>
            <a href="/properties">Properties</a>
            <a href="https://wa.me/6580885410">Support</a>
          </div>
        </footer>
      </div>
    );
  }

  // --- Form state ---
  const propertyName = property?.name || "Property";

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter'] text-[#191c1e]">
      {/* Top Nav — minimal Hyve branding, no auth */}
      <header className="bg-white shadow-sm flex justify-between items-center px-6 py-3 w-full border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tighter text-teal-700 font-['Plus_Jakarta_Sans']">
            Hyve
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://wa.me/6580885410"
            className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors"
          >
            help_outline
          </a>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center p-6 md:p-12">
        {/* Content Container */}
        <div className="w-full max-w-lg bg-white rounded-2xl editorial-shadow overflow-hidden">
          {/* Property Hero Banner */}
          <div className="relative aspect-[16/9] w-full">
            <img
              alt={`${propertyName} interior`}
              className="w-full h-full object-cover"
              src={property?.image_url || HERO_IMAGE}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
              <div>
                <span className="inline-block px-3 py-1 mb-2 bg-[#14b8a6] text-[#00423b] text-[10px] font-bold uppercase tracking-wider rounded-full">
                  Available Now
                </span>
                <h1 className="text-white font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tracking-tight">
                  {propertyName}
                </h1>
                {property?.address && (
                  <p className="text-white/80 text-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      location_on
                    </span>
                    {property.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8">
            <div className="mb-8">
              <div className="w-10 h-1 bg-[#14b8a6] mb-4" />
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#191c1e] mb-2 tracking-tight">
                Request a Viewing
              </h2>
              <p className="text-[#3c4947] text-sm leading-relaxed">
                Interested in this room? Leave your details and we'll find a
                time that works for everyone.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Basic Info Group */}
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                    Full Name
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]"
                    placeholder="Sarah Tan"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      Email
                    </label>
                    <input
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]"
                      placeholder="sarah@example.com"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      WhatsApp Number
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center justify-center px-3 bg-[#eceef0] border-none rounded-lg text-sm text-[#3c4947] font-medium">
                        +65
                      </span>
                      <input
                        className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6]"
                        placeholder="8123 4567"
                        type="tel"
                        required
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Context Card (only if room is known from URL) */}
              {room && (
                <div className="pt-4 border-t border-[#e6e8ea]">
                  <div className="bg-[#f2f4f6] rounded-xl p-4 flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-[#006b5f]/10 flex items-center justify-center shrink-0">
                      <span
                        className="material-symbols-outlined text-[#006b5f] text-lg"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        bed
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#191c1e]">
                        {room.name || room.unit_code}
                      </p>
                      <p className="text-xs text-[#3c4947]">
                        {propertyName}
                        {room.price != null && ` \u00b7 $${room.price}/mo`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      Preferred Move-in Date
                    </label>
                    <input
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm text-[#3c4947]"
                      type="date"
                      value={moveInDate}
                      onChange={(e) => setMoveInDate(e.target.value)}
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                      How did you find us?
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm text-[#3c4947]"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="group">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-[#3c4947] mb-1.5 ml-1">
                    Anything else?
                  </label>
                  <textarea
                    className="w-full px-4 py-3 bg-[#e6e8ea] border-none rounded-lg focus:ring-2 focus:ring-[#14b8a6] transition-all text-sm placeholder:text-[#bbcac6] resize-none"
                    placeholder="e.g. I have a pet, I need parking, preferred viewing time..."
                    rows={3}
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Error message */}
              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-[#ffdad6] rounded-lg">
                  <span className="material-symbols-outlined text-[#93000a] text-sm">
                    error
                  </span>
                  <p className="text-sm text-[#93000a] font-medium">
                    {submitError}
                  </p>
                </div>
              )}

              {/* CTA */}
              <button
                className="w-full py-4 bg-[#006b5f] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-wide rounded-lg hover:bg-[#006b5f]/90 active:scale-[0.98] transition-all editorial-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Request a Viewing
                    <span className="material-symbols-outlined text-sm">
                      calendar_month
                    </span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-[#6c7a77] text-balance">
                By submitting, you agree to Hyve's{" "}
                <a
                  className="underline hover:text-[#006b5f]"
                  href="/terms-of-service"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  className="underline hover:text-[#006b5f]"
                  href="/privacy-policy"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </div>
        </div>

        {/* Footer Logo */}
        <footer className="mt-12 opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
          <span className="text-teal-700 font-['Plus_Jakarta_Sans'] font-black text-lg">
            Hyve
          </span>
          <div className="flex gap-4 text-xs font-medium text-slate-500">
            <a href="/">About</a>
            <a href="/properties">Properties</a>
            <a href="https://wa.me/6580885410">Support</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
