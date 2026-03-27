import { useState } from "react";
import { Link } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import { useLanguage } from "../../i18n/LanguageContext";

const SECTIONS = [
  {
    id: "getting-started",
    icon: "rocket_launch",
    title: "Getting Started",
    titleZh: "入门指南",
    items: [
      {
        q: "How do I log in?",
        qZh: "如何登录？",
        a: "Go to hyve.sg/portal/login and enter the username and password given by your property manager. On first login, you'll be asked to set up your email.",
        aZh: "前往 hyve.sg/portal/login，输入物业经理提供的用户名和密码。首次登录时，系统会要求您设置电子邮件。",
      },
      {
        q: "How do I change my password?",
        qZh: "如何更改密码？",
        a: "Go to Settings in the sidebar → scroll to 'Change Password' → enter your new password → click 'Change Password'.",
        aZh: "点击侧边栏的「设置」 → 滚动到「更改密码」 → 输入新密码 → 点击「更改密码」。",
      },
      {
        q: "How do I switch language?",
        qZh: "如何切换语言？",
        a: "Look at the bottom of the sidebar — click 'EN' for English or '中文' for Chinese. Your preference is saved automatically.",
        aZh: "在侧边栏底部点击 'EN'（英文）或 '中文'（中文）。您的偏好会自动保存。",
      },
    ],
  },
  {
    id: "billing",
    icon: "payments",
    title: "Billing & Payments",
    titleZh: "账单和付款",
    items: [
      {
        q: "When is rent due?",
        qZh: "租金什么时候到期？",
        a: "Rent is due on the 1st of each month. Late fees of SGD 5/day apply after the 5th.",
        aZh: "租金在每月1日到期。5日后将产生每天 SGD 5 的滞纳金。",
      },
      {
        q: "How do I pay rent?",
        qZh: "如何支付租金？",
        a: "Option 1: Bank transfer to DBS Bank — Makery Pte Ltd — Account 072-905765-8 (no fee). Option 2: Click 'Pay' on the Billing page to pay via Stripe/card (4% processing fee).",
        aZh: "方式1：银行转账至 DBS Bank — Makery Pte Ltd — 账号 072-905765-8（无手续费）。方式2：在账单页面点击「支付」通过 Stripe/信用卡支付（4% 手续费）。",
      },
      {
        q: "How do I pay other charges (stamping fee, damage, etc.)?",
        qZh: "如何支付其他费用（印花税、损坏费等）？",
        a: "Go to Billing → scroll to 'Other Charges' → click 'Pay' next to the pending charge. You can also download an Invoice before paying and a Receipt after.",
        aZh: "前往账单 → 滚动到「其他费用」 → 点击待付费用旁的「支付」。您可以在付款前下载发票，付款后下载收据。",
      },
    ],
  },
  {
    id: "issues",
    icon: "build",
    title: "Reporting Issues",
    titleZh: 「报告问题」,
    items: [
      {
        q: "How do I report a maintenance issue?",
        qZh: "如何报告维修问题？",
        a: "Go to Issues → Report Issue. First, try the self-diagnostic steps (they may fix it instantly). If not resolved, click 'Submit a ticket' with photos and description.",
        aZh: "前往「问题」 → 「报告问题」。首先尝试自助诊断步骤（可能立即解决）。如果未解决，点击「提交工单」并附上照片和描述。",
      },
      {
        q: "What issue categories are available?",
        qZh: "有哪些问题类别？",
        a: "AC, Plumbing, Electrical, WiFi, Lock/Access, Appliance, Pest, Furniture, Cleaning, and Other. Each has tailored self-help steps.",
        aZh: "空调、水管、电气、WiFi、门锁、家电、害虫、家具、清洁和其他。每个类别都有专门的自助步骤。",
      },
      {
        q: "How long until my issue is resolved?",
        qZh: "问题多久能解决？",
        a: "Urgent issues (no water, power, lock-out): same day. Standard issues: 1-3 working days. You can track status in the Issues page.",
        aZh: "紧急问题（无水、无电、被锁门外）：当天。一般问题：1-3个工作日。您可以在「问题」页面跟踪状态。",
      },
    ],
  },
  {
    id: "documents",
    icon: "folder_open",
    title: "Documents",
    titleZh: 「文件」,
    items: [
      {
        q: "How do I view my licence agreement?",
        qZh: "如何查看我的许可协议？",
        a: "Go to Documents in the sidebar. Your signed Licence Agreement will be listed there. Click to view or download.",
        aZh: "点击侧边栏的「文件」。您签署的许可协议将在此列出。点击查看或下载。",
      },
      {
        q: "How do I upload documents?",
        qZh: "如何上传文件？",
        a: "Go to Documents → select document type (Stamping Certificate, Receipt, ID, etc.) → choose file → Upload. Supported formats: PDF, JPEG, PNG.",
        aZh: "前往「文件」 → 选择文件类型（印花证明、收据、证件等） → 选择文件 → 上传。支持格式：PDF、JPEG、PNG。",
      },
    ],
  },
  {
    id: "living",
    icon: "home",
    title: "House Rules & Living",
    titleZh: "住户规则",
    items: [
      {
        q: "What are the quiet hours?",
        qZh: "安静时间是什么时候？",
        a: "Quiet hours are 10 PM – 8 AM. Please keep noise to a minimum during these hours.",
        aZh: "安静时间为晚上10点至早上8点。请在此期间将噪音降到最低。",
      },
      {
        q: "What's the WiFi password?",
        qZh: "WiFi密码是什么？",
        a: "Network: Hyve WiFi — Password: check the sticker on the router or ask your property manager.",
        aZh: "网络名：Hyve WiFi — 密码：查看路由器上的贴纸或询问物业经理。",
      },
      {
        q: "How much AC is included?",
        qZh: "空调包含多少？",
        a: "300 hours per month. Usage beyond that is charged at SGD 0.30/hour. Check your Dashboard for current usage.",
        aZh: "每月300小时。超出部分按每小时 SGD 0.30 收费。在仪表板查看当前使用情况。",
      },
      {
        q: "Can I have overnight guests?",
        qZh: "可以留宿客人吗？",
        a: "Yes, but please give prior notice to management. Frequent overnight guests may need to be discussed.",
        aZh: "可以，但请提前通知管理处。频繁的留宿客人可能需要另行讨论。",
      },
      {
        q: "How do I move out?",
        qZh: "如何搬出？",
        a: "Give 1 month written notice to management. An inspection will be scheduled. Your deposit is refunded within 14 days after inspection.",
        aZh: "提前1个月书面通知管理处。届时将安排检查。检查后14天内退还押金。",
      },
    ],
  },
];

