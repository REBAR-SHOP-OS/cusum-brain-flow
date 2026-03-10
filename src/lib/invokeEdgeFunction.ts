import { supabase } from "@/integrations/supabase/client";

/**
 * Bypasses supabase.functions.invoke() which swallows error bodies on non-2xx.
 * Uses raw fetch so we always get the real server error message.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

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
}
