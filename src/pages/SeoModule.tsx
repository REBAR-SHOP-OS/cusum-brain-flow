import { useState } from "react";
import { SeoSidebar } from "@/components/seo/SeoSidebar";
import { SeoCategoryBar } from "@/components/seo/SeoCategoryBar";
import { SeoOverview } from "@/components/seo/SeoOverview";
import { SeoKeywords } from "@/components/seo/SeoKeywords";
import { SeoPages } from "@/components/seo/SeoPages";
import { SeoTasks } from "@/components/seo/SeoTasks";
import { SeoLinks } from "@/components/seo/SeoLinks";
import { SeoCopilot } from "@/components/seo/SeoCopilot";
import { SeoContent } from "@/components/seo/SeoContent";
import { SeoAiPr } from "@/components/seo/SeoAiPr";
import { SeoAiVisibility } from "@/components/seo/SeoAiVisibility";
import { SeoLocal } from "@/components/seo/SeoLocal";

export type SeoCategory = "traffic" | "content" | "ai-pr" | "ai-visibility" | "local";
export type SeoSection = "overview" | "keywords" | "pages" | "tasks" | "links" | "copilot";

export default function SeoModule() {
  const [category, setCategory] = useState<SeoCategory>("traffic");
  const [section, setSection] = useState<SeoSection>("overview");

  return (
    <div className="flex h-full overflow-hidden">
      {/* Only show sidebar for Traffic & Market */}
      {category === "traffic" && (
        <SeoSidebar active={section} onNavigate={setSection} />
      )}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Category cards at the top */}
        <SeoCategoryBar active={category} onSelect={setCategory} />

        {/* Traffic & Market uses the sub-navigation */}
        {category === "traffic" && (
          <>
            {section === "overview" && <SeoOverview />}
            {section === "keywords" && <SeoKeywords />}
            {section === "pages" && <SeoPages />}
            {section === "tasks" && <SeoTasks />}
            {section === "links" && <SeoLinks />}
            {section === "copilot" && <SeoCopilot />}
          </>
        )}

        {category === "content" && <SeoContent />}
        {category === "ai-pr" && <SeoAiPr />}
        {category === "ai-visibility" && <SeoAiVisibility />}
        {category === "local" && <SeoLocal />}
      </div>
    </div>
  );
}
