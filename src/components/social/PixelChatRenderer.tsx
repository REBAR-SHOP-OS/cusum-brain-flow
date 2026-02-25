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
function extractPostData(content: string): { imageUrl: string; caption: string; hashtags: string }[] {
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]*social-images[^\s)]*)\)/g;
  const results: { imageUrl: string; caption: string; hashtags: string }[] = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    results.push({ caption: match[1], imageUrl: match[2], hashtags: "" });
  }

  if (results.length === 0) return results;

  // Extract hashtags from content (lines or inline sequences of #word)
  const hashtagMatches = content.match(/#[a-zA-Z]\w*/g);
  const allHashtags = hashtagMatches ? hashtagMatches.join(" ") : "";

  // Build full caption: remove image markdown, download/regen links, and hashtag lines
  let textContent = content;
  results.forEach(({ imageUrl, caption }) => {
    textContent = textContent.replace(`![${caption}](${imageUrl})`, "");
  });
  textContent = textContent.replace(/\[⬇️ Download\]\([^)]*social-images[^)]*\)/g, "");
  textContent = textContent.replace(/🔄\s*Regenerate/g, "");
  textContent = textContent.replace(/^[\s]*#[a-zA-Z]\w*(\s+#[a-zA-Z]\w*)*[\s]*$/gm, "");
  textContent = textContent.replace(/\n{3,}/g, "\n\n").trim();

  // Assign full caption text to posts
  results.forEach((r) => {
    r.hashtags = allHashtags;
    // Use the cleaned text content as the full caption (instead of just alt text)
    if (textContent) {
      r.caption = textContent;
    }
  });

  return results;
}

const PixelChatRenderer = React.forwardRef<HTMLDivElement, PixelChatRendererProps>(
  ({ content, agentImage, agentName, onViewPost, onRegenerateImage, onApprovePost, onRegeneratePost }, ref) => {
    const images = extractPostData(content);

    if (images.length === 0) {
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
      </div>
    );
  }
);

PixelChatRenderer.displayName = "PixelChatRenderer";

export { PixelChatRenderer };
