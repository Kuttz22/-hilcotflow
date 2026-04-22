import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/taskUtils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Users, Shield, Mail } from "lucide-react";

export default function TeamPage() {
  return (
    <DashboardLayout>
      <TeamContent />
    </DashboardLayout>
  );
}

function TeamContent() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = trpc.users.list.useQuery();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? "Loading..." : `${users?.length ?? 0} member${users?.length !== 1 ? "s" : ""} in your workspace`}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            All Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : users?.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No team members yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users?.map((u) => (
                <div key={u.id} className="px-5 py-4 flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm font-medium bg-accent text-accent-foreground">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.name ?? "Unnamed User"}
                      </p>
                      {u.id === currentUser?.id && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>
                      )}
                      {u.role === "admin" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-primary/30 text-primary">
                          <Shield className="w-2.5 h-2.5" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    {u.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        {u.email}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${u.role === "admin" ? "border-primary/30 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {u.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
