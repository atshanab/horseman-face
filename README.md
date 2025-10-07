# Headless Horseman – Face Replace (GitHub Pages)
This is a single‑page web app that shows the provided Headless Horseman artwork and automatically **replaces the jack‑o‑lantern with the closest detected face** from the selfie camera. If no face is detected, a message prompts the user to place their face in front of the camera.

## How it works
- Uses the **FaceDetector** Web API (Chrome/Android and modern iOS) to find the largest face.
- The face is cut out from the live camera and composited into the pumpkin area on a `<canvas>` with a soft feather for integration.
- No manual dragging—**it auto‑tracks** as the face moves.

## Deploy on GitHub Pages
1. Create a new repo (for example `horseman-face`).
2. Put all files in the root of the repo.
3. Enable GitHub Pages on the `main` branch.
4. Your site will be at `https://YOUR_GITHUB_USERNAME.github.io/horseman-face/` (replace with your username/repo).

## Calibrate pumpkin position (optional)
If the face isn’t perfectly aligned with the pumpkin, adjust via URL params:
```
?x=0.72&y=0.24&w=0.23&h=0.23&feather=0.08
```
- `x,y` = top‑left normalized (0–1)
- `w,h` = size normalized (0–1)
- `feather` = soft edge amount (0–1 relative to min(w,h))

## QR code
`qrcode.png` currently points to `https://YOUR_GITHUB_USERNAME.github.io/horseman-face/`.
After you publish, regenerate (or update) the QR with your real URL, or just open the PNG and replace the URL using any QR generator.

## Browser support notes
- The FaceDetector API is widely supported on Chromium browsers and recent iOS; if unsupported, the page will show a helpful message.
