

## Fix: Black Camera in Face Enrollment Dialog

### Problem
The camera shows black because of a timing issue between when the stream is obtained and when the video element is actually in the DOM:

1. `startCamera()` gets the media stream and stores it in `streamRef`
2. At this point, `cameraActive` is still `false`, so the `<video>` element doesn't exist in the DOM yet
3. `setCameraActive(true)` triggers a re-render that adds the `<video>` element
4. The `useEffect` fires on `cameraActive` change, but the video DOM node may not be committed yet in the same render cycle, so `videoRef.current` can still be null

### Solution
Replace the static `videoRef` with a **callback ref** on the `<video>` element. When React mounts the video element, the callback fires immediately with the DOM node, and we assign `streamRef.current` to it right then. This eliminates any timing gap.

### Changes (single file, surgical)

**`src/components/timeclock/FaceEnrollment.tsx`**

1. Remove the `useEffect` sync hook (lines 34-41) -- it's unreliable
2. Replace `videoRef = useRef<HTMLVideoElement>(null)` with a mutable ref that gets set via a callback
3. Add a `videoCallbackRef` function that:
   - Stores the video element in `videoRef.current`
   - If `streamRef.current` exists, assigns it to `video.srcObject` and calls `play()`
4. Update the `<video>` element to use `ref={videoCallbackRef}` instead of `ref={videoRef}`

This guarantees that the moment the video element enters the DOM, it gets the stream -- no race condition possible.

### Technical Detail

```text
Before (broken):
  startCamera() --> stream ready --> videoRef is null --> setCameraActive(true) --> re-render --> useEffect fires --> videoRef MIGHT still be null

After (fixed):
  startCamera() --> stream ready --> setCameraActive(true) --> re-render --> video mounts --> callback ref fires --> stream assigned immediately
```

No other files are affected. The canvas ref, capture logic, and upload flow remain untouched.
