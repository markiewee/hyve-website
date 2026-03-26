import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const STATUS_LABELS = {
  ACTIVE: "Active Tenancy",
  NOTICE_GIVEN: "Notice Period",
  CHECKOUT_PENDING: "Checkout In Progress",
  COMPLETED: "Moved Out",
};

const STATUS_STYLE = {
  ACTIVE: "bg-green-100 text-green-700",
  NOTICE_GIVEN: "bg-yellow-100 text-yellow-700",
  CHECKOUT_PENDING: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

function CheckItem({ label, done }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
          done
            ? "bg-green-500 border-green-500 text-white"
            : "border-gray-300"
        }`}
      >
        {done && "✓"}
      </div>
      <span className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
        {label}
      </span>
    </div>
  );
}

export default function CheckoutStatusCard({ checkout, profile }) {
  if (!checkout) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tenancy Status</CardTitle>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
              Active Tenancy
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your tenancy is active. Contact your house captain or admin to initiate checkout.
          </p>
          {(profile?.check_in_date || profile?.lease_start) && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
              Move-in:{" "}
              <span className="font-medium">
                {new Date(profile.check_in_date || profile.lease_start).toLocaleDateString("en-SG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const isActive = checkout.status === "ACTIVE";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Tenancy Status</CardTitle>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              STATUS_STYLE[checkout.status] || STATUS_STYLE.ACTIVE
            }`}
          >
            {STATUS_LABELS[checkout.status] || checkout.status}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isActive ? (
          <p className="text-sm text-muted-foreground">
            Your tenancy is active. Contact your house captain or admin to initiate checkout.
          </p>
        ) : (
          <div className="space-y-1">
            {checkout.checkout_date && (
              <p className="text-sm mb-2">
                Checkout date:{" "}
                <span className="font-medium">
                  {new Date(checkout.checkout_date).toLocaleDateString("en-SG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </p>
            )}
            <CheckItem label="Notice given" done={checkout.notice_given} />
            <CheckItem label="Keys returned" done={checkout.keys_returned} />
            <CheckItem label="Room inspected" done={checkout.room_inspected} />
            <CheckItem label="Final bill settled" done={checkout.final_bill_settled} />
            <CheckItem label="Deposit returned" done={checkout.deposit_returned} />
            {checkout.notes && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {checkout.notes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
