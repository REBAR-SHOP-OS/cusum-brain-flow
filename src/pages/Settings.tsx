import { User, Building, Bell, Shield, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const settingsSections = [
  {
    id: "profile",
    name: "Profile",
    icon: User,
    description: "Your personal information",
  },
  {
    id: "company",
    name: "Company",
    icon: Building,
    description: "Organization settings",
  },
  {
    id: "notifications",
    name: "Notifications",
    icon: Bell,
    description: "Email & push preferences",
  },
  {
    id: "security",
    name: "Security",
    icon: Shield,
    description: "Password & 2FA",
  },
];

export default function Settings() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl p-6 space-y-6">
          {/* Quick Settings */}
          <section className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Dark Mode</h3>
                  <p className="text-sm text-muted-foreground">Always on for CUSUM</p>
                </div>
              </div>
              <Switch checked disabled />
            </div>
          </section>

          {/* Settings Sections */}
          <section className="space-y-2">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                className="w-full flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{section.name}</h3>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
              </button>
            ))}
          </section>

          {/* Danger Zone */}
          <section className="p-4 rounded-lg border border-destructive/30">
            <h3 className="font-medium text-destructive mb-2">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              These actions are irreversible. Proceed with caution.
            </p>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
