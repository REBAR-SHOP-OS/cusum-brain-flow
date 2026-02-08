import { useState, useRef } from "react";
import {
  Lock, Tag, CreditCard, Lightbulb, HelpCircle, LogOut,
  Camera, Settings as SettingsIcon, Users, Loader2, GraduationCap,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useTour } from "@/hooks/useTour";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/hooks/useProfiles";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useNavigate } from "react-router-dom";
import brandLogo from "@/assets/brand-logo.png";

type SettingsTab = "settings";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { resetTour, restartTour } = useTour();
  const userEmail = user?.email ?? "";
  const { profiles } = useProfiles();
  const { uploading, uploadSingle } = useAvatarUpload();
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("settings");
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: userEmail,
    jobTitle: "",
    helpersLanguage: "en",
    interfaceLanguage: "en",
  });

  const myProfile = profiles.find((p) => p.user_id === user?.id);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfile) return;
    await uploadSingle(myProfile.id, file);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType; onClick?: () => void }[] = [
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-border bg-card/50 flex flex-col">
        {/* Workspace Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="Rebar.shop"
              className="w-10 h-10 rounded-xl object-contain border border-border"
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Workspace</p>
              <p className="font-semibold text-sm truncate">Rebar.shop</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex flex-col gap-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.onClick ? tab.onClick() : setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                activeTab === tab.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
          {/* People link → Office Member Area */}
          <button
            onClick={() => navigate("/office")}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            <Users className="w-4 h-4" />
            People
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-xl mx-auto py-8 px-6">
          <div className="space-y-8">
            {/* Profile Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-primary/20">
                  <AvatarImage src={myProfile?.avatar_url || ""} />
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent">
                    {userEmail.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-secondary/80 transition-colors"
                >
                  {uploading ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
                </button>
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <h2 className="mt-4 text-xl font-semibold">
                {formData.name} {formData.surname}
              </h2>
              <p className="text-sm text-muted-foreground">{formData.email}</p>
            </div>

              {/* Personal Details */}
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Personal details</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} className="bg-secondary/50 border-0 h-12" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Surname</Label>
                    <Input value={formData.surname} onChange={(e) => handleInputChange("surname", e.target.value)} className="bg-secondary/50 border-0 h-12" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className="bg-secondary/50 border-0 h-12" disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Job title</Label>
                    <Input value={formData.jobTitle} onChange={(e) => handleInputChange("jobTitle", e.target.value)} placeholder="Job title" className="bg-secondary/50 border-0 h-12" />
                  </div>
                </div>
              </section>

              {/* Language */}
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Language</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Helpers language</Label>
                    <Select value={formData.helpersLanguage} onValueChange={(value) => handleInputChange("helpersLanguage", value)}>
                      <SelectTrigger className="bg-secondary/50 border-0 h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Language your helpers speak in chat</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Interface language</Label>
                    <Select value={formData.interfaceLanguage} onValueChange={(value) => handleInputChange("interfaceLanguage", value)}>
                      <SelectTrigger className="bg-secondary/50 border-0 h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Appearance */}
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Appearance</h3>
                <ThemeToggle variant="full" />
              </section>

              {/* Security */}
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Security</h3>
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium">One-time login code</span>
                  </div>
                  <Button variant="outline" size="sm">Set up password</Button>
                </div>
              </section>

              {/* Billing Details */}
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Billing details</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Tag className="w-5 h-5 text-warning" /></div>
                    <div><p className="font-medium">Plan</p><p className="text-sm text-muted-foreground">Team Workspace • Annual</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Tag className="w-5 h-5 text-warning" /></div>
                    <div><p className="font-medium">Plan</p><p className="text-sm text-muted-foreground">REBAR SHOP OS Pro • Annual</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><CreditCard className="w-5 h-5 text-muted-foreground" /></div>
                    <div><p className="font-medium">Manage billing</p><p className="text-sm text-muted-foreground">Manage payment method, billing address, and view invoices.</p></div>
                  </div>
                </div>
              </section>

              {/* Other */}
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Other</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      resetTour();
                      restartTour();
                      navigate("/home");
                    }}
                    className="flex items-center gap-3 p-4 w-full rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Replay Training Tour</p>
                      <p className="text-sm text-muted-foreground">
                        Re-watch the onboarding walkthrough for your role
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Lightbulb className="w-5 h-5 text-primary" /></div>
                    <span className="font-medium">Request a feature</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><HelpCircle className="w-5 h-5 text-primary" /></div>
                    <span className="font-medium">Help & Support</span>
                  </div>
                </div>
              </section>

              {/* Sign Out */}
              <div className="pt-4 pb-8">
                <button onClick={signOut} className="flex items-center gap-3 p-4 w-full rounded-xl hover:bg-secondary transition-colors text-destructive">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><LogOut className="w-5 h-5" /></div>
                  <span className="font-medium">Sign out</span>
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
