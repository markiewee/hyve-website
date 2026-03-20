import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import InvoiceCard from "../../components/portal/InvoiceCard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function BillingPage() {
  const { profile } = useAuth();
  const roomId = profile?.room_id;

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

  return (
    <PortalLayout>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          300 free hours per month &mdash; SGD $0.30/hr overage
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing History</CardTitle>
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
