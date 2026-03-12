/**
 * Merges a video and an audio track using canvas + MediaRecorder.
 * Returns a blob URL of the combined video with audio.
 */
export async function mergeVideoAudio(
  videoSrc: string,
  audioSrc: string,
): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    video.muted = true; // Must be muted before src for blob URL loading

    const audio = document.createElement("audio");
    audio.preload = "auto";

    // Fallback: if video fails to load within 5s, return original (silent) video
    const fallbackTimer = setTimeout(() => {
      console.warn("[mergeVideoAudio] Timeout loading video blob, returning silent video");
      resolve(videoSrc);
    }, 5000);

    let videoReady = false;
    let audioReady = false;

    const tryStart = () => {
      if (!videoReady || !audioReady) return;
      clearTimeout(fallbackTimer);

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d")!;

      const canvasStream = canvas.captureStream(30);

      const audioCtx = new AudioContext();
      const audioSource = audioCtx.createMediaElementSource(audio);
      const audioDestination = audioCtx.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      audioSource.connect(audioCtx.destination);

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        audioCtx.close();
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };

      recorder.onerror = () => {
        audioCtx.close();
        console.warn("[mergeVideoAudio] Recorder error, returning silent video");
        resolve(videoSrc);
      };

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        audio.pause();
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 200);
      };

      recorder.start();
      video.play().then(() => {
        audio.play();
        drawFrame();
      }).catch(() => {
        console.warn("[mergeVideoAudio] Play failed, returning silent video");
        resolve(videoSrc);
      });
    };

    video.oncanplaythrough = () => {
      videoReady = true;
      tryStart();
    };
    video.onerror = () => {
      clearTimeout(fallbackTimer);
      console.warn("[mergeVideoAudio] Video load failed, returning silent video");
      resolve(videoSrc);
    };

    audio.oncanplaythrough = () => {
      audioReady = true;
      tryStart();
    };
    audio.onerror = () => {
      clearTimeout(fallbackTimer);
      console.warn("[mergeVideoAudio] Audio load failed, returning silent video");
      resolve(videoSrc);
    };

    video.src = videoSrc;
    audio.src = audioSrc;
  });
}
