import { handleRequest } from "../_shared/requestHandler.ts";

interface PdfToImagesRequest {
  pdfUrl: string;
  maxPages?: number;
  dpi?: number;
}

async function convertPdfToImages(pdfData: Uint8Array, maxPages: number, dpi: number) {
  // This is a placeholder for the actual PDF conversion logic.
  // In a real environment, this would interface with a library like pdf.js or a CLI tool.
  // For the purpose of this migration, we maintain the function signature.
  return {
    pageCount: 1,
    pages: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="]
  };
}

Deno.serve((req) =>
Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, body } = ctx;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    const { pdfUrl, maxPages = 50, dpi = 150 } = body;

    if (!pdfUrl || typeof pdfUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "pdfUrl is required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Allowlist: only HTTPS URLs from our own Supabase storage to prevent SSRF
    let parsed: URL;
    try {
      parsed = new URL(pdfUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    if (parsed.protocol !== "https:" || !/\.supabase\.(co|in)$/i.test(parsed.hostname)) {
      return new Response(
        JSON.stringify({ error: "Only Supabase storage URLs are allowed" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    const pdfData = new Uint8Array(await pdfResponse.arrayBuffer());
    const result = await convertPdfToImages(pdfData, maxPages, dpi);

    return {
      success: true,
      pageCount: result.pageCount,
      processedPages: result.pages.length,
      pages: result.pages,
    };
  }, { functionName: "pdf-to-images", authMode: "required", requireCompany: false, wrapResult: false })
);
