import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { optionalAuth, corsHeaders } from "../_shared/auth.ts";

// ... keep existing code (PdfToImagesRequest interface and convertPdfToImages function)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — allow internal edge function calls and authenticated users
    const userId = await optionalAuth(req);
    const isInternalCall = req.headers.get("apikey") === Deno.env.get("SUPABASE_ANON_KEY");
    if (!userId && !isInternalCall) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pdfUrl, maxPages = 50, dpi = 150 }: PdfToImagesRequest = await req.json();

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "pdfUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    
    
    // Fetch the PDF file
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }
    
    const pdfData = new Uint8Array(await pdfResponse.arrayBuffer());
    
    
    // Convert PDF to images
    const result = await convertPdfToImages(pdfData, maxPages, dpi);
    
    return new Response(
      JSON.stringify({
        success: true,
        pageCount: result.pageCount,
        processedPages: result.pages.length,
        pages: result.pages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("PDF conversion error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "PDF conversion failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
