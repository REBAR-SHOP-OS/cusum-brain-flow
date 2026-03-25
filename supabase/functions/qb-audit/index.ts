import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const systemPrompt = `You are a senior forensic accountant AI. Analyze the QuickBooks data provided and return actionable audit findings.

Return ONLY a JSON object with this exact shape:
{
  "findings": [
    {
      "id": "unique-slug",
      "type": "error" | "warning" | "info" | "success",
      "category": "Receivables" | "Payables" | "Cash Flow" | "Data Quality" | "Collections" | "Customers" | "Vendors" | "General",
      "title": "Short title with numbers/amounts",
      "description": "1-2 sentence explanation with specific advice"
    }
  ]
}

Rules:
- Use "error" for critical issues (overdue AR >$5k, possible fraud, duplicates)
- Use "warning" for attention items (aging AP, low collection rate, cash flow risk)
- Use "info" for optimization suggestions (dormant customers, vendor consolidation)
- Use "success" for areas that look healthy
- Always include dollar amounts formatted as $X,XXX.XX
- Always include a summary finding at the top
- Return 5-15 findings ordered by severity
- Be specific: name customers, amounts, dates when available
- Look for: overdue AR/AP, duplicate invoices, cash flow gaps, unusual patterns, collection efficiency, vendor concentration risk, dormant accounts`;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "accounting",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this QuickBooks data:\n\n${JSON.stringify(body, null, 2)}` },
      ],
      temperature: 0.3,
    });

    const raw = result.content;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    return JSON.parse(jsonMatch[1]!.trim());
  }, { functionName: "qb-audit", requireCompany: false, wrapResult: false })
);
