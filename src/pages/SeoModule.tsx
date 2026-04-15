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
      <div style={{ display: category === "traffic" ? "flex" : "none" }} className="shrink-0">
        <SeoSidebar active={section} onNavigate={setSection} />
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <SeoCategoryBar active={category} onSelect={setCategory} />

        {/* Traffic sub-sections — always mounted, toggled via CSS */}
        <div style={{ display: category === "traffic" && section === "overview" ? "block" : "none" }}><SeoOverview /></div>
        <div style={{ display: category === "traffic" && section === "keywords" ? "block" : "none" }}><SeoKeywords /></div>
        <div style={{ display: category === "traffic" && section === "pages" ? "block" : "none" }}><SeoPages /></div>
        <div style={{ display: category === "traffic" && section === "tasks" ? "block" : "none" }}><SeoTasks /></div>
        <div style={{ display: category === "traffic" && section === "links" ? "block" : "none" }}><SeoLinks /></div>
        <div style={{ display: category === "traffic" && section === "copilot" ? "block" : "none" }}><SeoCopilot /></div>

        {/* Category sections — always mounted, toggled via CSS */}
        <div style={{ display: category === "content" ? "block" : "none" }}><SeoContent /></div>
        <div style={{ display: category === "ai-pr" ? "block" : "none" }}><SeoAiPr /></div>
        <div style={{ display: category === "ai-visibility" ? "block" : "none" }}><SeoAiVisibility /></div>
        <div style={{ display: category === "local" ? "block" : "none" }}><SeoLocal /></div>
      </div>
    </div>
  );
}
