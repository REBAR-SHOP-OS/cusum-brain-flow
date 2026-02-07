import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function MemberAreaView() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Users className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-black italic text-foreground uppercase">Member Area</h1>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Team profiles, role management, and access control settings.
      </p>
      <Link to="/settings">
        <Button variant="outline" className="mt-2">
          Go to Settings
        </Button>
      </Link>
    </div>
  );
}
