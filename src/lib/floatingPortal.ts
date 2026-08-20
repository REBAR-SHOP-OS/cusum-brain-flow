let container: HTMLElement | null = null;

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

  // Re-append whenever Radix portals push new elements after us
  const observer = new MutationObserver(() => {
    if (container && container !== document.body.lastElementChild) {
      document.body.appendChild(container);
    }
  });
  observer.observe(document.body, { childList: true });

  return container;
}
