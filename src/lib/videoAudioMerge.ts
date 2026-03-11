/**
 * Merges a video and an audio track using canvas + MediaRecorder.
 * Returns a blob URL of the combined video with audio.
 */
export async function mergeVideoAudio(
  videoSrc: string,
  audioSrc: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";

    const audio = document.createElement("audio");
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";

    let videoReady = false;
    let audioReady = false;

    const tryStart = () => {
      if (!videoReady || !audioReady) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d")!;

      // Capture video frames from canvas
      const canvasStream = canvas.captureStream(30);

      // Create audio context to capture audio stream
      const audioCtx = new AudioContext();
      const audioSource = audioCtx.createMediaElementSource(audio);
      const audioDestination = audioCtx.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      audioSource.connect(audioCtx.destination); // also play through speakers (muted by recorder)

      // Combine video + audio tracks
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
        reject(new Error("MediaRecorder error during merge"));
      };

      const drawFrame = () => {
        if (video.paused || video.ended) {
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };

      // Stop when video ends (video is typically the shorter/controlling track)
      video.onended = () => {
        audio.pause();
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 200);
      };

      recorder.start();
      video.muted = true; // mute original video audio
      video.play().then(() => {
        audio.play();
        drawFrame();
      }).catch(reject);
    };

    video.oncanplaythrough = () => {
      videoReady = true;
      tryStart();
    };
    video.onerror = () => reject(new Error("Failed to load video for merge"));

    audio.oncanplaythrough = () => {
      audioReady = true;
      tryStart();
    };
    audio.onerror = () => reject(new Error("Failed to load audio for merge"));

    video.src = videoSrc;
    audio.src = audioSrc;
  });
}
