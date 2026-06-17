/**
 * Example: drop-in usage of generateAdImage in any Edge Function / Node server.
 *
 * Deno (Supabase Edge Function):
 *   import { generateAdImage } from "../../src/lib/imageGenRecipe/generateAdImage.ts";
 *
 * Node (Next.js route, Express, etc.):
 *   import { generateAdImage } from "@/lib/imageGenRecipe/generateAdImage";
 */

import { generateAdImage } from "../src/lib/imageGenRecipe/generateAdImage";

async function main() {
  const result = await generateAdImage({
    prompt: "wire mesh for foundation slab",
    aspectRatio: "9:16",
    brandContext: {
      business_name: "REBAR.SHOP",
      tagline: "Trusted Quality",
      value_prop: "Call 647-260-9403",
      description: "Ontario's fast cut-and-bend rebar supplier.",
    },
    logoUrl: "https://your-cdn.example.com/logo.png",
    resourceImages: [
      "https://your-cdn.example.com/product-1.jpg",
      "https://your-cdn.example.com/product-2.jpg",
    ],
    lovableApiKey: process.env.LOVABLE_API_KEY!, // Deno: Deno.env.get("LOVABLE_API_KEY")!
    pexelsApiKey: process.env.PEXELS_API_KEY,    // optional but strongly recommended
  });

  console.log("Generated:", result.imageUrl.slice(0, 80) + "…");
}

main().catch(console.error);
