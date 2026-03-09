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

interface ExtractedPost {
  imageUrl: string;
  caption: string;
  hashtags: string;
  contactInfo: string;
  imageTextTranslation: string;
  captionTranslation: string;
}

/** Extract social-images URLs, caption, contact info, hashtags, and Persian translations */
function extractPostData(content: string): ExtractedPost[] {
  // Primary: markdown image syntax with social-images bucket
  const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]*social-images[^\s)]*)\)/g;
  const results: ExtractedPost[] = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    results.push({ caption: match[1], imageUrl: match[2], hashtags: "", contactInfo: "", imageTextTranslation: "", captionTranslation: "" });
  }

  // Fallback: bare social-images URLs
  if (results.length === 0) {
    const bareUrlRegex = /(https?:\/\/[^\s)<>]*social-images[^\s)<>]*\.(?:png|jpg|jpeg|webp))/g;
    let bareMatch;
    while ((bareMatch = bareUrlRegex.exec(content)) !== null) {
      const before = content.slice(Math.max(0, bareMatch.index - 2), bareMatch.index);
      if (!before.includes("](")) {
        results.push({ caption: "", imageUrl: bareMatch[1], hashtags: "", contactInfo: "", imageTextTranslation: "", captionTranslation: "" });
      }
    }
  }

  if (results.length === 0) return results;

  // Separate Persian translation section
  const persianSeparator = "---PERSIAN---";
  let mainContent = content;
  let persianBlock = "";
  const persianIdx = content.indexOf(persianSeparator);
  if (persianIdx !== -1) {
    persianBlock = content.slice(persianIdx + persianSeparator.length).trim();
    mainContent = content.slice(0, persianIdx).trim();
  } else {
    const persianMarkerMatch = content.match(/(🖼️\s*متن روی عکس:[\s\S]*)/);
    if (persianMarkerMatch) {
      persianBlock = persianMarkerMatch[1].trim();
      mainContent = content.slice(0, persianMarkerMatch.index).trim();
    }
  }

  // Parse Persian block into image text and caption translation
  let imageTextTranslation = "";
  let captionTranslation = "";
  if (persianBlock) {
    const imageTextMatch = persianBlock.match(/🖼️\s*متن روی عکس:\s*([\s\S]*?)(?=📝|$)/);
    if (imageTextMatch) {
      imageTextTranslation = imageTextMatch[1].trim();
    }
    const captionMatch = persianBlock.match(/📝\s*ترجمه کپشن:\s*([\s\S]*)/);
    if (captionMatch) {
      captionTranslation = captionMatch[1].trim();
    }
    // If no markers found, treat entire block as image text translation (backward compat)
    if (!imageTextTranslation && !captionTranslation) {
      imageTextTranslation = persianBlock;
    }
  }

  // Extract contact info lines from main content (capture, don't discard)
  const contactPatterns = [
    /^.*📍.*$/gm,
    /^.*📞.*$/gm,
    /^.*🌐.*$/gm,
    /^.*9 Cedar Ave.*$/gim,
    /^.*647[-.\s]?260[-.\s]?9403.*$/gm,
  ];
  const contactLines: string[] = [];
  let textForContact = mainContent;
  for (const pattern of contactPatterns) {
    let m;
    while ((m = pattern.exec(textForContact)) !== null) {
      const line = m[0].trim();
      if (line && !contactLines.includes(line)) {
        contactLines.push(line);
      }
    }
  }
  const contactInfo = contactLines.join("\n");

  // Extract hashtags from main content
  const hashtagMatches = mainContent.match(/#[a-zA-Z]\w*/g);
  const allHashtags = hashtagMatches ? hashtagMatches.join(" ") : "";

  // Build caption: remove image markdown, bare URLs, download/regen links, contact lines, hashtag lines, slot headers
  let textContent = mainContent;
  results.forEach(({ imageUrl, caption }) => {
    textContent = textContent.replace(`![${caption}](${imageUrl})`, "");
    textContent = textContent.replace(imageUrl, "");
  });
  textContent = textContent.replace(/\[⬇️ Download\]\([^)]*social-images[^)]*\)/g, "");
  textContent = textContent.replace(/🔄\s*Regenerate/g, "");
  textContent = textContent.replace(/^#{1,4}\s*Slot\s*[\d:]+\s*[—\-].*/gm, "");
  // Remove contact info lines from caption
  for (const pattern of contactPatterns) {
    textContent = textContent.replace(pattern, "");
  }
  textContent = textContent.replace(/\*\*Caption:\*\*/g, "");
  textContent = textContent.replace(/\*\*Hashtags:\*\*/g, "");
  textContent = textContent.replace(/^[\s]*#[a-zA-Z]\w*(\s+#[a-zA-Z]\w*)*[\s]*$/gm, "");
  textContent = textContent.replace(/\n{3,}/g, "\n\n").trim();

  // Assign extracted data to all posts
  results.forEach((r) => {
    r.hashtags = allHashtags;
    r.contactInfo = contactInfo;
    r.imageTextTranslation = imageTextTranslation;
    r.captionTranslation = captionTranslation;
    if (textContent) {
      r.caption = textContent;
    }
  });

  return results;
}

/** Extract video URLs from content */
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

    const posts: PixelPostData[] = images.map((img, i) => ({
      id: `post-${i}-${img.imageUrl.slice(-8)}`,
      imageUrl: img.imageUrl,
      caption: img.caption,
      hashtags: img.hashtags,
      contactInfo: img.contactInfo,
      imageTextTranslation: img.imageTextTranslation,
      captionTranslation: img.captionTranslation,
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
