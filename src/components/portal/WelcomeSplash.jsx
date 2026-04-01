import { useAuth } from "../../hooks/useAuth";
import { usePropertyGuides } from "../../hooks/usePropertyGuides";
import { Button } from "../ui/button";

function GuideCard({ icon, title, content }) {
  return (
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-[#006b5f] text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-2">
            {title}
          </h3>
          <div className="font-['Manrope'] text-sm text-[#555f6f] leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomeSplash({ onContinue }) {
  const { profile } = useAuth();
  const propertyId = profile?.rooms?.property_id ?? profile?.property_id;
  const propertyName = profile?.properties?.name ?? "Hyve";
  const { getSections, getSection, loading } = usePropertyGuides(propertyId);

  const welcomeGuides = getSections("welcome_");
  const houseRulesPreview = "Quiet hours after 10pm. Clean up shared spaces after use. Overnight guests allowed up to 2 nights/week — inform your house captain.";

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#006b5f]/10 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[#006b5f] text-[36px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            celebration
          </span>
        </div>
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#121c2a] mb-2">
          Welcome to {propertyName}!
        </h2>
        <p className="font-['Manrope'] text-sm text-[#555f6f] max-w-md mx-auto leading-relaxed">
          Here's everything you need to know before moving in. Take a moment to review, then we'll get you set up.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {welcomeGuides.map((guide) => (
          <GuideCard
            key={guide.id}
            icon={guide.icon}
            title={guide.title}
            content={guide.content}
          />
        ))}

        <GuideCard
          icon="gavel"
          title="House Rules Preview"
          content={houseRulesPreview}
        />

        {getSection("nearby") && (
          <GuideCard
            icon={getSection("nearby").icon}
            title={getSection("nearby").title}
            content={getSection("nearby").content}
          />
        )}
      </div>

      <div className="text-center pt-4">
        <Button
          onClick={onContinue}
          className="bg-[#006b5f] hover:bg-[#005a50] text-white font-['Manrope'] font-bold px-8 py-3 rounded-xl text-sm"
        >
          <span className="material-symbols-outlined text-[18px] mr-2">arrow_forward</span>
          Let's Get Started
        </Button>
      </div>
    </div>
  );
}
