import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

export default function TenantProfileCard({ profile }) {
  if (!profile) return null;

  const moveInDate = new Date(profile.moved_in_at).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const roleBadge = {
    ADMIN: "bg-purple-100 text-purple-700",
    HOUSE_CAPTAIN: "bg-blue-100 text-blue-700",
    TENANT: "bg-gray-100 text-gray-600",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold">
                {profile.rooms?.unit_code}
              </h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  roleBadge[profile.role] || roleBadge.TENANT
                }`}
              >
                {profile.role}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {profile.rooms?.name} — {profile.properties?.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Move-in: {moveInDate}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
            {profile.rooms?.unit_code?.slice(0, 2)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
