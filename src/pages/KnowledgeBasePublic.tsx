import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Category = { id: string; name: string; slug: string; description: string | null };
type Article = { id: string; title: string; slug: string; content: string; excerpt: string | null; category_id: string | null; views: number; helpful_yes: number; helpful_no: number };

export default function KnowledgeBasePublic() {
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-public-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("kb_categories").select("id, name, slug, description").eq("is_published", true).order("sort_order");
      return (data || []) as Category[];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["kb-public-articles"],
    queryFn: async () => {
      const { data } = await supabase.from("kb_articles").select("id, title, slug, content, excerpt, category_id, views, helpful_yes, helpful_no").eq("is_published", true).order("sort_order");
      return (data || []) as Article[];
    },
  });

  const filtered = articles.filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.excerpt || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || a.category_id === selectedCategory;
    return matchSearch && matchCat;
  });

  const recordFeedback = async (articleId: string, helpful: boolean) => {
    await supabase.from("kb_articles").update(
      helpful ? { helpful_yes: (selectedArticle?.helpful_yes || 0) + 1 } : { helpful_no: (selectedArticle?.helpful_no || 0) + 1 }
    ).eq("id", articleId);
  };

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to articles
          </Button>
          <h1 className="text-2xl font-bold mb-4">{selectedArticle.title}</h1>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedArticle.content}</ReactMarkdown>
          </div>
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-3">Was this article helpful?</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => recordFeedback(selectedArticle.id, true)}>
                <ThumbsUp className="w-4 h-4 mr-1" /> Yes
              </Button>
              <Button variant="outline" size="sm" onClick={() => recordFeedback(selectedArticle.id, false)}>
                <ThumbsDown className="w-4 h-4 mr-1" /> No
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
          <p className="text-muted-foreground">Find answers to common questions</p>
        </div>

        <div className="relative mb-8 max-w-lg mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search articles…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <Badge variant={!selectedCategory ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedCategory(null)}>All</Badge>
            {categories.map((c) => (
              <Badge key={c.id} variant={selectedCategory === c.id ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedCategory(c.id)}>
                {c.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedArticle(a)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{a.title}</CardTitle>
              </CardHeader>
              {a.excerpt && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.excerpt}</p>
                </CardContent>
              )}
            </Card>
          ))}
          {filtered.length === 0 && <p className="col-span-2 text-center text-sm text-muted-foreground py-8">No articles found.</p>}
        </div>
      </div>
    </div>
  );
}
