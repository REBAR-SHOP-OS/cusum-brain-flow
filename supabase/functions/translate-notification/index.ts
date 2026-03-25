import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * translate-notification — currently disabled.
 * All notifications are English-only.
 */
Deno.serve((req) =>
  handleRequest(req, async () => {
    return { skipped: "translation disabled" };
  }, { functionName: "translate-notification", requireCompany: false, wrapResult: false })
);
