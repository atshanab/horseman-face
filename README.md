# Headless Horseman – Face Replace (with iOS fallback)
This build adds a **MediaPipe FaceMesh** fallback when the native `FaceDetector` API is unavailable (common on some iOS/Safari versions).

- Native path (fast): `FaceDetector` Web API
- Fallback path: MediaPipe FaceMesh via CDN (no extra hosting config).

**Deploy:** copy everything to your GitHub repo and enable Pages.
