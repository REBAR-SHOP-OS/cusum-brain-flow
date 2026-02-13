import React from "react";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { PixelPostCard, PixelPostData } from "./PixelPostCard";

interface PixelChatRendererProps {
  content: string;
  agentImage: string;
  agentName: string;
  onViewPost: (post: PixelPostData) => void;
  onRegenerateImage?: (imageUrl: string, alt: string) => void;
}

/** Extract social-images URLs from markdown content */
function extractPostImages(content: string): { imageUrl: string; caption: string }[] {
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]*social-images[^\s)]*)\)/g;
  const results: { imageUrl: string; caption: string }[] = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    results.push({ caption: match[1], imageUrl: match[2] });
  }
  return results;
}

const PixelChatRenderer = React.forwardRef<HTMLDivElement, PixelChatRendererProps>(
  ({ content, agentImage, agentName, onViewPost, onRegenerateImage }, ref) => {
    const images = extractPostImages(content);

    if (images.length === 0) {
      return (
        <div ref={ref}>
          <RichMarkdown content={content} onRegenerateImage={onRegenerateImage} />
        </div>
      );
    }

    // Remove image markdown from content and show as text + post cards
    let textContent = content;
    images.forEach(({ imageUrl, caption }) => {
      textContent = textContent.replace(`![${caption}](${imageUrl})`, "");
    });

    // Clean up leftover empty lines and download/regen links tied to images
    textContent = textContent.replace(/\[⬇️ Download\]\([^)]*social-images[^)]*\)/g, "");
    textContent = textContent.replace(/🔄\s*Regenerate/g, "");
    textContent = textContent.trim();

    const posts: PixelPostData[] = images.map((img, i) => ({
      id: `post-${i}-${img.imageUrl.slice(-8)}`,
      imageUrl: img.imageUrl,
      caption: img.caption,
      status: "draft" as const,
    }));

    return (
      <div ref={ref} className="space-y-2">
        {textContent && (
          <RichMarkdown content={textContent} onRegenerateImage={onRegenerateImage} />
        )}
        {posts.map((post) => (
          <PixelPostCard
            key={post.id}
            post={post}
            agentImage={agentImage}
            agentName={agentName}
            onView={onViewPost}
          />
        ))}
      </div>
    );
  }
);

PixelChatRenderer.displayName = "PixelChatRenderer";

export { PixelChatRenderer };
