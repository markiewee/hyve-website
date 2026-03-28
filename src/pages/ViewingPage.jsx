import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const PROPERTY_INFO = {
  "Thomson Grove 588": {
    address: "588 Yio Chu Kang Road, Singapore 787072",
    mrt: "Bright Hill MRT (TE7)",
    mrtWalk: "7 min walk via Exit B",
    defaultSecurity: "Tell the guard you're visiting Hyve at Block 588",
    defaultSecurityZh: "告诉保安您来参观 Block 588 的 Hyve",
    image: "/properties/thomson-grove.jpg",
  },
  "Chiltern Park 135": {
    address: "135 Serangoon Avenue 3, Singapore 556112",
    mrt: "Serangoon MRT (NE12/CC13)",
    mrtWalk: "10 min walk",
    defaultSecurity: "No security guard — walk straight in through the gate",
    defaultSecurityZh: "没有保安——直接从大门走进去",
    image: "/properties/chiltern-park.jpg",
  },
  "Ivory Heights 122": {
    address: "Blk 122 Jurong East St 13, Singapore 600122",
    mrt: "Jurong East MRT (NS1/EW24)",
    mrtWalk: "8 min walk",
    defaultSecurity: "Tell the guard you're visiting Hyve coliving at Block 122",
    defaultSecurityZh: "告诉保安您来参观 Block 122 的 Hyve",
    image: "/properties/ivory-heights.jpg",
  },
};

const T = {
  en: {
    loading: "Loading...",
    notFound: "Viewing Not Found",
    notFoundDesc: "This viewing link is invalid or has expired.",
    contactUs: "Contact Us",
    pastViewing: "Past Viewing",
    confirmed: "Confirmed Appointment",
    welcome: "Welcome,",
    viewingBrief: "Viewing Brief for",
    scheduledTime: "Scheduled Time",
    scheduled: "Scheduled",
    past: "Past",
    howToGetThere: "How to Get There",
    openMaps: "Open in Google Maps",
    remoteViewing: "Remote Viewing",
    joinVideoTour: "Join Video Tour",
    cantMakeIt: "Can't make it in person? Join the live walkthrough.",
    viewingEnded: "This viewing has ended.",
    joinMeeting: "Join Meeting",
    accessCode: "Secure Access Code",
    accessCodeValid: "Valid only for the duration of your scheduled viewing.",
    whenYouArrive: "When You Arrive",
    securityGate: "Security Gate",
    additionalInfo: "Additional Info",
    needHelp: "Need Help?",
  },
  zh: {
    loading: "加载中...",
    notFound: "未找到预约",
    notFoundDesc: "此预约链接无效或已过期。",
    contactUs: "联系我们",
    pastViewing: "已结束的预约",
    confirmed: "已确认预约",
    welcome: "欢迎，",
    viewingBrief: "预约详情 ·",
    scheduledTime: "预约时间",
    scheduled: "已确认",
    past: "已结束",
    howToGetThere: "如何到达",
    openMaps: "在 Google Maps 中打开",
    remoteViewing: "远程参观",
    joinVideoTour: "加入视频参观",
    cantMakeIt: "无法亲临现场？加入在线直播参观。",
    viewingEnded: "此预约已结束。",
    joinMeeting: "加入会议",
    accessCode: "安全门禁密码",
    accessCodeValid: "仅在预约时间内有效。",
    whenYouArrive: "到达须知",
    securityGate: "门卫",
    additionalInfo: "备注信息",
    needHelp: "需要帮助？",
  },
};

