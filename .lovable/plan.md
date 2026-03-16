

# Auto-Generate Caption on Video Upload

## Problem
When "Upload Video" is clicked, the video uploads and saves to the post, but no caption is generated. The user wants an automatic general company caption to be written immediately after video upload.

## Changes

### `src/components/social/PostReviewPanel.tsx`

Modify `handleMediaReady` to detect when `type === "video"` and, after successful upload, automatically trigger the caption regeneration flow (same as the "Regenerate caption" button but automatic):

```typescript
const handleMediaReady = async (tempUrl: string, type: "image" | "video") => {
  if (!post) return;
  setUploading(true);
  try {
    const permanentUrl = await uploadSocialMediaAsset(tempUrl, type);
    updatePost.mutate({ id: post.id, image_url: permanentUrl });
    toast({ title: `${type === "image" ? "Image" : "Video"} attached`, description: "Saved to your post permanently." });

    // Auto-generate general caption for video uploads
    if (type === "video") {
      setRegeneratingCaption(true);
      try {
        const { data, error } = await supabase.functions.invoke("regenerate-post", {
          body: { post_id: post.id, caption_only: true, is_video: true },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        queryClient.invalidateQueries({ queryKey: ["social_posts"] });
        toast({ title: "Caption generated", description: "A general promotional caption was created for your video." });
      } catch (err: any) {
        console.error("Auto caption error:", err);
        // Non-blocking — video is already saved
      } finally {
        setRegeneratingCaption(false);
      }
    }
  } catch (err: any) {
    // existing error handling
  } finally {
    setUploading(false);
  }
};
```

This reuses the existing `regenerate-post` edge function with `is_video: true` which already has the logic to generate a general REBAR.SHOP company caption (implemented in the previous change). No edge function changes needed.

