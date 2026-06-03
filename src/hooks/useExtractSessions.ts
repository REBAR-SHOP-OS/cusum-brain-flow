import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractSession, ExtractRow, ExtractError } from "@/lib/extractService";
import { fetchExtractSessions, fetchExtractRows, fetchExtractErrors } from "@/lib/extractService";
import { useCompanyId } from "@/hooks/useCompanyId";

export function useExtractSessions() {
  const [sessions, setSessions] = useState<ExtractSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { companyId } = useCompanyId();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExtractSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to realtime changes (debounced)
  useEffect(() => {
    const debounceRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    const channel = supabase
      .channel("extract-sessions-changes-" + Math.random().toString(36).slice(2, 8))
      .on(
        "postgres_changes",
        {
          event: "*", schema: "public", table: "extract_sessions",
          ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => refresh(), 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [refresh, companyId]);

  return { sessions, loading, refresh };
}

export function useExtractRows(sessionId: string | null) {
  const [rows, setRows] = useState<ExtractRow[]>([]);
  const [loading, setLoading] = useState(!!sessionId);
  const [hasFetched, setHasFetched] = useState(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the session this hook is currently bound to so async callbacks
  // (initial fetch, retry poll) can't write rows for a session the user
  // already navigated away from, and refresh() can't blank out rows that
  // the background poll just successfully loaded.
  const sessionRef = useRef<string | null>(sessionId);
  const rowsRef = useRef<ExtractRow[]>([]);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setRows([]);
      rowsRef.current = [];
      setHasFetched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchExtractRows(sessionId);
      if (sessionRef.current !== sessionId) return; // stale — user switched session
      console.info(`[useExtractRows] fetched ${data.length} rows`);

      // Never overwrite good rows with an empty result — the extracted rows can
      // arrive via the background poll first, and a follow-up refresh that races
      // an RLS lag would otherwise blank the table and re-trigger "Loading…".
      if (data.length > 0 || rowsRef.current.length === 0) {
        setRows(data);
        rowsRef.current = data;
      }

      // Poll up to 3 times at 2s intervals if 0 rows returned (handles transient RLS / race)
      if (data.length === 0 && rowsRef.current.length === 0 && !retryRef.current) {
        let attempts = 0;
        const poll = async () => {
          if (sessionRef.current !== sessionId) { retryRef.current = null; return; }
          if (attempts >= 3) { retryRef.current = null; return; }
          attempts++;
          try {
            const retryData = await fetchExtractRows(sessionId);
            if (sessionRef.current !== sessionId) { retryRef.current = null; return; }
            console.info(`[useExtractRows] retry fetched ${retryData.length} rows`);
            if (retryData.length > 0) {
              setRows(retryData);
              rowsRef.current = retryData;
              setHasFetched(true);
              setLoading(false);
              retryRef.current = null;
              return;
            }
          } catch (_) { /* best-effort */ }
          retryRef.current = setTimeout(poll, 2000);
        };
        retryRef.current = setTimeout(poll, 2000);
      }
    } catch (err) {
      console.error("[useExtractRows] Failed to load rows:", err);
    }
    setHasFetched(true);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
    return () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [refresh]);

  // Realtime subscription for extract_rows (debounced)
  useEffect(() => {
    if (!sessionId) return;
    const debounceRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    const channel = supabase
      .channel("extract-rows-changes-" + sessionId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "extract_rows",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => refresh(), 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, refresh]);

  return { rows, loading, hasFetched, refresh };
}

export function useExtractErrors(sessionId: string | null) {
  const [errors, setErrors] = useState<ExtractError[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setErrors([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchExtractErrors(sessionId);
      setErrors(data);
    } catch (err) {
      console.error("Failed to load errors:", err);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { errors, loading, refresh };
}
