import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async () => {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!publicKey) throw new Error("VAPID_PUBLIC_KEY not set");
    return { publicKey };
  }, { functionName: "get-vapid-public-key", requireCompany: false, wrapResult: false })
);
