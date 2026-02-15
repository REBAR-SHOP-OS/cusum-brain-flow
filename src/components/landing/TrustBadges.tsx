import { Award, ShieldCheck, Star } from "lucide-react";

const BADGES = [
  { name: "Vaughan Chamber of Commerce", icon: <Award className="w-5 h-5 text-primary" /> },
  { name: "CBRB Accredited", icon: <Star className="w-5 h-5 text-primary" /> },
  { name: "BBB Accredited Business", icon: <ShieldCheck className="w-5 h-5 text-primary" /> },
];

export function TrustBadges() {
  return (
    <div className="mt-8 pt-8 border-t border-border">
      <p className="text-sm font-semibold text-foreground text-center mb-4">Memberships &amp; Accreditations</p>
      <div className="flex flex-wrap items-center justify-center gap-6">
        {BADGES.map((b) => (
          <div key={b.name} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
            {b.icon}
            <span className="text-sm font-medium text-foreground">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
