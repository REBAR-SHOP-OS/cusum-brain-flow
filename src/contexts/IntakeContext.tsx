import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

/**
 * IntakeContext — every shop-floor station reads the active "intake" (= one
 * uploaded barlist/manifest). When set, queries filter by intake_id so two
 * intakes for the same customer never bleed into one another.
 *
 * Scope rule (see mem://architecture/intake-pipeline-isolation):
 *   intake_id = barlists.id ; project_id is the parent project.
 */

export interface IntakeOption {
  id: string;            // = barlists.id
  label: string;         // "{barlist name} · rev {n}"
  project_id: string | null;
  project_name: string | null;
  customer_name: string | null;
  created_at: string;
}

interface IntakeContextValue {
  intakeId: string | null;
  projectId: string | null;
  setIntakeId: (id: string | null) => void;
  intakes: IntakeOption[];
  activeIntake: IntakeOption | null;
  loading: boolean;
}

const STORAGE_KEY = "shopfloor.activeIntakeId";

const IntakeContext = createContext<IntakeContextValue | undefined>(undefined);

export function IntakeProvider({ children }: { children: ReactNode }) {
  const { companyId } = useCompanyId();
  const [intakeId, setIntakeIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const setIntakeId = (id: string | null) => {
    setIntakeIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["intake-options", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async (): Promise<IntakeOption[]> => {
      const { data, error } = await supabase
        .from("barlists")
        .select("id, name, revision_no, created_at, project_id, projects(name, customers(name))")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((b: any) => ({
        id: b.id,
        label: b.revision_no ? `${b.name} · rev ${b.revision_no}` : b.name,
        project_id: b.project_id ?? null,
        project_name: b.projects?.name ?? null,
        customer_name: b.projects?.customers?.name ?? null,
        created_at: b.created_at,
      }));
    },
  });

  const intakes = data ?? [];
  const activeIntake = useMemo(
    () => intakes.find((i) => i.id === intakeId) ?? null,
    [intakes, intakeId],
  );

  // Clear stale selection if intake is no longer visible
  useEffect(() => {
    if (intakeId && !isLoading && intakes.length > 0 && !activeIntake) {
      setIntakeId(null);
    }
  }, [intakeId, isLoading, intakes.length, activeIntake]);

  const value: IntakeContextValue = {
    intakeId,
    projectId: activeIntake?.project_id ?? null,
    setIntakeId,
    intakes,
    activeIntake,
    loading: isLoading,
  };

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) {
    // Safe fallback so components used outside the provider still work
    return {
      intakeId: null,
      projectId: null,
      setIntakeId: () => {},
      intakes: [],
      activeIntake: null,
      loading: false,
    };
  }
  return ctx;
}
