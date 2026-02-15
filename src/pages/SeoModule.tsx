import { useState } from "react";
import { SeoSidebar } from "@/components/seo/SeoSidebar";
import { SeoOverview } from "@/components/seo/SeoOverview";
import { SeoKeywords } from "@/components/seo/SeoKeywords";
import { SeoAudit } from "@/components/seo/SeoAudit";
import { SeoTasks } from "@/components/seo/SeoTasks";

export type SeoSection = "overview" | "keywords" | "audit" | "tasks";

export default function SeoModule() {
  const [section, setSection] = useState<SeoSection>("overview");

  return (
    <div className="flex h-full overflow-hidden">
      <SeoSidebar active={section} onNavigate={setSection} />
      <div className="flex-1 overflow-y-auto p-6">
        {section === "overview" && <SeoOverview />}
        {section === "keywords" && <SeoKeywords />}
        {section === "audit" && <SeoAudit />}
        {section === "tasks" && <SeoTasks />}
      </div>
    </div>
  );
}