function getCountdown(date, time, lang) {
  if (!date) return null;
  const target = new Date(`${date}T${time || "12:00"}:00+08:00`);
  const now = new Date();
  const diff = target - now;
  if (diff < 0) return "past";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const isZh = lang === "zh";
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return isZh ? `${days} 天后` : `In ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) return isZh ? `${hours}小时${mins}分钟后` : `In ${hours}h ${mins}m`;
  return isZh ? `${mins} 分钟后` : `In ${mins} minutes`;
}

function detectLang() {
  const saved = localStorage.getItem("hyve_lang");
  if (saved) return saved;
  const nav = navigator.language || "";
  return nav.startsWith("zh") ? "zh" : "en";
}

export default function ViewingPage() {
  const { token } = useParams();
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState(detectLang);

  const t = T[lang] || T.en;

  const toggleLang = () => {
    const next = lang === "en" ? "zh" : "en";
    setLang(next);
    localStorage.setItem("hyve_lang", next);
  };

  useEffect(() => {
    if (!token) return;
    supabase
      .from("property_viewings")
      .select("*, properties(name, address)")
      .eq("token", token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError("Viewing not found.");
        else setViewing(data);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="animate-pulse text-[#006b5f] font-['Plus_Jakarta_Sans'] font-bold text-lg">{t.loading}</div>
      </div>
    );
  }

  if (error || !viewing) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6">
        <div className="text-center">
          <img src="/hyve-logo.png" alt="Hyve" className="h-8 mx-auto mb-6" />
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#191c1e] mb-2">{t.notFound}</h1>
          <p className="text-[#3c4947] font-['Inter']">{t.notFoundDesc}</p>
          <a href="https://wa.me/6580885410" className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-lg font-['Inter'] font-semibold text-sm">
            {t.contactUs}
          </a>
        </div>
      </div>
    );
  }

  const propertyName = viewing.properties?.name || "Hyve Property";
  const propInfo = Object.entries(PROPERTY_INFO).find(([k]) => propertyName.includes(k.split(" ")[0]))?.[1] || {};
  const address = viewing.properties?.address || propInfo.address || "";
  const countdown = getCountdown(viewing.viewing_date, viewing.viewing_time, lang);
  const isPast = countdown === "past";
  const securityText = viewing.security_instructions || (lang === "zh" ? propInfo.defaultSecurityZh : propInfo.defaultSecurity) || "";

  const fmtDate = viewing.viewing_date
    ? new Date(viewing.viewing_date + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-SG" : "en-SG", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const fmtTime = viewing.viewing_time
    ? new Date(`2000-01-01T${viewing.viewing_time}`).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  const firstName = (viewing.prospect_name || "").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-['Inter'] text-[#191c1e] antialiased">
      {/* Language Toggle - floating */}
      <button
        onClick={toggleLang}
        className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-md border border-[#bbcac6]/20 px-3 py-1.5 rounded-full shadow-md text-xs font-bold text-[#006b5f] hover:bg-white transition-colors"
      >
        {lang === "en" ? "中文" : "EN"}
      </button>

      {/* Hero */}
      <section className="relative h-[320px] md:h-[420px] w-full overflow-hidden flex items-end">
        <div className="absolute inset-0 z-0">
          {propInfo.image ? (
            <img src={propInfo.image} alt={propertyName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#006b5f] to-[#14b8a6]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#191c1e]/80 via-[#191c1e]/20 to-transparent" />
        </div>
        <div className="relative z-10 p-8 md:p-12 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-[1px] w-12 bg-[#14b8a6]" />
            <span className="font-['Inter'] text-xs uppercase tracking-[0.2em] text-[#71f8e4] font-semibold">
              {isPast ? t.pastViewing : t.confirmed}
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            {t.welcome} {firstName}
          </h1>
          <p className="text-lg text-[#e0e3e5] font-light">
            {t.viewingBrief} <span className="font-semibold text-white">{propertyName}</span>
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Date & Time */}
            <div className="bg-white p-8 md:p-10 rounded-xl shadow-sm border-l-4 border-[#006b5f]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="font-['Inter'] text-[0.65rem] uppercase tracking-widest text-[#565e74] mb-2 block font-bold">{t.scheduledTime}</span>
                  <h2 className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-bold text-[#191c1e]">{fmtDate}</h2>
                  {fmtTime && (
                    <p className="font-['Plus_Jakarta_Sans'] text-xl text-[#006b5f] font-medium mt-1">{fmtTime}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {!isPast && countdown && (
                    <>
                      <span className="bg-[#14b8a6] text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">{t.scheduled}</span>
                      <span className="text-[#565e74] text-sm font-medium">{countdown}</span>
                    </>
                  )}
                  {isPast && (
                    <span className="bg-[#e0e3e5] text-[#3c4947] px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase">{t.past}</span>
                  )}
                </div>
              </div>
            </div>

            {/* How to Get There */}
            <div className="bg-[#f2f4f6] p-8 md:p-10 rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-[#006b5f]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold uppercase tracking-tight">{t.howToGetThere}</h3>
              </div>
              <p className="text-base font-medium text-[#191c1e] mb-6">{address}</p>
              {propInfo.mrt && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-lg mb-6">
                  <div className="bg-[#006b5f]/10 p-3 rounded-lg">
                    <span className="material-symbols-outlined text-[#006b5f]">directions_subway</span>
                  </div>
                  <div>
                    <p className="font-bold text-[#191c1e]">{propInfo.mrt}</p>
                    <p className="text-sm text-[#565e74]">{propInfo.mrtWalk}</p>
                  </div>
                </div>
              )}
              {address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#191c1e] text-white px-8 py-3 rounded-lg font-semibold text-sm shadow-md hover:scale-[1.02] transition-transform"
                >
                  <span className="material-symbols-outlined text-sm">map</span>
                  {t.openMaps}
                </a>
              )}
            </div>

            {/* Video Tour */}
            {viewing.meet_link && (
              <div className="bg-[#191c1e] p-8 md:p-10 rounded-xl text-white">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <span className="font-['Inter'] text-xs uppercase tracking-widest text-[#71f8e4] mb-3 block font-semibold">{t.remoteViewing}</span>
                    <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold mb-2">{t.joinVideoTour}</h3>
                    <p className="text-[#bbcac6] max-w-xs text-sm">
                      {isPast ? t.viewingEnded : t.cantMakeIt}
                    </p>
                  </div>
                  {!isPast && (
                    <a
                      href={viewing.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full md:w-auto text-center bg-[#14b8a6] text-[#00201c] px-10 py-4 rounded-lg font-bold hover:bg-[#71f8e4] transition-colors"
                    >
                      {t.joinMeeting}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Access Code */}
            {viewing.access_code && (
              <div className="bg-[#006b5f] p-8 rounded-xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                <span className="font-['Inter'] text-[10px] uppercase tracking-[0.2em] opacity-80 mb-6 block font-bold">{t.accessCode}</span>
                <div className="bg-white/10 border border-white/20 rounded-xl p-6 mb-4 flex items-center justify-between">
                  <span className="text-4xl md:text-5xl font-['Plus_Jakarta_Sans'] font-black tracking-widest leading-none">{viewing.access_code}</span>
                  <span className="material-symbols-outlined text-3xl opacity-50">key</span>
                </div>
                <p className="text-sm opacity-90 leading-relaxed">{t.accessCodeValid}</p>
              </div>
            )}

            {/* When You Arrive */}
            <div className="bg-[#e6e8ea] p-8 rounded-xl border-l-4 border-[#14b8a6]">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[#006b5f]" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-[#191c1e]">{t.whenYouArrive}</h4>
              </div>
              <div className="space-y-6">
                {securityText && (
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[#006b5f] bg-white" />
                    {viewing.access_code && <div className="absolute left-1.5 top-5 w-[1px] h-10 bg-[#bbcac6]" />}
                    <p className="font-medium text-[#191c1e]">{t.securityGate}</p>
                    <p className="text-sm text-[#565e74] mt-1 italic leading-relaxed">"{securityText}"</p>
                  </div>
                )}
                {viewing.special_notes && (
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[#006b5f] bg-white" />
                    <p className="font-medium text-[#191c1e]">{t.additionalInfo}</p>
                    <div className="mt-3 flex items-start gap-3 bg-[#9b4426]/5 p-4 rounded-lg">
                      <span className="material-symbols-outlined text-[#9b4426] text-[18px] shrink-0 mt-0.5">info</span>
                      <p className="text-sm text-[#3c4947] font-medium">{viewing.special_notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact / WhatsApp */}
            <a
              href="https://wa.me/6580885410"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-6 bg-[#f2f4f6] rounded-xl border border-[#bbcac6]/15 hover:bg-[#e6e8ea] transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 fill-[#25D366]" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.628 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#565e74] uppercase tracking-widest">{t.needHelp}</p>
                  <p className="text-lg font-['Plus_Jakarta_Sans'] font-bold text-[#191c1e]">+65 8088 5410</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#6c7a77] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          </div>
        </div>
      </main>

      {/* Minimal footer */}
      <div className="text-center py-8 text-[#bbcac6] text-xs font-['Inter']">
        © {new Date().getFullYear()} Hyve Living · Makery Pte. Ltd.
      </div>
    </div>
  );
}
