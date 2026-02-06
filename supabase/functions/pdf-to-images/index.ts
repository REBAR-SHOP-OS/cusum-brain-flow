import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PdfToImagesRequest {
  pdfUrl: string;
  maxPages?: number;
  dpi?: number;
}

// Convert PDF to images using mupdf WASM
async function convertPdfToImages(
  pdfData: Uint8Array,
  maxPages: number = 50,
  dpi: number = 150
): Promise<{ pages: string[]; pageCount: number }> {
  // Import mupdf dynamically
  const mupdf = await import("https://cdn.jsdelivr.net/npm/mupdf@0.3.0/+esm");
  
  // Load the PDF document
  const doc = mupdf.Document.openDocument(pdfData, "application/pdf");
  const pageCount = doc.countPages();
  const pagesToProcess = Math.min(pageCount, maxPages);
  
  console.log(`PDF has ${pageCount} pages, processing ${pagesToProcess}`);
  
  const pages: string[] = [];
  
  for (let i = 0; i < pagesToProcess; i++) {
    try {
      const page = doc.loadPage(i);
      const bounds = page.getBounds();
      
      // Calculate pixel dimensions based on DPI
      const scale = dpi / 72; // PDF standard is 72 DPI
      const width = Math.floor((bounds[2] - bounds[0]) * scale);
      const height = Math.floor((bounds[3] - bounds[1]) * scale);
      
      // Render page to pixmap
      const pixmap = page.toPixmap(
        mupdf.Matrix.scale(scale, scale),
        mupdf.ColorSpace.DeviceRGB,
        false,
        true
      );
      
      // Convert to PNG
      const pngData = pixmap.asPNG();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pngData)));
      pages.push(`data:image/png;base64,${base64}`);
      
      console.log(`Converted page ${i + 1}/${pagesToProcess} (${width}x${height})`);
    } catch (error) {
      console.error(`Error converting page ${i + 1}:`, error);
    }
  }
  
  return { pages, pageCount };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl, maxPages = 50, dpi = 150 }: PdfToImagesRequest = await req.json();

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "pdfUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching PDF from: ${pdfUrl}`);
    
    // Fetch the PDF file
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }
    
    const pdfData = new Uint8Array(await pdfResponse.arrayBuffer());
    console.log(`PDF size: ${pdfData.length} bytes`);
    
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
