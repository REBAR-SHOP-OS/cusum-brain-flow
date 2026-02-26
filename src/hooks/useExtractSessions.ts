import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractSession, ExtractRow, ExtractError } from "@/lib/extractService";
import { fetchExtractSessions, fetchExtractRows, fetchExtractErrors } from "@/lib/extractService";

export function useExtractSessions() {
  const [sessions, setSessions] = useState<ExtractSession[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("extract-sessions-changes-" + Math.random().toString(36).slice(2, 8))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "extract_sessions" },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { sessions, loading, refresh };
}

export function useExtractRows(sessionId: string | null) {
  const [rows, setRows] = useState<ExtractRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchExtractRows(sessionId);
      setRows(data);
    } catch (err) {
      console.error("Failed to load rows:", err);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, refresh };
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
