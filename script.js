// If native FaceDetector isn't available (iOS Safari on some versions), we fall back to MediaPipe FaceMesh.
// The rest of the app logic (drawing to canvas) is shared.

const CONFIG = {
  x: parseFloat(new URLSearchParams(location.search).get('x')) || 0.72,
  y: parseFloat(new URLSearchParams(location.search).get('y')) || 0.24,
  w: parseFloat(new URLSearchParams(location.search).get('w')) || 0.23,
  h: parseFloat(new URLSearchParams(location.search).get('h')) || 0.23,
  feather: parseFloat(new URLSearchParams(location.search).get('feather')) || 0.08
};

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const video = document.getElementById('cam');
const startBtn = document.getElementById('start');
const snapBtn = document.getElementById('snap');
const dlLink = document.getElementById('download');

const bg = new Image();
bg.src = 'assets/horseman.png';

let stream = null;
let usingNative = ('FaceDetector' in window);
let detector = null;
let faceBox = null; // {x,y,width,height} in VIDEO coordinates

bg.onload = () => {
  canvas.width = bg.width;
  canvas.height = bg.height;
  drawBase();
};

startBtn.addEventListener('click', init);
snapBtn.addEventListener('click', () => {
  const url = canvas.toDataURL('image/png');
  dlLink.href = url;
  dlLink.classList.remove('hidden');
  dlLink.textContent = 'Download Photo';
});

async function init() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    statusEl.textContent = 'Camera permission needed. Please allow access.';
    console.error(e);
    return;
  }

  if (usingNative) {
    detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    statusEl.textContent = 'Place your face in front of the camera.';
    requestAnimationFrame(loopNative);
  } else {
    statusEl.textContent = 'Using fallback face tracker…';
    await initMediaPipeFallback();
  }
}

// ---------- Shared drawing helpers ----------
function drawBase() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  // Soft cutout oval where the face will be drawn
  const { bx, by, bw, bh } = pumpkinBox();
  ctx.save();
  const grad = ctx.createRadialGradient(bx + bw/2, by + bh/2, Math.min(bw,bh)*0.25, bx + bw/2, by + bh/2, Math.max(bw,bh)*0.65);
  grad.addColorStop(0, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = grad;
  roundedEllipse(ctx, bx, by, bw, bh, Math.min(bw,bh)*0.18);
  ctx.fill();
  ctx.restore();
}

function pumpkinBox() {
  const bx = CONFIG.x * canvas.width;
  const by = CONFIG.y * canvas.height;
  const bw = CONFIG.w * canvas.width;
  const bh = CONFIG.h * canvas.height;
  return { bx, by, bw, bh };
}

function roundedEllipse(ctx, x, y, w, h, r) {
  const kappa = .5522848,
    ox = (w / 2) * kappa,
    oy = (h / 2) * kappa,
    xe = x + w,
    ye = y + h,
    xm = x + w / 2,
    ym = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x, ym);
  ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
  ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
  ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
  ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
  ctx.closePath();
}

function drawFaceIntoPumpkin(box) {
  const { bx, by, bw, bh } = pumpkinBox();
  const { x, y, width, height } = box;

  ctx.save();
  roundedEllipse(ctx, bx, by, bw, bh, Math.min(bw,bh)*0.18);
  ctx.clip();
  ctx.drawImage(video, x, y, width, height, bx, by, bw, bh);

  const edge = CONFIG.feather * Math.min(bw,bh);
  const grad = ctx.createRadialGradient(bx + bw/2, by + bh/2, Math.min(bw,bh)*0.4, bx + bw/2, by + bh/2, Math.min(bw,bh)*0.55 + edge);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  roundedEllipse(ctx, bx, by, bw, bh, Math.min(bw,bh)*0.18);
  ctx.fill();
  ctx.restore();
}

// ---------- Native FaceDetector loop ----------
async function loopNative() {
  drawBase();
  if (detector && video.readyState >= 2) {
    try {
      const faces = await detector.detect(video);
      if (faces.length === 0) {
        statusEl.textContent = 'Place your face in front of the camera.';
      } else {
        statusEl.textContent = 'Face detected!';
        const face = faces.sort((a,b) => (b.boundingBox.width*b.boundingBox.height) - (a.boundingBox.width*a.boundingBox.height))[0];
        drawFaceIntoPumpkin(face.boundingBox);
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Face detection error.';
    }
  }
  requestAnimationFrame(loopNative);
}

// ---------- MediaPipe FaceMesh fallback ----------
async function initMediaPipeFallback() {
  // Wait for the global constructors loaded by the three CDN scripts.
  function waitFor(cond, timeout=5000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      (function check(){
        if (cond()) return resolve();
        if (performance.now() - start > timeout) return reject(new Error('MediaPipe scripts failed to load'));
        requestAnimationFrame(check);
      })();
    });
  }
  try {
    await waitFor(() => window.FaceMesh !== undefined);
  } catch (e) {
    statusEl.textContent = 'Could not load fallback tracker.';
    console.error(e);
    return;
  }

  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onResults);

  // Use MediaPipe Camera helper to pump frames from <video> into FaceMesh
  const cam = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });
  cam.start();
  statusEl.textContent = 'Place your face in front of the camera.';
  requestAnimationFrame(loopFallback);
}

let lastFallbackBox = null;

function onResults(results) {
  // results.multiFaceLandmarks is an array of 468 landmark points (normalized 0..1)
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    lastFallbackBox = null;
    return;
  }
  const lm = results.multiFaceLandmarks[0];
  let minX=1, minY=1, maxX=0, maxY=0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  // expand slightly to include full face
  const pad = 0.05;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(1, maxX + pad);
  maxY = Math.min(1, maxY + pad);

  // Convert to video pixel coordinates
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  lastFallbackBox = {
    x: minX * vw,
    y: minY * vh,
    width: (maxX - minX) * vw,
    height: (maxY - minY) * vh
  };
}

function loopFallback() {
  drawBase();
  if (lastFallbackBox) {
    statusEl.textContent = 'Face detected!';
    drawFaceIntoPumpkin(lastFallbackBox);
  } else {
    statusEl.textContent = 'Place your face in front of the camera.';
  }
  requestAnimationFrame(loopFallback);
}

// Auto-init on load (desktop Chrome etc.). Safari may require tapping Start due to autoplay rules.
init().catch(()=>{});
