import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FolderOpen, FileText, Pencil, Trash2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  company_id: string;
};

type Article = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  is_published: boolean;
  category_id: string | null;
  sort_order: number;
  views: number;
  helpful_yes: number;
  helpful_no: number;
  company_id: string;
};

export function KnowledgeBase() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setCompanyId(data.company_id);
    });
  }, [user]);

  const [view, setView] = useState<"list" | "editor">("list");
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [articleForm, setArticleForm] = useState({ title: "", slug: "", content: "", excerpt: "", category_id: "", is_published: false });

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-categories", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_categories")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!companyId,
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["kb-articles", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      if (error) throw error;
      return data as Article[];
    },
    enabled: !!companyId,
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      const slug = catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("kb_categories").insert({
        company_id: companyId!,
        name: catForm.name,
        slug,
        description: catForm.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-categories"] });
      setCatDialogOpen(false);
      setCatForm({ name: "", description: "" });
      toast.success("Category created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kb_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-categories"] });
      toast.success("Category deleted");
    },
  });

  const saveArticle = useMutation({
    mutationFn: async () => {
      const slug = articleForm.slug || articleForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const payload = {
        company_id: companyId!,
        title: articleForm.title,
        slug,
        content: articleForm.content,
        excerpt: articleForm.excerpt || null,
        category_id: articleForm.category_id || null,
        is_published: articleForm.is_published,
      };
      if (editingArticle) {
        const { error } = await supabase.from("kb_articles").update(payload).eq("id", editingArticle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kb_articles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      setView("list");
      setEditingArticle(null);
      toast.success(editingArticle ? "Article updated" : "Article created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kb_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      toast.success("Article deleted");
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase.from("kb_articles").update({ is_published: published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-articles"] }),
  });

  const openEditor = (article?: Article) => {
    if (article) {
      setEditingArticle(article);
      setArticleForm({
        title: article.title,
        slug: article.slug,
        content: article.content,
        excerpt: article.excerpt || "",
        category_id: article.category_id || "",
        is_published: article.is_published,
      });
    } else {
      setEditingArticle(null);
      setArticleForm({ title: "", slug: "", content: "", excerpt: "", category_id: "", is_published: false });
    }
    setView("editor");
  };

  if (view === "editor") {
    return (
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => setView("list")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold mb-4">{editingArticle ? "Edit Article" : "New Article"}</h2>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={articleForm.title} onChange={(e) => setArticleForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={articleForm.slug} onChange={(e) => setArticleForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated from title" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={articleForm.category_id} onValueChange={(v) => setArticleForm((f) => ({ ...f, category_id: v }))}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Excerpt</Label>
            <Input value={articleForm.excerpt} onChange={(e) => setArticleForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary" />
          </div>
          <div>
            <Label>Content (Markdown)</Label>
            <Textarea rows={16} value={articleForm.content} onChange={(e) => setArticleForm((f) => ({ ...f, content: e.target.value }))} className="font-mono text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={articleForm.is_published} onCheckedChange={(v) => setArticleForm((f) => ({ ...f, is_published: v }))} />
            <Label>Published</Label>
          </div>
          <Button onClick={() => saveArticle.mutate()} disabled={!articleForm.title || saveArticle.isPending}>
            {saveArticle.isPending ? "Saving…" : "Save Article"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Categories */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Category name" value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Description (optional)" value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} />
              <Button onClick={() => createCategory.mutate()} disabled={!catForm.name || createCategory.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Badge key={cat.id} variant="secondary" className="gap-1 py-1 px-3">
            <FolderOpen className="w-3 h-3" />
            {cat.name}
            <button onClick={() => deleteCategory.mutate(cat.id)} className="ml-1 text-destructive hover:text-destructive/80">
              <Trash2 className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
      </div>

      {/* Articles */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Articles ({articles.length})</h2>
        <Button size="sm" onClick={() => openEditor()}><Plus className="w-4 h-4 mr-1" /> Article</Button>
      </div>
      <div className="grid gap-3">
        {articles.map((a) => {
          const cat = categories.find((c) => c.id === a.category_id);
          return (
            <Card key={a.id} className="hover:border-primary/30 transition-colors">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium truncate">{a.title}</CardTitle>
                  {cat && <Badge variant="outline" className="text-xs">{cat.name}</Badge>}
                  {a.is_published ? (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/30">Published</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Draft</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => togglePublish.mutate({ id: a.id, published: !a.is_published })}>
                    {a.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditor(a)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteArticle.mutate(a.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              {a.excerpt && (
                <CardContent className="py-0 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">{a.excerpt}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
        {articles.length === 0 && <p className="text-sm text-muted-foreground">No articles yet. Create one to get started.</p>}
      </div>
    </div>
  );
}