export default function HelpPage() {
  const { lang } = useLanguage();
  const isZh = lang === "zh";
  const [openSection, setOpenSection] = useState("getting-started");
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <PortalLayout>
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          {isZh ? "帮助中心" : "Help Centre"}
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          {isZh
            ? "查找有关门户、账单、维修和居住的常见问题解答。"
            : "Find answers about the portal, billing, maintenance, and living at Hyve."}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Link
          to="/portal/issues/new"
          className="bg-white rounded-xl p-4 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/40 transition-all text-center group"
        >
          <span className="material-symbols-outlined text-[24px] text-[#006b5f] mb-1 block">support_agent</span>
          <p className="font-['Manrope'] font-bold text-xs text-[#121c2a]">
            {isZh ? "报告问题" : "Report Issue"}
          </p>
        </Link>
        <Link
          to="/portal/billing"
          className="bg-white rounded-xl p-4 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/40 transition-all text-center group"
        >
          <span className="material-symbols-outlined text-[24px] text-[#006b5f] mb-1 block">payments</span>
          <p className="font-['Manrope'] font-bold text-xs text-[#121c2a]">
            {isZh ? "支付账单" : "Pay Bills"}
          </p>
        </Link>
        <Link
          to="/portal/documents"
          className="bg-white rounded-xl p-4 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/40 transition-all text-center group"
        >
          <span className="material-symbols-outlined text-[24px] text-[#006b5f] mb-1 block">folder_open</span>
          <p className="font-['Manrope'] font-bold text-xs text-[#121c2a]">
            {isZh ? "我的文件" : "My Documents"}
          </p>
        </Link>
        <a
          href="https://wa.me/6580885410"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white rounded-xl p-4 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/40 transition-all text-center group"
        >
          <span className="material-symbols-outlined text-[24px] text-[#006b5f] mb-1 block">chat</span>
          <p className="font-['Manrope'] font-bold text-xs text-[#121c2a]">
            {isZh ? "WhatsApp 客服" : "WhatsApp Us"}
          </p>
        </a>
      </div>

      {/* FAQ sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="w-full flex items-center gap-4 px-6 py-5 hover:bg-[#f8f9ff] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#14b8a6]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#006b5f] text-[20px]">{section.icon}</span>
                </div>
                <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] flex-1 text-left">
                  {isZh ? section.titleZh : section.title}
                </span>
                <span
                  className="material-symbols-outlined text-[#6c7a77] text-[20px] transition-transform duration-200"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  expand_more
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#bbcac6]/15 divide-y divide-[#bbcac6]/10">
                  {section.items.map((item, idx) => {
                    const itemKey = `${section.id}-${idx}`;
                    const itemOpen = openItems[itemKey];
                    return (
                      <div key={idx}>
                        <button
                          onClick={() => toggleItem(section.id, idx)}
                          className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[#f8f9ff]/50 transition-colors text-left"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#006b5f] shrink-0">
                            {itemOpen ? "remove" : "add"}
                          </span>
                          <span className="font-['Manrope'] font-semibold text-sm text-[#121c2a]">
                            {isZh ? item.qZh : item.q}
                          </span>
                        </button>
                        {itemOpen && (
                          <div className="px-6 pb-4 pl-[52px]">
                            <p className="font-['Manrope'] text-sm text-[#3c4947] leading-relaxed">
                              {isZh ? item.aZh : item.a}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact footer */}
      <div className="mt-10 bg-[#006b5f]/5 rounded-2xl p-8 text-center">
        <span className="material-symbols-outlined text-[32px] text-[#006b5f] mb-3 block">contact_support</span>
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] mb-2">
          {isZh ? "还有问题？" : "Still need help?"}
        </h3>
        <p className="font-['Manrope'] text-sm text-[#3c4947] mb-4">
          {isZh
            ? "WhatsApp 我们，通常1小时内回复。"
            : "WhatsApp us — we typically reply within 1 hour."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://wa.me/6580885410"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#006b5f] text-white px-6 py-3 rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            WhatsApp +65 8088 5410
          </a>
          <a
            href="mailto:hello@hyve.sg"
            className="inline-flex items-center gap-2 bg-white text-[#006b5f] border border-[#006b5f]/20 px-6 py-3 rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#f8f9ff] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">mail</span>
            hello@hyve.sg
          </a>
        </div>
      </div>
    </PortalLayout>
  );
}
