import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Returns a single-use ElevenLabs Scribe token for real-time transcription.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
serve((req) =>
  handleRequest(req, async ({ log }) => {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");

    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      { method: "POST", headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );

    if (!response.ok) {
      const errText = await response.text();
      log.error("ElevenLabs token error", { status: response.status, errText });
      throw new Error("Failed to get scribe token");
    }

    const { token } = await response.json();
    return { token };
  }, { functionName: "elevenlabs-scribe-token", requireCompany: false, wrapResult: false }),
);
