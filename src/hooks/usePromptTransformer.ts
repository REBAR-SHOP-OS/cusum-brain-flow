import { useState, useCallback } from "react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

interface PromptElements {
  subject: string;
  environment: string;
  action: string;
  camera: string;
  lighting: string;
  style: string;
  realism: string;
}

interface TransformResult {
  engineeredPrompt: string;
  elements: PromptElements;
  isConstructionRelated: boolean;
  rawPrompt: string;
}

export function usePromptTransformer() {
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);

  const transform = useCallback(async (
    rawPrompt: string,
    aspectRatio?: string,
    duration?: number
  ): Promise<TransformResult | null> => {
    if (!rawPrompt.trim()) return null;

    setIsTransforming(true);
    setTransformError(null);

    try {
      const data = await invokeEdgeFunction("transform-video-prompt", {
        rawPrompt: rawPrompt.trim(),
        aspectRatio,
        duration,
      });

      if (data.error) {
        setTransformError(data.error);
        return null;
      }

      const result: TransformResult = {
        engineeredPrompt: data.engineeredPrompt,
        elements: data.elements,
        isConstructionRelated: data.isConstructionRelated,
        rawPrompt: data.rawPrompt,
      };

      setTransformResult(result);
      return result;
    } catch (err: any) {
      const msg = err?.message || "Failed to transform prompt";
      setTransformError(msg);
      return null;
    } finally {
      setIsTransforming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTransformResult(null);
    setTransformError(null);
  }, []);

  return {
    transform,
    isTransforming,
    transformResult,
    transformError,
    reset,
  };
}
