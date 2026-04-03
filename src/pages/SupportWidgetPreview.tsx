import { useEffect } from "react";
import { buildSupportWidgetScript } from "@/lib/supportWidgetScript";

const previewConfig = {
  brandName: "Support",
  brandColor: "#635bff",
  welcomeMessage:
    "Welcome to REBAR SHOP support. Ask about pricing, delivery, products, or custom fabrication requirements.",
  widgetKey: "preview-widget-key",
};

export default function SupportWidgetPreview() {
  useEffect(() => {
    const script = document.createElement("script");
    script.id = "support-widget-preview-script";
    script.text = buildSupportWidgetScript(
      previewConfig,
      `${window.location.origin}/api/support-widget-preview`
    );
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.getElementById("sw-bubble")?.remove();
      document.getElementById("sw-panel")?.remove();
      document.querySelectorAll("style").forEach((styleEl) => {
        if (styleEl.textContent?.includes("#sw-bubble") && styleEl.textContent.includes("#sw-panel")) {
          styleEl.remove();
        }
      });
      delete (window as Window & { __support_widget_loaded?: boolean }).__support_widget_loaded;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.16),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
            Embedded widget preview
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Real website support widget
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            This page loads the same redesigned embedded support widget shell used by the `support-chat`
            script so the production website experience can be reviewed locally.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
                  Website context
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Product collection page
                </h2>
              </div>
              <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                Preview mode
              </span>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { title: "Express Rebar Fabrication", meta: "65 products" },
                { title: "Rebar Accessories", meta: "9 products" },
                { title: "Rebar Stirrups", meta: "12 products" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white shadow-lg"
                >
                  <div className="h-28 rounded-2xl bg-[linear-gradient(135deg,rgba(99,91,255,0.95),rgba(56,189,248,0.55))]" />
                  <p className="mt-4 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-white/60">{item.meta}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="aspect-square rounded-xl bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)]" />
                  <p className="mt-3 text-sm font-medium text-slate-800">Custom Bend #{idx + 1}</p>
                  <p className="mt-1 text-xs text-slate-500">$10.56</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
              What to validate
            </p>
            <div className="mt-5 space-y-3">
              {[
                "Floating bubble feels prominent and modern.",
                "Header shows live support concierge styling.",
                "Welcome card and prompt chips appear before conversation starts.",
                "Composer matches the new premium visual system.",
                "Conversation state remains clean after sending a message.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
