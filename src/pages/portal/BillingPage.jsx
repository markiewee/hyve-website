import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { useRentPayments } from "../../hooks/useRentPayments";
import PortalLayout from "../../components/portal/PortalLayout";
import InvoiceCard from "../../components/portal/InvoiceCard";
import RentPaymentCard from "../../components/portal/RentPaymentCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function BillingPage() {
  const { profile } = useAuth();
  const roomId = profile?.room_id;
  const profileId = profile?.id;

  const { payments: rentPayments, loading: rentLoading } = useRentPayments(profileId);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    supabase
      .from("ac_monthly_usage")
      .select("*")
      .eq("room_id", roomId)
      .order("month", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching billing history:", error);
        }
        setInvoices(data ?? []);
        setLoading(false);
      });
  }, [roomId]);

  const lateFeePerDay = profile?.late_fee_per_day ?? 5;

  return (
    <PortalLayout>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rent payments and AC usage charges
        </p>
      </div>

      {/* Rent Payments section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Rent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {rentLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b last:border-b-0">
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 bg-gray-100 animate-pulse rounded" />
                    <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
                  </div>
                  <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : rentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rent records yet.</p>
          ) : (
            rentPayments.map((payment) => (
              <RentPaymentCard
                key={payment.id}
                payment={payment}
                lateFeePerDay={lateFeePerDay}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* AC Usage Billing section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AC Usage Billing</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b last:border-b-0">
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 bg-gray-100 animate-pulse rounded" />
                    <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
                  </div>
                  <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No billing history yet.</p>
          ) : (
            invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))
          )}
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
