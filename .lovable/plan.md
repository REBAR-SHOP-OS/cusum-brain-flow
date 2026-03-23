

## Fix: Display Cover Image as Video Thumbnail Overlay

### Current Behavior
The cover image is shown as a tiny 20×20px preview below the video with a "Cover Image" label — not as a visual thumbnail overlay.

### Required Behavior
The cover image should overlay the video as a thumbnail preview, mimicking how social media platforms display video thumbnails. The video player should still be accessible underneath.

### Patch (1 file)

**File**: `src/components/social/PostReviewPanel.tsx` (lines 522-532)

Replace the current video + small cover preview with:
- If `cover_image_url` exists: show the cover image as a full-width overlay with a small play icon and a "Remove cover" button. Clicking the overlay reveals the video player.
- If no cover: show the video player as-is (current behavior).

The overlay uses the same container dimensions as the video, with `object-cover` to match social media thumbnail cropping. A small play button icon in the center signals it's a video. A toggle or state (`showVideo`) lets the user click through to the actual video player.

### Implementation Detail

```tsx
// Inside the isVideo branch (lines 523-533):
{isVideo ? (
  <>
    {(post as any).cover_image_url && !showVideoPlayer ? (
      <div className="relative cursor-pointer" onClick={() => setShowVideoPlayer(true)}>
        <img src={(post as any).cover_image_url} alt="Video thumbnail" 
             className="w-full object-cover rounded-lg" style={{ maxHeight: '400px' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-0.5" />
          </div>
        </div>
        <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">
          Thumbnail
        </span>
      </div>
    ) : (
      <video src={post.image_url} controls className="w-full rounded-lg" style={{ maxHeight: '400px' }} />
    )}
  </>
) : ( ... )}
```

Add `showVideoPlayer` state (resets when post changes):
```tsx
const [showVideoPlayer, setShowVideoPlayer] = useState(false);
// Reset when post changes
useEffect(() => { setShowVideoPlayer(false); }, [post.id]);
```

### Files Changed

| File | Change | Category |
|---|---|---|
| `src/components/social/PostReviewPanel.tsx` | Replace small cover preview with thumbnail overlay on video | Safe replacement |

### Unchanged
- Cover upload logic (stays as-is)
- Publishing pipeline (cover_image_url still passed to Instagram API)
- Calendar cards, video badge
- No schema or route changes

