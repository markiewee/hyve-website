import PortalLayout from "../../components/portal/PortalLayout";
import TicketForm from "../../components/portal/TicketForm";

export default function NewIssuePage() {
  return (
    <PortalLayout>
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Report an Issue
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Let us know what needs attention in your room or common areas.
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl p-8 border border-[#bbcac6]/15 shadow-sm">
          <TicketForm />
        </div>
      </div>
    </PortalLayout>
  );
}
