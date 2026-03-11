import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Video, Trash2, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { supabase } from "@/integrations/supabase/client";

interface SavedVideo {
  id: string;
  name: string;
  url: string;
  created_at: string;
  size: number;
}

interface VideoLibraryProps {
  onSelectVideo?: (url: string) => void;
}

export function VideoLibrary({ onSelectVideo }: VideoLibraryProps) {
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const data = await invokeEdgeFunction<{ videos: SavedVideo[] }>("generate-video", {
        action: "list-library",
      });
      setVideos(data.videos || []);
    } catch (err: any) {
      console.error("Failed to load video library:", err);
      toast({ title: "Error", description: "Failed to load video library", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async (fileName: string) => {
    setDeleting(fileName);
    try {
      await invokeEdgeFunction("generate-video", {
        action: "delete-library",
        fileId: fileName,
      });
      setVideos((prev) => prev.filter((v) => v.name !== fileName));
      toast({ title: "Deleted", description: "Video removed from library" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select a video file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileName = `${user.id}/${crypto.randomUUID()}.mp4`;
      const { error } = await supabase.storage
        .from("generated-videos")
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (error) throw error;

      toast({ title: "Uploaded", description: "Video added to library" });
      fetchVideos();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {videos.length} saved video{videos.length !== 1 ? "s" : ""}
        </p>
        <label>
          <input type="file" accept="video/*" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" className="gap-1.5" asChild disabled={uploading}>
            <span>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload
            </span>
          </Button>
        </label>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Video className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No saved videos yet. Generate or upload one!
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {videos.map((v) => (
            <div
              key={v.name}
              className="group relative rounded-lg border bg-card overflow-hidden"
            >
              <video
                src={v.url}
                className="w-full aspect-video object-cover"
                muted
                preload="metadata"
                onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                onMouseLeave={(e) => { const el = e.target as HTMLVideoElement; el.pause(); el.currentTime = 0; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-1.5">
                  {onSelectVideo && (
                    <Button
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() => onSelectVideo(v.url)}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Use
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => handleDelete(v.name)}
                    disabled={deleting === v.name}
                  >
                    {deleting === v.name ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="p-1.5">
                <p className="text-[10px] text-muted-foreground truncate">
                  {new Date(v.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
