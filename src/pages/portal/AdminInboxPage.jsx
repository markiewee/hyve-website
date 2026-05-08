// /portal/admin/inbox — full Action Inbox page.
// Top of the admin nav. Mark lands here every morning to see what's burning.

import PortalLayout from "../../components/portal/PortalLayout";
import PageHeader from "../../components/portal/PageHeader";
import ActionInbox from "../../components/portal/ActionInbox";

export default function AdminInboxPage() {
  return (
    <PortalLayout>
      <PageHeader
        title="Inbox"
        subtitle="Everything that needs admin attention right now — overdue rent, escalated tickets, unstaffed viewings, pending reviews, expiring leases."
      />
      <ActionInbox showHeader={false} compact />
    </PortalLayout>
  );
}
