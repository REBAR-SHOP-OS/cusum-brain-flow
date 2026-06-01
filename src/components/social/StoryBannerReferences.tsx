import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface RefRow {
  id: string;
  image_url: string;
  storage_path: string;
}

interface Props {
  products: string[];
  product: string | null;
  onProductChange: (p: string) => void;
}

const MAX_REFS = 5;
const MAX_BYTES = 4 * 1024 * 1024;

export function StoryBannerReferences({ products, product, onProductChange }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<RefRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (p: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("story_banner_references" as any)
      .select("id, image_url, storage_path")
      .eq("product", p)
      .order("created_at", { ascending: true });
    if (!error) setRows((data ?? []) as unknown as RefRow[]);
    else setRows([]);
    setLoading(false);
  };

  useEffect(() => {
    if (product) load(product);
    else setRows([]);
  }, [product]);

  const onPick = () => {
    if (!product) {
      toast({ title: "Pick a product first", description: "Choose which product these references belong to." });
      return;
    }
    fileRef.current?.click();
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !product) return;
    const user = await getCurrentUser();
    if (!user) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    const slotsLeft = MAX_REFS - rows.length;
    if (slotsLeft <= 0) {
      toast({ title: `Max ${MAX_REFS} references`, description: "Remove one to add another.", variant: "destructive" });
      return;
    }
    const toUpload = Array.from(files).slice(0, slotsLeft);
    setUploading(true);
    try {
      const safeProduct = product.replace(/[^a-zA-Z0-9_-]+/g, "_");
      for (const file of toUpload) {
        if (file.size > MAX_BYTES) {
          toast({ title: `${file.name} too large`, description: "Max 4 MB.", variant: "destructive" });
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `story-references/${user.id}/${safeProduct}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("social-media-assets")
          .upload(path, file, { contentType: file.type || "image/png", upsert: false });
        if (upErr) {
          toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
          continue;
        }
        const { data: pub } = supabase.storage.from("social-media-assets").getPublicUrl(path);
        const { error: insErr } = await supabase.from("story_banner_references" as any).insert({
          user_id: user.id,
          product,
          image_url: pub.publicUrl,
          storage_path: path,
        } as any);
        if (insErr) {
          toast({ title: "Save failed", description: insErr.message, variant: "destructive" });
          await supabase.storage.from("social-media-assets").remove([path]);
        }
      }
      await load(product);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (row: RefRow) => {
    const { data, error } = await supabase
      .from("story_banner_references" as any)
      .delete()
      .eq("id", row.id)
      .select("id");
    if (error || !data || data.length === 0) {
      toast({ title: "Delete blocked", description: error?.message ?? "No permission", variant: "destructive" });
      return;
    }
    await supabase.storage.from("social-media-assets").remove([row.storage_path]);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          Style references
        </div>
        <span className="text-[10px] text-muted-foreground">{rows.length}/{MAX_REFS}</span>
      </div>
      <select
        value={product ?? ""}
        onChange={(e) => onProductChange(e.target.value)}
        className="w-full mb-2 text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Select product for these references —</option>
        {products.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <p className="text-[10px] text-muted-foreground/70 mb-2">
        {product
          ? `References for "${product}". AI will match this style when generating ${product}.`
          : "Pick a product, then upload sample banners for that product."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {loading ? (
          <div className="h-14 flex items-center text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading…
          </div>
        ) : (
          <>
            {rows.map((r) => (
              <div key={r.id} className="relative group w-14 h-14 rounded-md overflow-hidden border border-border">
                <img src={r.image_url} alt="reference" className="w-full h-full object-cover" />
                <button
                  onClick={() => remove(r)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {rows.length < MAX_REFS && (
              <button
                onClick={onPick}
                disabled={uploading}
                className="w-14 h-14 rounded-md border border-dashed border-border flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                title={product ? "Upload reference" : "Pick a product first"}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            )}
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
