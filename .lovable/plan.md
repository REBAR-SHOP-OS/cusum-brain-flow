

# Add Camera via QR Code Scanning

## What
Add a "Scan QR Code" button to the Camera Manager that uses the device camera to scan a Reolink QR code, extract the UID and device info, and auto-fill the camera registration form.

## How

### 1. Install QR scanning library
- Use `html5-qrcode` — lightweight browser-based QR scanner that uses the device camera (works on mobile and desktop with webcam)

### 2. Create QR Scanner Dialog Component
**Create**: `src/components/camera/QRCameraScanner.tsx`
- A dialog with a live camera viewfinder for QR code scanning
- On successful scan, parse the QR string (Reolink QR codes typically contain the UID like `95270003HBQ6QBSH`)
- Returns parsed data to parent via callback
- Auto-closes on successful scan

### 3. Update CameraManager
**Modify**: `src/components/camera/CameraManager.tsx`
- Add a "Scan QR" button next to "Add Camera" in the header
- On successful QR scan, open the Add Camera dialog with the `camera_id` field pre-filled with the scanned UID
- Also pre-fill `name` with something like `Camera-{UID_last6}` as a starting point
- User still needs to enter IP address, credentials, etc. manually (QR doesn't contain those)

### Files
- **Install**: `html5-qrcode`
- **Create**: `src/components/camera/QRCameraScanner.tsx`
- **Modify**: `src/components/camera/CameraManager.tsx`

