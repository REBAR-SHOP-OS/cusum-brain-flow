// @vitest-environment node
// Regression: Auto Clearance camera completion must finish the DB lifecycle,
// then close the camera. Uploading the required images alone is not enough.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hookSrc = readFileSync(
  resolve(__dirname, "../../../src/hooks/useAutoClearance.ts"),
  "utf8",
);
const modeSrc = readFileSync(
  resolve(__dirname, "../../../src/components/clearance/AutoClearanceMode.tsx"),
  "utf8",
);

describe("Auto Clearance camera completion flow", () => {
  it("persists the clearance storage zone before completion gates run", () => {
    expect(hookSrc).toContain("storage_zone: zone");
    expect(hookSrc).toContain("storage_zone: selectedZone || matchedItem.storage_zone || undefined");
    expect(hookSrc).toContain("storage_zone: selectedZone || match.storage_zone || undefined");
    expect(hookSrc).toContain("storage_zone: selectedZone || item?.storage_zone || undefined");
  });

  it("logs each required diagnostic checkpoint", () => {
    [
      "storage_upload_success",
      "db_image_row_created",
      "required_image_validation_result",
      "completion_mutation_called",
      "completion_mutation_response",
      "clearance_item_refetch_result",
      "completion_refetch_result",
    ].forEach((checkpoint) => expect(hookSrc).toContain(checkpoint));
    expect(modeSrc).toContain("camera_close_callback_fired");
  });

  it("confirms DB rows for image updates and completion mutations", () => {
    expect(hookSrc).toContain("Tag evidence update returned no row");
    expect(hookSrc).toContain("Assisted tag evidence update returned no row");
    expect(hookSrc).toContain("Product evidence update returned no row");
    expect(hookSrc).toContain("Clearance completion update returned no row");
    expect(hookSrc).toMatch(/\.select\("id, status, verification_state, storage_zone"\)\s*\.maybeSingle\(\)/);
  });

  it("does not mark the item completed until after finalizeVerification succeeds", () => {
    const start = hookSrc.indexOf("const handleProductCapture");
    const fn = hookSrc.slice(start, start + 7000);
    const uploadIdx = fn.indexOf("storage_upload_success");
    const finalizeIdx = fn.indexOf("await finalizeVerification");
    const completedIdx = fn.indexOf('setState("completed")');

    expect(uploadIdx).toBeGreaterThan(-1);
    expect(finalizeIdx).toBeGreaterThan(-1);
    expect(completedIdx).toBeGreaterThan(-1);
    expect(uploadIdx).toBeLessThan(finalizeIdx);
    expect(finalizeIdx).toBeLessThan(completedIdx);
  });

  it("closes the camera after confirmed item completion", () => {
    expect(modeSrc).toContain('state !== "completed"');
    expect(modeSrc).toContain("onExit();");
    expect(modeSrc).toContain("window.setTimeout");
  });
});
