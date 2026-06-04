import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const useTourPath = path.join(root, "src/hooks/useTour.ts");

describe("clearance station training tour gate", () => {
  const source = fs.readFileSync(useTourPath, "utf8");

  it("does not auto-start onboarding on the clearance station", () => {
    expect(source).toMatch(/AUTO_TOUR_BLOCKED_PREFIXES/);
    expect(source).toMatch(/"\/shopfloor\/clearance"/);
    expect(source).toMatch(/location\.pathname\.startsWith\(prefix\)/);
  });

  it("keeps manual tour restart available", () => {
    expect(source).toMatch(/const restartTour = useCallback/);
    expect(source).toMatch(/setRun\(true\)/);
  });
});
