import { useState } from "react";
import { 
  User, Lock, Tag, CreditCard, Lightbulb, HelpCircle, LogOut, 
  ChevronDown, Camera
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function Settings() {
  const { user, signOut } = useAuth();
  const userEmail = user?.email ?? "";
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: userEmail,
    jobTitle: "",
    helpersLanguage: "en",
    interfaceLanguage: "en",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-xl mx-auto py-8 px-6 space-y-8">
          {/* Profile Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent">
                  {userEmail.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Camera className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{formData.name} {formData.surname}</h2>
            <p className="text-sm text-muted-foreground">{formData.email}</p>
          </div>

          {/* Personal Details */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Personal details</h3>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="bg-secondary/50 border-0 h-12"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Surname</Label>
                <Input
                  value={formData.surname}
                  onChange={(e) => handleInputChange("surname", e.target.value)}
                  className="bg-secondary/50 border-0 h-12"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="bg-secondary/50 border-0 h-12"
                  disabled
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Job title</Label>
                <Input
                  value={formData.jobTitle}
                  onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                  placeholder="Job title"
                  className="bg-secondary/50 border-0 h-12"
                />
              </div>
            </div>
          </section>

          {/* Language */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Language</h3>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Helpers language</Label>
                <Select 
                  value={formData.helpersLanguage} 
                  onValueChange={(value) => handleInputChange("helpersLanguage", value)}
                >
                  <SelectTrigger className="bg-secondary/50 border-0 h-12">
                    <SelectValue />
                  </SelectTrigger>
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
                <Select 
                  value={formData.interfaceLanguage} 
                  onValueChange={(value) => handleInputChange("interfaceLanguage", value)}
                >
                  <SelectTrigger className="bg-secondary/50 border-0 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              <Button variant="outline" size="sm">
                Set up password
              </Button>
            </div>
          </section>

          {/* Billing Details */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Billing details</h3>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium">Plan</p>
                  <p className="text-sm text-muted-foreground">Team Workspace • Annual</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium">Plan</p>
                  <p className="text-sm text-muted-foreground">REBAR SHOP OS Pro • Annual</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Manage billing</p>
                  <p className="text-sm text-muted-foreground">Manage payment method, billing address, and view invoices.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Other */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Other</h3>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">Request a feature</span>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">Help & Support</span>
              </div>
            </div>
          </section>

          {/* Sign Out */}
          <div className="pt-4 pb-8">
            <button 
              onClick={signOut}
              className="flex items-center gap-3 p-4 w-full rounded-xl hover:bg-secondary transition-colors text-destructive"
            >
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
