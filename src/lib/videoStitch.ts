/**
 * Stitches multiple video clips sequentially into one continuous video.
 * Each clip is trimmed to its target duration.
 * Returns a blob URL of the combined video.
 */

async function fetchAsBlob(url: string): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    // If fetch fails (CORS), return original URL and hope crossOrigin works
    return url;
  }
}

export async function stitchClips(
  clips: { videoUrl: string; targetDuration: number }[],
): Promise<string> {
  if (clips.length === 0) throw new Error("No clips to stitch");
  if (clips.length === 1) {
    const blobUrl = await fetchAsBlob(clips[0].videoUrl);
    return blobUrl;
  }

  // Pre-fetch all clips as blobs to bypass CORS
  const blobUrls = await Promise.all(clips.map(c => fetchAsBlob(c.videoUrl)));

  // Load all videos first
  const videos = await Promise.all(
    clips.map(
      (clip, i) =>
        new Promise<{ video: HTMLVideoElement; target: number }>((resolve, reject) => {
          const video = document.createElement("video");
          video.playsInline = true;
          video.preload = "auto";
          video.muted = true;
          video.onloadedmetadata = () => resolve({ video, target: clip.targetDuration });
          video.onerror = () => reject(new Error(`Failed to load clip: ${clip.videoUrl}`));
          video.src = blobUrls[i];
        })
    )
  );

  const canvas = document.createElement("canvas");
  canvas.width = videos[0].video.videoWidth || 1280;
  canvas.height = videos[0].video.videoHeight || 720;
  const ctx = canvas.getContext("2d")!;

  const canvasStream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,
  });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<string>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Stitch recording failed"));

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
    };

    recorder.start();

    let clipIndex = 0;

    const playNextClip = () => {
      if (clipIndex >= videos.length) {
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 100);
        return;
      }

      const { video, target } = videos[clipIndex];
      const effectiveDuration = Math.min(target, video.duration || target);
      video.currentTime = 0;

      let animFrame: number;
      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= effectiveDuration) {
          cancelAnimationFrame(animFrame);
          video.pause();
          clipIndex++;
          playNextClip();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        animFrame = requestAnimationFrame(drawFrame);
      };

      video.ontimeupdate = () => {
        if (video.currentTime >= effectiveDuration) {
          video.pause();
        }
      };

      video.play()
        .then(() => {
          drawFrame();
        })
        .catch(reject);
    };

    playNextClip();
  });
}
