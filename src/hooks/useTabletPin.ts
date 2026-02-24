import { useState, useCallback } from "react";

const PIN_KEY = "pinned-machine-id";

export function useTabletPin() {
  const [pinnedMachineId, setPinnedMachineId] = useState<string | null>(
    () => localStorage.getItem(PIN_KEY)
  );

  const pinMachine = useCallback((id: string) => {
    localStorage.setItem(PIN_KEY, id);
    setPinnedMachineId(id);
  }, []);

  const unpinMachine = useCallback(() => {
    localStorage.removeItem(PIN_KEY);
    setPinnedMachineId(null);
  }, []);

  return { pinnedMachineId, pinMachine, unpinMachine };
}
