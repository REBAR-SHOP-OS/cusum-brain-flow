

## درخواست کاربر
وقتی کاربر یک نوار صدا (Audio) را در timeline حذف می‌کند، باید **واقعاً صدای آن ویدئو در preview قطع شود**. الان نوار از UI حذف می‌شود ولی صدا همچنان در playback پخش می‌شود.

## بررسی کد
نیاز به مطالعه:
- `src/components/ad-director/ProVideoEditor.tsx` — `handleRemoveAudioTrack` و playback logic (video element `muted` property)
- محل تنظیم `muted` روی video element در preview
