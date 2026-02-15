import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  companyId: string;
};

export function KBImportDialog({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapedTitle, setScrapedTitle] = useState("");
  const [scrapedContent, setScrapedContent] = useState("");

  const bulkImport = useMutation({
    mutationFn: async () => {
      const entries = bulkText.split(/\n---\n/).map((e) => e.trim()).filter(Boolean);
      if (entries.length === 0) throw new Error("No entries found");

      const articles = entries.map((entry) => {
        const lines = entry.split("\n");
        const title = lines[0].replace(/^#+\s*/, "").trim();
        const content = lines.slice(1).join("\n").trim();
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        return {
          company_id: companyId,
          title,
          slug,
          content: content || title,
          is_published: true,
        };
      });

      const { error } = await supabase.from("kb_articles").insert(articles);
      if (error) throw error;
      return articles.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      setBulkText("");
      setOpen(false);
      toast.success(`Imported ${count} article(s)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const scrape = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: scrapeUrl },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Scrape failed");

      const markdown = data.data?.markdown || data.markdown || "";
      const title = data.data?.metadata?.title || data.metadata?.title || scrapeUrl;
      setScrapedTitle(title);
      setScrapedContent(markdown);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveScraped = useMutation({
    mutationFn: async () => {
      if (!scrapedTitle || !scrapedContent) throw new Error("No content to save");
      const slug = scrapedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("kb_articles").insert({
        company_id: companyId,
        title: scrapedTitle,
        slug,
        content: scrapedContent,
        is_published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      setScrapeUrl("");
      setScrapedTitle("");
      setScrapedContent("");
      setOpen(false);
      toast.success("Article imported from URL");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="w-4 h-4 mr-1" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Brain Content</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="paste">
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1">Paste Content</TabsTrigger>
            <TabsTrigger value="scrape" className="flex-1">Scrape URL</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Paste content from Brain AI. Separate multiple entries with <code className="bg-muted px-1 rounded">---</code> on its own line. First line of each entry becomes the title.
            </p>
            <Textarea
              rows={14}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`How to place an order\nVisit our website and click "Order Now"...\n---\nReturn Policy\nItems can be returned within 30 days...`}
              className="font-mono text-sm"
            />
            <Button
              onClick={() => bulkImport.mutate()}
              disabled={!bulkText.trim() || bulkImport.isPending}
            >
              {bulkImport.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing…</>
              ) : (
                "Import All"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="scrape" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Enter a URL to scrape its content and create a KB article.
            </p>
            <div className="flex gap-2">
              <Input
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="flex-1"
              />
              <Button
                onClick={() => scrape.mutate()}
                disabled={!scrapeUrl.trim() || scrape.isPending}
                variant="outline"
              >
                {scrape.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Globe className="w-4 h-4 mr-1" /> Fetch</>
                )}
              </Button>
            </div>

            {scrapedContent && (
              <div className="space-y-2 border rounded-md p-3">
                <Input
                  value={scrapedTitle}
                  onChange={(e) => setScrapedTitle(e.target.value)}
                  placeholder="Article title"
                />
                <Textarea
                  rows={10}
                  value={scrapedContent}
                  onChange={(e) => setScrapedContent(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={() => saveScraped.mutate()}
                  disabled={saveScraped.isPending}
                >
                  {saveScraped.isPending ? "Saving…" : "Save as Article"}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
