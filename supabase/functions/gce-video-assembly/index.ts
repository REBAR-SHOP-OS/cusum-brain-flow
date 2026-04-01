import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * GCE Video Assembly Orchestrator
 *
 * Accepts clip URLs + brand assets, spins up a GCE preemptible VM running
 * FFmpeg to concat, watermark, and encode H.264 MP4, then uploads to GCS.
 *
 * Falls back to returning a "use-browser" signal when GCE credentials
 * are not configured, letting the client stitch locally.
 *
 * Architecture:
 *   Browser → Edge Function (orchestrator) → GCE VM (FFmpeg) → GCS → permanent URL
 */

interface AssemblyRequest {
  clips: { url: string; targetDuration: number }[];
  logoUrl?: string;
  brand: { name: string; tagline?: string; website?: string; primaryColor?: string; bgColor?: string };
  subtitles?: { text: string; startTime: number; endTime: number }[];
  endCard?: boolean;
  audioUrl?: string;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { body } = ctx;
    const typedBody = body as AssemblyRequest;

    if (!typedBody.clips || typedBody.clips.length === 0) {
      return new Response(
        JSON.stringify({ error: "No clips provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gcpProjectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID");
    const gcpServiceKey = Deno.env.get("GOOGLE_CLOUD_SERVICE_KEY");

    // If GCE credentials are not configured, signal browser fallback
    if (!gcpProjectId || !gcpServiceKey) {
      console.log("GCE credentials not configured — signaling browser fallback");
      return new Response(
        JSON.stringify({
          fallback: true,
          reason: "GCE credentials not configured. Using browser-side assembly.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse service account key ──
    let serviceAccount: {
      client_email: string;
      private_key: string;
      token_uri: string;
    };
    try {
      serviceAccount = JSON.parse(gcpServiceKey);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid GOOGLE_CLOUD_SERVICE_KEY JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get OAuth2 access token from service account ──
    const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaim = btoa(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/compute https://www.googleapis.com/auth/devstorage.full_control",
        aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    );

    // Sign JWT with service account private key
    const keyData = serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\n/g, "");
    const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureInput = new TextEncoder().encode(`${jwtHeader}.${jwtClaim}`);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const jwt = `${jwtHeader}.${jwtClaim}.${signatureB64}`;

    const tokenResp = await fetch(
      serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      }
    );

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error("GCP token exchange failed:", errText);
      return new Response(
        JSON.stringify({ fallback: true, reason: "GCP auth failed — using browser fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token } = await tokenResp.json();

    // ── Build FFmpeg startup script ──
    const clipList = body.clips.map((c, i) => `curl -sL "${c.url}" -o /tmp/clip_${i}.mp4`).join("\n");
    const concatList = body.clips.map((_, i) => `file '/tmp/clip_${i}.mp4'`).join("\n");

    let ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i /tmp/concat.txt`;

    // Logo watermark overlay
    if (body.logoUrl) {
      ffmpegCmd += ` -i /tmp/logo.png -filter_complex "[0:v][1:v]overlay=W-w-16:H-h-16:format=auto,format=yuv420p"`;
    } else {
      ffmpegCmd += ` -vf "format=yuv420p"`;
    }

    ffmpegCmd += ` -c:v libx264 -preset fast -crf 23 -movflags +faststart /tmp/output.mp4`;

    const gcsBucket = `${gcpProjectId}-video-assembly`;
    const outputKey = `assembly/${crypto.randomUUID()}.mp4`;

    const startupScript = `#!/bin/bash
set -e
apt-get update -qq && apt-get install -y -qq ffmpeg curl > /dev/null 2>&1

# Download clips
${clipList}
${body.logoUrl ? `curl -sL "${body.logoUrl}" -o /tmp/logo.png` : ""}

# Create concat list
cat > /tmp/concat.txt << 'CONCATEOF'
${concatList}
CONCATEOF

# Run FFmpeg
${ffmpegCmd}

# Upload to GCS
curl -X PUT -H "Authorization: Bearer $(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')" \
  -H "Content-Type: video/mp4" \
  --upload-file /tmp/output.mp4 \
  "https://storage.googleapis.com/upload/storage/v1/b/${gcsBucket}/o?uploadType=media&name=${outputKey}"

# Self-delete the VM
ZONE=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone | awk -F/ '{print $NF}')
INSTANCE=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/name)
gcloud compute instances delete "$INSTANCE" --zone="$ZONE" --quiet
`;

    const zone = "us-central1-a";
    const instanceName = `ffmpeg-assembly-${Date.now()}`;

    // ── Create preemptible GCE VM ──
    const createVmResp = await fetch(
      `https://compute.googleapis.com/compute/v1/projects/${gcpProjectId}/zones/${zone}/instances`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: instanceName,
          machineType: `zones/${zone}/machineTypes/e2-standard-2`,
          scheduling: {
            preemptible: true,
            automaticRestart: false,
          },
          disks: [
            {
              boot: true,
              autoDelete: true,
              initializeParams: {
                sourceImage: "projects/debian-cloud/global/images/family/debian-12",
                diskSizeGb: 30,
              },
            },
          ],
          networkInterfaces: [
            {
              network: "global/networks/default",
              accessConfigs: [{ type: "ONE_TO_ONE_NAT", name: "External NAT" }],
            },
          ],
          serviceAccounts: [
            {
              email: serviceAccount.client_email,
              scopes: [
                "https://www.googleapis.com/auth/devstorage.full_control",
                "https://www.googleapis.com/auth/compute",
              ],
            },
          ],
          metadata: {
            items: [
              { key: "startup-script", value: startupScript },
            ],
          },
        }),
      }
    );

    if (!createVmResp.ok) {
      const errBody = await createVmResp.text();
      console.error("GCE VM creation failed:", errBody);
      return new Response(
        JSON.stringify({ fallback: true, reason: `GCE VM creation failed: ${createVmResp.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vmOp = await createVmResp.json();

    // Return job info for polling
    const publicUrl = `https://storage.googleapis.com/${gcsBucket}/${outputKey}`;

    return new Response(
      JSON.stringify({
        status: "assembling",
        jobId: instanceName,
        operationId: vmOp.name,
        expectedOutputUrl: publicUrl,
        gcsBucket,
        gcsKey: outputKey,
        zone,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "gce-video-assembly", authMode: "required", requireCompany: false, wrapResult: false })
);
