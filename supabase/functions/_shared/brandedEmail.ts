/**
 * Shared branded HTML email wrapper for all Rebar.shop outgoing emails.
 * Wraps content in a consistent template with logo, header, and footer.
 */

const LOGO_URL = "https://cusum-brain-flow.lovable.app/brand/rebar-logo.png";
const BRAND_COLOR = "#1a1a2e";
const ACCENT_COLOR = "#dc2626";

export interface BrandedEmailOptions {
  /** Main HTML body content */
  bodyHtml: string;
  /** Actor's signature HTML from email_signatures table */
  signatureHtml?: string;
  /** Fallback actor name if no signature configured */
  actorName?: string;
  /** Optional footer text override */
  footerText?: string;
  /** Whether to show the "View record" link */
  recordLink?: string;
}

/**
 * Wraps email body in a branded Rebar.shop HTML template.
 */
export function buildBrandedEmail(options: BrandedEmailOptions): string {
  const {
    bodyHtml,
    signatureHtml,
    actorName,
    footerText = "Rebar.shop ERP — Automated Notification",
    recordLink,
  } = options;

  const signatureBlock = signatureHtml
    ? `<div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">${signatureHtml}</div>`
    : actorName
      ? `<div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;font-size:14px;color:#333;">
          <strong>${actorName}</strong><br/>
          <span style="color:#888;font-size:13px;">Rebar.shop</span>
        </div>`
      : "";

  const viewRecordBlock = recordLink
    ? `<div style="margin-top:16px;">
        <a href="${recordLink}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">View Record →</a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header with Logo -->
  <div style="background:${BRAND_COLOR};padding:20px 32px;text-align:left;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="width:40px;vertical-align:middle;">
          <img src="${LOGO_URL}" alt="Rebar.shop" width="36" height="36" style="display:block;border-radius:6px;" />
        </td>
        <td style="padding-left:12px;vertical-align:middle;">
          <span style="color:#fff;font-size:18px;font-weight:600;letter-spacing:0.3px;">Rebar.shop</span>
        </td>
      </tr>
    </table>
  </div>
  <!-- Body -->
  <div style="padding:24px 32px;font-size:14px;color:#333;line-height:1.7;">
    ${bodyHtml}
    ${viewRecordBlock}
    ${signatureBlock}
  </div>
  <!-- Footer -->
  <div style="padding:14px 32px;background:#f8f9fa;text-align:center;font-size:11px;color:#999;">
    ${footerText}
  </div>
</div>
</body>
</html>`;
}

/**
 * Converts plain text to simple HTML paragraphs.
 */
export function textToHtml(text: string): string {
  return text
    .split("\n")
    .map(line => line.trim())
    .map(line => line ? `<p style="margin:0 0 8px;font-size:14px;color:#333;line-height:1.7;">${escapeHtml(line)}</p>` : "<br/>")
    .join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fetches the actor's email signature from the database.
 * Returns the signature_html or null if not found.
 */
export async function fetchActorSignature(
  serviceClient: any,
  actorId: string
): Promise<string | null> {
  if (!actorId) return null;
  try {
    const { data } = await serviceClient
      .from("email_signatures")
      .select("signature_html")
      .eq("user_id", actorId)
      .maybeSingle();
    return data?.signature_html || null;
  } catch {
    return null;
  }
}
