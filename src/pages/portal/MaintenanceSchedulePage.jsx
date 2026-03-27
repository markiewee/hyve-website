import PortalLayout from "../../components/portal/PortalLayout";
import { useLanguage } from "../../i18n/LanguageContext";

// Default PM schedule template — admin can override via DB later
const DEFAULT_SCHEDULE = [
  {
    id: "ac-service",
    icon: "ac_unit",
    title: "AC Servicing",
    titleZh: "空调保养",
    description: "Professional cleaning and gas top-up for all AC units",
    descriptionZh: "所有空调机组的专业清洗和加气",
    frequency: "Every 3 months",
    frequencyZh: "每3个月",
    color: "#0ea5e9",
    months: [1, 4, 7, 10], // Jan, Apr, Jul, Oct
  },
  {
    id: "pest-control",
    icon: "pest_control",
    title: "Pest Control",
    titleZh: "害虫防治",
    description: "General pest treatment for all common areas and rooms",
    descriptionZh: "所有公共区域和房间的一般害虫处理",
    frequency: "Every 2 months",
    frequencyZh: "每2个月",
    color: "#f59e0b",
    months: [1, 3, 5, 7, 9, 11],
  },
  {
    id: "deep-clean",
    icon: "cleaning_services",
    title: "Deep Cleaning",
    titleZh: "深度清洁",
    description: "Professional deep cleaning of all common areas, kitchen, and bathrooms",
    descriptionZh: "所有公共区域、厨房和浴室的专业深度清洁",
    frequency: "Monthly",
    frequencyZh: "每月",
    color: "#10b981",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    id: "fire-extinguisher",
    icon: "fire_extinguisher",
    title: "Fire Extinguisher Check",
    titleZh: "灭火器检查",
    description: "Inspection and servicing of all fire extinguishers",
    descriptionZh: "所有灭火器的检查和维护",
    frequency: "Every 6 months",
    frequencyZh: "每6个月",
    color: "#ef4444",
    months: [3, 9], // Mar, Sep
  },
  {
    id: "water-heater",
    icon: "water_drop",
    title: "Water Heater Inspection",
    titleZh: "热水器检查",
    description: "Safety inspection and maintenance of all water heaters",
    descriptionZh: "所有热水器的安全检查和维护",
    frequency: "Every 6 months",
    frequencyZh: "每6个月",
    color: "#6366f1",
    months: [2, 8], // Feb, Aug
  },
  {
    id: "plumbing-check",
    icon: "plumbing",
    title: "Plumbing Inspection",
    titleZh: "管道检查",
    description: "Check pipes, drains, and water pressure across all units",
    descriptionZh: "检查所有单元的管道、排水和水压",
    frequency: "Every 6 months",
    frequencyZh: "每6个月",
    color: "#8b5cf6",
    months: [4, 10],
  },
  {
    id: "electrical-audit",
    icon: "bolt",
    title: "Electrical Safety Audit",
    titleZh: "电气安全审计",
    description: "Check circuit breakers, wiring, and outlets for safety compliance",
    descriptionZh: "检查断路器、接线和插座的安全合规性",
    frequency: "Annually",
    frequencyZh: "每年",
    color: "#f97316",
    months: [6], // June
  },
  {
    id: "filter-replacement",
    icon: "air_filter",
    title: "AC Filter Replacement",
    titleZh: "空调滤网更换",
    description: "Replace AC filters in all units for optimal air quality",
    descriptionZh: "更换所有单元的空调滤网以保证最佳空气质量",
    frequency: "Every 6 months",
    frequencyZh: "每6个月",
    color: "#14b8a6",
    months: [1, 7],
  },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_ZH = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export default function MaintenanceSchedulePage() {
  const { lang } = useLanguage();
  const isZh = lang === "zh";
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // Find upcoming maintenance items
  const getNextOccurrence = (item) => {
    const futureMonths = item.months.filter((m) => m >= currentMonth);
    if (futureMonths.length > 0) return { month: futureMonths[0], year: currentYear };
    return { month: item.months[0], year: currentYear + 1 };
  };

  const upcoming = DEFAULT_SCHEDULE
    .map((item) => {
      const next = getNextOccurrence(item);
      const daysUntil = Math.ceil(
        (new Date(next.year, next.month - 1, 15) - now) / (1000 * 60 * 60 * 24)
      );
      return { ...item, next, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const getStatusBadge = (daysUntil) => {
    if (daysUntil <= 0)
      return { text: isZh ? "本月" : "This month", class: "bg-[#006b5f] text-white" };
    if (daysUntil <= 30)
      return { text: isZh ? "即将到来" : "Coming soon", class: "bg-amber-100 text-amber-700" };
    return { text: isZh ? "已安排" : "Scheduled", class: "bg-[#eff4ff] text-[#555f6f]" };
  };

  return (
    <PortalLayout>
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          {isZh ? "维护计划" : "Maintenance Schedule"}
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          {isZh
            ? "我们定期进行预防性维护，确保您的居住体验舒适安全。"
            : "We perform regular preventive maintenance to keep your home comfortable and safe."}
        </p>
      </div>

      {/* Upcoming maintenance */}
      <div className="mb-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#006b5f]">upcoming</span>
          {isZh ? "即将到来的维护" : "Upcoming Maintenance"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcoming.slice(0, 6).map((item) => {
            const badge = getStatusBadge(item.daysUntil);
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-[#bbcac6]/15 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ color: item.color }}>
                      {item.icon}
                    </span>
                  </div>
                  <span className={`text-[10px] font-['Inter'] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${badge.class}`}>
                    {badge.text}
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a] mb-1">
                  {isZh ? item.titleZh : item.title}
                </h3>
                <p className="font-['Manrope'] text-xs text-[#6c7a77] mb-3">
                  {isZh ? item.descriptionZh : item.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-['Inter'] text-xs font-semibold text-[#3c4947]">
                    {isZh ? MONTH_NAMES_ZH[item.next.month - 1] : MONTH_NAMES[item.next.month - 1]} {item.next.year}
                  </span>
                  <span className="font-['Inter'] text-[10px] text-[#6c7a77]">
                    {isZh ? item.frequencyZh : item.frequency}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annual calendar view */}
      <div className="mb-8">
        <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#006b5f]">calendar_month</span>
          {isZh ? `${currentYear}年维护日历` : `${currentYear} Maintenance Calendar`}
        </h2>
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid text-center border-b border-[#bbcac6]/15" style={{ gridTemplateColumns: "minmax(120px, 1.5fr) repeat(12, 1fr)" }}>
            <div className="py-3 px-2 font-['Inter'] text-[10px] font-bold uppercase tracking-widest text-[#6c7a77] border-r border-[#bbcac6]/10">
              {isZh ? "项目" : "Item"}
            </div>
            {(isZh ? MONTH_NAMES_ZH : MONTH_NAMES).map((m, i) => (
              <div
                key={i}
                className={`py-3 px-1 font-['Inter'] text-[10px] font-bold uppercase tracking-wider ${
                  i + 1 === currentMonth
                    ? "bg-[#006b5f] text-white"
                    : "text-[#6c7a77]"
                }`}
              >
                {m}
              </div>
            ))}
          </div>
          {/* Rows */}
          {DEFAULT_SCHEDULE.map((item) => (
            <div key={item.id} className="grid border-b border-[#bbcac6]/10 last:border-b-0" style={{ gridTemplateColumns: "minmax(120px, 1.5fr) repeat(12, 1fr)" }}>
              <div className="py-3 px-3 border-r border-[#bbcac6]/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.color }}>
                  {item.icon}
                </span>
                <span className="font-['Manrope'] text-xs font-semibold text-[#121c2a] truncate">
                  {isZh ? item.titleZh : item.title}
                </span>
              </div>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const isScheduled = item.months.includes(month);
                const isCurrent = month === currentMonth;
                return (
                  <div
                    key={month}
                    className={`py-3 flex items-center justify-center ${
                      isCurrent ? "bg-[#006b5f]/5" : ""
                    }`}
                  >
                    {isScheduled && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${item.color}20` }}
                      >
                        <span
                          className="material-symbols-outlined text-[14px]"
                          style={{ color: item.color, fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-8">
        {DEFAULT_SCHEDULE.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-['Manrope'] text-xs text-[#3c4947]">
              {isZh ? item.titleZh : item.title}
            </span>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="bg-[#eff4ff] rounded-xl p-5 flex items-start gap-3">
        <span className="material-symbols-outlined text-[#006b5f] text-[20px] shrink-0 mt-0.5">info</span>
        <div>
          <p className="font-['Manrope'] text-sm text-[#3c4947]">
            {isZh
              ? "维护通常在工作日上午10点至下午5点之间进行。我们会提前通过门户公告通知您具体日期。如果您需要安排特定时间的维护，请联系管理处。"
              : "Maintenance is typically carried out on weekdays between 10 AM – 5 PM. We'll notify you of exact dates via portal announcements. If you need to schedule maintenance around a specific time, contact management."}
          </p>
        </div>
      </div>
    </PortalLayout>
  );
}
