import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface WorkspaceState {
  /** Currently selected project/work-order ID */
  activeProjectId: string | null;
  activeProjectName: string | null;
  /** Selected warehouse location */
  warehouse: string;
  /** Intelligence panel open state */
  intelligencePanelOpen: boolean;
}

interface WorkspaceContextValue extends WorkspaceState {
  setActiveProject: (id: string | null, name?: string | null) => void;
  setWarehouse: (w: string) => void;
  toggleIntelligencePanel: () => void;
  setIntelligencePanelOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({
    activeProjectId: null,
    activeProjectName: null,
    warehouse: "main",
    intelligencePanelOpen: false,
  });

  const setActiveProject = useCallback((id: string | null, name?: string | null) => {
    setState((s) => ({ ...s, activeProjectId: id, activeProjectName: name ?? null }));
  }, []);

  const setWarehouse = useCallback((warehouse: string) => {
    setState((s) => ({ ...s, warehouse }));
  }, []);

  const toggleIntelligencePanel = useCallback(() => {
    setState((s) => ({ ...s, intelligencePanelOpen: !s.intelligencePanelOpen }));
  }, []);

  const setIntelligencePanelOpen = useCallback((open: boolean) => {
    setState((s) => ({ ...s, intelligencePanelOpen: open }));
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        setActiveProject,
        setWarehouse,
        toggleIntelligencePanel,
        setIntelligencePanelOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
