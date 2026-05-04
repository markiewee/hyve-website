import { useNavigate, useLocation } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import ClaimForm from "../../components/portal/ClaimForm";
import { useAuth } from "../../hooks/useAuth";

export default function CaptainClaimFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;
  const propertyName = profile?.properties?.name ?? "";

  const prefillRaw = location.state?.prefill;
  const prefill = prefillRaw
    ? {
        category: prefillRaw.category,
        amount: prefillRaw.amount_sgd,
        description: prefillRaw.description,
      }
    : undefined;

  if (!propertyId) {
    return (
      <PortalLayout>
        <div className="p-4 text-sm text-red-600">
          No property assigned. Contact admin.
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Submit a claim</h1>
        <ClaimForm
          propertyId={propertyId}
          propertyName={propertyName}
          prefill={prefill}
          onSuccess={() => navigate("/portal/captain/claims")}
        />
      </div>
    </PortalLayout>
  );
}
