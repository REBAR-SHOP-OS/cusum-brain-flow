let container: HTMLElement | null = null;

// Register EARLY on document capture phase — must fire before Radix DismissableLayer
document.addEventListener("pointerdown", (e) => {
  const target = e.target as HTMLElement;
  if (target?.closest?.("[data-feedback-btn]")) {
    e.stopImmediatePropagation();
  }
}, true);

export function getFloatingPortalContainer(): HTMLElement {
  if (container && document.body.contains(container)) {
    // Ensure it's always the last child
    if (container !== document.body.lastElementChild) {
      document.body.appendChild(container);
    }
    return container;
  }

  container = document.createElement("div");
  container.id = "floating-layer";
  container.style.cssText =
    "position:fixed;inset:0;z-index:99999;pointer-events:none;";
  document.body.appendChild(container);

  // Prevent Radix UI from detecting pointerdown on floating buttons as "outside click"
  container.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement;
    if (target?.closest?.("[data-feedback-btn]")) {
      e.stopImmediatePropagation();
    }
  }, true);

  // Re-append whenever Radix portals push new elements after us
  const observer = new MutationObserver(() => {
    if (container && container !== document.body.lastElementChild) {
      document.body.appendChild(container);
    }
  });
  observer.observe(document.body, { childList: true });

  return container;
}
