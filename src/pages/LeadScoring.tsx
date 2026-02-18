import { LeadScoringEngine } from "@/components/crm/LeadScoringEngine";

export default function LeadScoring() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">⚡ Lead Scoring Engine</h1>
      <LeadScoringEngine />
    </div>
  );
}
