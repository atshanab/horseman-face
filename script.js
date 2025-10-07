// Core config: where to place the user's face (normalized coords relative to background image)
const CONFIG = {
  // Pumpkin box on the provided image (x,y,w,h) as fractions of the image size.
  // Tune these if needed via URL params: ?x=0.70&y=0.25&w=0.20&h=0.20
  x: parseFloat(new URLSearchParams(location.search).get('x')) || 0.72,
  y: parseFloat(new URLSearchParams(location.search).get('y')) || 0.24,
  w: parseFloat(new URLSearchParams(location.search).get('w')) || 0.23,
  h: parseFloat(new URLSearchParams(location.search).get('h')) || 0.23,
  feather: parseFloat(new URLSearchParams(location.search).get('feather')) || 0.08 // soft edge feather relative to box size
};

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const video = document.getElementById('cam');
const snapBtn = document.getElementById('snap');
const dlLink = document.getElementById('download');

const bg = new Image();
bg.src = 'assets/horseman.png';

let detector = null;
let stream = null;
let haveSupport = ('FaceDetector' in window);

async function init() {
  bg.onload = () => {
    resizeCanvasToImage();
    drawBase();
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    statusEl.textContent = 'Camera permission needed. Please allow access.';
    console.error(e);
    return;
  }

  if (haveSupport) {
    detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    statusEl.textContent = 'Place your face in front of the camera.';
    requestAnimationFrame(loop);
  } else {
    statusEl.innerHTML = 'FaceDetector not supported. Try Chrome/Android or update iOS.';
  }
}

function resizeCanvasToImage() {
  // Keep the source pixel size (so downloads are high-res)
  canvas.width = bg.width;
  canvas.height = bg.height;
}

function drawBase() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  // Mask the pumpkin area so it's "cut out" before we draw the face.
  const bx = CONFIG.x * canvas.width;
  const by = CONFIG.y * canvas.height;
  const bw = CONFIG.w * canvas.width;
  const bh = CONFIG.h * canvas.height;

  ctx.save();
  // Draw a soft dark oval to hide the pumpkin
  const grad = ctx.createRadialGradient(bx + bw/2, by + bh/2, Math.min(bw,bh)*0.25, bx + bw/2, by + bh/2, Math.max(bw,bh)*0.65);
  grad.addColorStop(0, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = grad;
  roundedEllipse(ctx, bx, by, bw, bh, Math.min(bw,bh)*0.18);
  ctx.fill();
  ctx.restore();
}

// Helper to draw a rounded ellipse path
function roundedEllipse(ctx, x, y, w, h, r) {
  const kappa = .5522848,
    ox = (w / 2) * kappa, // control point offset horizontal
    oy = (h / 2) * kappa, // control point offset vertical
    xe = x + w,           // x-end
    ye = y + h,           // y-end
    xm = x + w / 2,       // x-middle
    ym = y + h / 2;       // y-middle

  ctx.beginPath();
  ctx.moveTo(x, ym);
  ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
  ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
  ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
  ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
  ctx.closePath();
}

async function loop() {
  drawBase(); // draw background and cutout mask every frame

  if (detector && video.readyState >= 2) {
    try {
      const faces = await detector.detect(video);

      if (faces.length === 0) {
        statusEl.textContent = 'Place your face in front of the camera.';
      } else {
        statusEl.textContent = 'Face detected!';
        // take the closest (largest) face
        const face = faces.sort((a,b) => (b.boundingBox.width*b.boundingBox.height) - (a.boundingBox.width*a.boundingBox.height))[0];
        drawFaceIntoPumpkin(face);
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Face detection error.';
    }
  }

  requestAnimationFrame(loop);
}

function drawFaceIntoPumpkin(face) {
  const bx = CONFIG.x * canvas.width;
  const by = CONFIG.y * canvas.height;
  const bw = CONFIG.w * canvas.width;
  const bh = CONFIG.h * canvas.height;

  // source rect from the camera
  const { x, y, width, height } = face.boundingBox;

  // Draw with a feathered clip so it blends
  ctx.save();
  // Feathered oval clip
  ctx.beginPath();
  roundedEllipse(ctx, bx, by, bw, bh, Math.min(bw,bh)*0.18);
  ctx.clip();

  // Optional feather via globalAlpha around edges
  // Draw the face scaled to fit into the pumpkin box
  ctx.drawImage(video, x, y, width, height, bx, by, bw, bh);

  // subtle edge darkening for integration
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

// Snapshot
snapBtn.addEventListener('click', () => {
  const url = canvas.toDataURL('image/png');
  dlLink.href = url;
  dlLink.classList.remove('hidden');
  dlLink.textContent = 'Download Photo';
});

init();
