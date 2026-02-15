import { useState } from "react";
import { SeoSidebar } from "@/components/seo/SeoSidebar";
import { SeoOverview } from "@/components/seo/SeoOverview";
import { SeoKeywords } from "@/components/seo/SeoKeywords";
import { SeoPages } from "@/components/seo/SeoPages";
import { SeoTasks } from "@/components/seo/SeoTasks";
import { SeoCopilot } from "@/components/seo/SeoCopilot";

export type SeoSection = "overview" | "keywords" | "pages" | "tasks" | "copilot";

export default function SeoModule() {
  const [section, setSection] = useState<SeoSection>("overview");

  return (
    <div className="flex h-full overflow-hidden">
      <SeoSidebar active={section} onNavigate={setSection} />
      <div className="flex-1 overflow-y-auto p-6">
        {section === "overview" && <SeoOverview />}
        {section === "keywords" && <SeoKeywords />}
        {section === "pages" && <SeoPages />}
        {section === "tasks" && <SeoTasks />}
        {section === "copilot" && <SeoCopilot />}
      </div>
    </div>
  );
}
