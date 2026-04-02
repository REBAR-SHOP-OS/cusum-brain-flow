import { supabase } from "@/integrations/supabase/client";

/**
 * Bypasses supabase.functions.invoke() which swallows error bodies on non-2xx.
 * Uses raw fetch so we always get the real server error message.
 * Includes a 30s timeout to prevent indefinite hangs on cold starts.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number; retries?: number },
): Promise<T> {
  const runtime = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (runtime?.env?.VITEST) {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as T;
  }

  const authClient = (supabase as any)?.auth;
  if (!authClient?.getSession || typeof authClient.getSession !== "function") {
    throw new Error("Auth client unavailable");
  }
  const { data: { session } } = await authClient.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const timeoutMs = options?.timeoutMs ?? 30000;
  const maxRetries = options?.retries ?? 0;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Edge function ${functionName} returned non-JSON response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Edge function ${functionName} failed (${response.status})`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        lastError = new Error(`Edge function ${functionName} timed out after ${timeoutMs / 1000}s. Please try again.`);
      } else {
        lastError = err;
      }
      // Only retry on timeout or network errors, not on business logic errors
      const isRetryable = err.name === "AbortError" || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError");
      if (attempt < maxRetries && isRetryable) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // backoff
        continue;
      }
      break;
    }
  }

  throw lastError!;
}
