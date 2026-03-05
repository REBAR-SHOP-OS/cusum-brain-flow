import React from "react";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { PixelPostCard, PixelPostData } from "./PixelPostCard";

interface PixelChatRendererProps {
  content: string;
  agentImage: string;
  agentName: string;
  onViewPost?: (post: PixelPostData) => void;
  onRegenerateImage?: (imageUrl: string, alt: string) => void;
  onApprovePost?: (post: PixelPostData) => void;
  onRegeneratePost?: (post: PixelPostData) => void;
}

/** Extract social-images URLs, full caption text, and hashtags from markdown content */
function extractPostData(content: string): { imageUrl: string; caption: string; hashtags: string; persianTranslation: string }[] {
  // Primary: markdown image syntax with social-images bucket
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]*social-images[^\s)]*)\)/g;
  const results: { imageUrl: string; caption: string; hashtags: string; persianTranslation: string }[] = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    results.push({ caption: match[1], imageUrl: match[2], hashtags: "", persianTranslation: "" });
  }

  // Fallback: detect bare social-images URLs not wrapped in markdown image syntax
  if (results.length === 0) {
    const bareUrlRegex = /(https?:\/\/[^\s)<>]*social-images[^\s)<>]*\.(?:png|jpg|jpeg|webp))/g;
    let bareMatch;
    while ((bareMatch = bareUrlRegex.exec(content)) !== null) {
      // Make sure this URL isn't already inside a markdown image tag (check char before)
      const before = content.slice(Math.max(0, bareMatch.index - 2), bareMatch.index);
      if (!before.includes("](")) {
        results.push({ caption: "", imageUrl: bareMatch[1], hashtags: "", persianTranslation: "" });
      }
    }
  }

  if (results.length === 0) return results;

  // Separate Persian translation section
  const persianSeparator = "---PERSIAN---";
  let mainContent = content;
  let persianTranslation = "";
  const persianIdx = content.indexOf(persianSeparator);
  if (persianIdx !== -1) {
    persianTranslation = content.slice(persianIdx + persianSeparator.length).trim();
    mainContent = content.slice(0, persianIdx).trim();
  } else {
    // Fallback: detect Persian markers without separator
    const persianMarkerMatch = content.match(/(🖼️\s*متن روی عکس:[\s\S]*)/);
    if (persianMarkerMatch) {
      persianTranslation = persianMarkerMatch[1].trim();
      mainContent = content.slice(0, persianMarkerMatch.index).trim();
    }
  }

  // Extract hashtags from main content only
  const hashtagMatches = mainContent.match(/#[a-zA-Z]\w*/g);
  const allHashtags = hashtagMatches ? hashtagMatches.join(" ") : "";

  // Build full caption: remove image markdown, bare URLs, download/regen links, and hashtag lines
  let textContent = mainContent;
  results.forEach(({ imageUrl, caption }) => {
    textContent = textContent.replace(`![${caption}](${imageUrl})`, "");
    // Also remove bare URL if it appears as plain text
    textContent = textContent.replace(imageUrl, "");
  });
  textContent = textContent.replace(/\[⬇️ Download\]\([^)]*social-images[^)]*\)/g, "");
  textContent = textContent.replace(/🔄\s*Regenerate/g, "");
  textContent = textContent.replace(/^#{1,4}\s*Slot\s*\d+\s*[—\-]\s*(\d{1,2}:\d{2}\s*(AM|PM)\s*\|?\s*)?.*/gm, "");
  // Remove contact info lines
  textContent = textContent.replace(/^.*📍.*$/gm, "");
  textContent = textContent.replace(/^.*📞.*$/gm, "");
  textContent = textContent.replace(/^.*🌐.*$/gm, "");
  textContent = textContent.replace(/^.*9 Cedar Ave.*$/gim, "");
  textContent = textContent.replace(/^.*647[-.\s]?260[-.\s]?9403.*$/gm, "");
  textContent = textContent.replace(/\*\*Caption:\*\*/g, "");
  textContent = textContent.replace(/\*\*Hashtags:\*\*/g, "");
  textContent = textContent.replace(/^[\s]*#[a-zA-Z]\w*(\s+#[a-zA-Z]\w*)*[\s]*$/gm, "");
  textContent = textContent.replace(/\n{3,}/g, "\n\n").trim();

  // Assign full caption text and Persian translation to posts
  results.forEach((r) => {
    r.hashtags = allHashtags;
    r.persianTranslation = persianTranslation;
    if (textContent) {
      r.caption = textContent;
    }
  });

  return results;
}

/** Extract video URLs from content (social-media-assets bucket or .mp4 extension) */
function extractVideoUrls(content: string): string[] {
  const videoRegex = /(https?:\/\/[^\s)<>]*(?:social-media-assets[^\s)<>]*\.mp4|\.mp4))/gi;
  const urls: string[] = [];
  let match;
  while ((match = videoRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

const PixelChatRenderer = React.forwardRef<HTMLDivElement, PixelChatRendererProps>(
  ({ content, agentImage, agentName, onViewPost, onRegenerateImage, onApprovePost, onRegeneratePost }, ref) => {
    const images = extractPostData(content);
    const videos = extractVideoUrls(content);

    if (images.length === 0 && videos.length === 0) {
      return (
        <div ref={ref}>
          <RichMarkdown content={content} onRegenerateImage={onRegenerateImage} />
        </div>
      );
    }

    // Caption text is already embedded in each image's caption field from extractPostData
    const posts: PixelPostData[] = images.map((img, i) => ({
      id: `post-${i}-${img.imageUrl.slice(-8)}`,
      imageUrl: img.imageUrl,
      caption: img.caption,
      hashtags: img.hashtags,
      persianTranslation: img.persianTranslation,
      status: "draft" as const,
    }));

    return (
      <div ref={ref} className="space-y-2">
        {posts.map((post) => (
          <PixelPostCard
            key={post.id}
            post={post}
            onView={onViewPost}
            onApprove={onApprovePost}
            onRegenerate={onRegeneratePost}
          />
        ))}

        {/* Video rendering */}
        {videos.map((url, i) => (
          <div key={`video-${i}`} className="rounded-xl border border-border bg-card my-2 shadow-sm overflow-hidden max-w-sm">
            <video
              src={url}
              controls
              className="w-full aspect-video object-cover"
              preload="metadata"
            />
            <div className="px-3 py-2">
              <p className="text-xs text-muted-foreground">🎬 Generated video</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
);

PixelChatRenderer.displayName = "PixelChatRenderer";

export { PixelChatRenderer };
