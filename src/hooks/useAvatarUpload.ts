import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useAvatarUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  /** Upload a single avatar for a profile and update the profile's avatar_url */
  const uploadAvatar = async (profileId: string, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${profileId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
      .eq("id", profileId);

    if (updateError) throw updateError;

    return publicUrl;
  };

  /** Upload a single avatar with UI feedback */
  const uploadSingle = async (profileId: string, file: File) => {
    setUploading(true);
    try {
      await uploadAvatar(profileId, file);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  /**
   * Bulk upload avatars. Files are matched to profiles by filename.
   * e.g. "john_doe.png" matches profile with full_name "John Doe"
   * Returns { matched, unmatched } counts.
   */
  const uploadBulk = async (
    files: File[],
    profiles: { id: string; full_name: string }[]
  ) => {
    setUploading(true);
    let matched = 0;
    let unmatched = 0;

    try {
      for (const file of files) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[_-]/g, " ").trim();
        
        // Try to match by name similarity
        const profile = profiles.find((p) => {
          const profileName = p.full_name.toLowerCase().trim();
          return (
            profileName === baseName ||
            profileName.replace(/\s+/g, "") === baseName.replace(/\s+/g, "") ||
            profileName.split(" ").some((part) => baseName.includes(part) && part.length > 2)
          );
        });

        if (profile) {
          try {
            await uploadAvatar(profile.id, file);
            matched++;
          } catch {
            unmatched++;
          }
        } else {
          unmatched++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({
        title: "Bulk upload complete",
        description: `${matched} matched, ${unmatched} unmatched`,
      });
    } catch (err: any) {
      toast({ title: "Bulk upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }

    return { matched, unmatched };
  };

  return { uploading, uploadSingle, uploadBulk };
}
