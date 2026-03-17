import { useCallback, useRef } from "react";

const MAX_HISTORY = 5;

/** Track per-scene prompt history for undo support */
export function usePromptHistory() {
  const historyRef = useRef<Record<string, string[]>>({});

  const push = useCallback((sceneId: string, prompt: string) => {
    if (!historyRef.current[sceneId]) {
      historyRef.current[sceneId] = [];
    }
    const stack = historyRef.current[sceneId];
    // Don't push duplicates
    if (stack[stack.length - 1] === prompt) return;
    stack.push(prompt);
    if (stack.length > MAX_HISTORY) stack.shift();
  }, []);

  const undo = useCallback((sceneId: string): string | null => {
    const stack = historyRef.current[sceneId];
    if (!stack || stack.length < 2) return null;
    stack.pop(); // remove current
    return stack[stack.length - 1] ?? null;
  }, []);

  const canUndo = useCallback((sceneId: string): boolean => {
    return (historyRef.current[sceneId]?.length ?? 0) >= 2;
  }, []);

  return { push, undo, canUndo };
}
