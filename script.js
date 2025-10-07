// Fallback-only build: always uses MediaPipe FaceMesh
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
const dbg = document.getElementById('debug');
const video = document.getElementById('cam');
const startBtn = document.getElementById('start');
const snapBtn = document.getElementById('snap');
const dlLink = document.getElementById('download');

const bg = new Image();
bg.src = 'assets/horseman.png';
bg.onload = () => { canvas.width = bg.width; canvas.height = bg.height; drawBase(); };

let cameraHelper = null;
let lastBox = null;

function log(s){ dbg.textContent = String(s); }

startBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user', width: {ideal: 640}, height:{ideal:480} }, 
      audio: false 
    });
    video.srcObject = stream;
    await video.play();
    statusEl.textContent = 'Starting tracker…';
    await initFaceMesh();
  } catch (e) {
    statusEl.textContent = 'Camera blocked. Enable permission.';
    log(e.message || e);
  }
});

snapBtn.addEventListener('click', () => {
  const url = canvas.toDataURL('image/png');
  dlLink.href = url;
  dlLink.classList.remove('hidden');
  dlLink.textContent = 'Download Photo';
});

function drawBase() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
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

async function initFaceMesh(){
  if (typeof FaceMesh === 'undefined' || typeof Camera === 'undefined'){
    statusEl.textContent = 'Failed to load tracker libs.';
    log('MediaPipe FaceMesh not loaded. Check network/CDN.');
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

  cameraHelper = new Camera(video, {
    onFrame: async () => { await faceMesh.send({ image: video }); },
    width: 640,
    height: 480
  });
  cameraHelper.start();
  statusEl.textContent = 'Place your face in front of the camera.';
  requestAnimationFrame(loop);
}

function onResults(results){
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0){
    lastBox = null;
    return;
  }
  const lm = results.multiFaceLandmarks[0];
  let minX=1, minY=1, maxX=0, maxY=0;
  for (const p of lm){
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = 0.05;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(1, maxX + pad);
  maxY = Math.min(1, maxY + pad);

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  lastBox = { x: minX*vw, y: minY*vh, width: (maxX-minX)*vw, height: (maxY-minY)*vh };
  log(`face box: ${Math.round(lastBox.x)},${Math.round(lastBox.y)} ${Math.round(lastBox.width)}x${Math.round(lastBox.height)}`);
}

function loop(){
  drawBase();
  if (lastBox){
    statusEl.textContent = 'Face detected!';
    drawFaceIntoPumpkin(lastBox);
  } else {
    statusEl.textContent = 'Place your face in front of the camera.';
  }
  requestAnimationFrame(loop);
}

// Initial draw
drawBase();
