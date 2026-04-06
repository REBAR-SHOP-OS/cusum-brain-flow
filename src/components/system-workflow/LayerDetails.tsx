import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkflowModuleDetail } from "@/types/workflowDiagram";
import { cn } from "@/lib/utils";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="text-xs font-semibold tracking-wide text-white/90">{title}</div>
      <div className="mt-2 text-xs text-zinc-200/90">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <div className="text-[11px] text-zinc-400">None</div>;
  return (
    <ul className="space-y-1">
      {items.map((x) => (
        <li key={x} className="break-words">
          <span className="text-zinc-200">{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function LayerDetails({ module }: { module: WorkflowModuleDetail }) {
  const statusVariant =
    module.healthStatus === "error"
      ? "destructive"
      : module.healthStatus === "warning"
        ? "secondary"
        : "outline";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-white">{module.name}</div>
          <div className="mt-0.5 text-xs text-zinc-400">{module.description}</div>
        </div>
        <Badge
          variant={statusVariant}
          className={cn(
            "shrink-0 border-white/10 bg-slate-950/70 text-[10px] uppercase tracking-wide",
            module.healthStatus === "healthy" && "text-emerald-200",
            module.healthStatus === "warning" && "text-amber-200",
            module.healthStatus === "error" && "text-rose-200",
          )}
        >
          {module.healthStatus}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2">
          <div className="text-[10px] text-zinc-400">Errors</div>
          <div className="text-sm font-semibold text-white">{module.errorCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2">
          <div className="text-[10px] text-zinc-400">Warnings</div>
          <div className="text-sm font-semibold text-white">{module.warningCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2">
          <div className="text-[10px] text-zinc-400">Updated</div>
          <div className="truncate text-sm font-semibold text-white">{new Date(module.lastUpdatedAt).toLocaleTimeString()}</div>
        </div>
      </div>

      <Tabs defaultValue="io" className="mt-3 min-h-0 flex-1">
        <TabsList className="w-full justify-start bg-slate-950/40">
          <TabsTrigger value="io">IO</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="ops">Ops</TabsTrigger>
        </TabsList>

        <TabsContent value="io" className="min-h-0">
          <ScrollArea className="h-[42vh] pr-2">
            <div className="grid gap-3">
              <Section title="Inputs">
                <List items={module.inputs} />
              </Section>
              <Section title="Outputs">
                <List items={module.outputs} />
              </Section>
              <Section title="Dependencies">
                <List items={module.dependencies} />
              </Section>
              <Section title="Child layers">
                <List items={module.childModuleIds} />
              </Section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="flows" className="min-h-0">
          <ScrollArea className="h-[42vh] pr-2">
            <div className="grid gap-3">
              <Section title="Events">
                <List items={module.events} />
              </Section>
              <Section title="APIs">
                <List items={module.apis} />
              </Section>
              <Section title="Webhooks">
                <List items={module.webhooks} />
              </Section>
              <Section title="Database entities">
                <List items={module.databaseEntities} />
              </Section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ops" className="min-h-0">
          <ScrollArea className="h-[42vh] pr-2">
            <div className="grid gap-3">
              <Section title="Jobs">
                <List items={module.jobs} />
              </Section>
              <Section title="Logs summary">
                <div className="text-[11px] leading-relaxed text-zinc-200/90">{module.logsSummary}</div>
              </Section>
              <Section title="Suggested actions">
                <List items={module.suggestedActions} />
              </Section>
              {module.apiInfo && (
                <Section title="API info">
                  <div className="text-[11px] text-zinc-200/90">
                    {module.apiInfo.baseUrl ? <div>Base: {module.apiInfo.baseUrl}</div> : null}
                    {module.apiInfo.endpoints?.length ? (
                      <ul className="mt-2 space-y-1">
                        {module.apiInfo.endpoints.map((e) => (
                          <li key={`${e.method}-${e.path}`}>
                            <span className="font-semibold text-white/90">{e.method}</span>{" "}
                            <span className="text-white/80">{e.path}</span>
                            {e.notes ? <span className="text-zinc-400"> — {e.notes}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </Section>
              )}
              {module.webhookInfo && (
                <Section title="Webhook info">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="text-zinc-400">Inbound</div>
                      <List items={module.webhookInfo.inbound ?? []} />
                    </div>
                    <div>
                      <div className="text-zinc-400">Outbound</div>
                      <List items={module.webhookInfo.outbound ?? []} />
                    </div>
                  </div>
                </Section>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

