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
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]*social-images[^\s)]*)\)/g;
  const results: { imageUrl: string; caption: string; hashtags: string; persianTranslation: string }[] = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    results.push({ caption: match[1], imageUrl: match[2], hashtags: "", persianTranslation: "" });
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
  }

  // Extract hashtags from main content only
  const hashtagMatches = mainContent.match(/#[a-zA-Z]\w*/g);
  const allHashtags = hashtagMatches ? hashtagMatches.join(" ") : "";

  // Build full caption: remove image markdown, download/regen links, and hashtag lines
  let textContent = mainContent;
  results.forEach(({ imageUrl, caption }) => {
    textContent = textContent.replace(`![${caption}](${imageUrl})`, "");
  });
  textContent = textContent.replace(/\[⬇️ Download\]\([^)]*social-images[^)]*\)/g, "");
  textContent = textContent.replace(/🔄\s*Regenerate/g, "");
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
      </div>
    );
  }
);

PixelChatRenderer.displayName = "PixelChatRenderer";

export { PixelChatRenderer };
