import PortalLayout from "../../components/portal/PortalLayout";
import TicketForm from "../../components/portal/TicketForm";

export default function NewIssuePage() {
  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Report an Issue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Let us know what needs attention in your room.
        </p>
      </div>

      <div className="max-w-lg">
        <TicketForm />
      </div>
    </PortalLayout>
  );
}
