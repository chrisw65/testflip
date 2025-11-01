import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { createPageCurlMaterial } from './pageCurlMaterial.js';
import { loadPdfTextures, createBlankTexture } from './pdfLoader.js';

const container = document.getElementById('flipbook');
const loadButton = document.getElementById('loadPdf');
const pdfInput = document.getElementById('pdfSource');
const statusEl = document.getElementById('status');

if (!container || !loadButton || !pdfInput) {
  throw new Error('Flipbook markup is missing required elements.');
}

const defaultPdfUrl = new URL('./sample.pdf', import.meta.url).href;

function setStatus(message = '', isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', Boolean(isError));
}

function resolvePdfUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  try {
    return new URL(trimmed, window.location.href).href;
  } catch (firstError) {
    try {
      return new URL(trimmed, import.meta.url).href;
    } catch {
      console.warn('Unable to resolve PDF URL, passing raw value through.', firstError);
      return trimmed;
    }
  }
}

pdfInput.value = pdfInput.value?.trim() || defaultPdfUrl;
setStatus('Loading sample document…');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
camera.position.set(0, 0.2, 3.6);

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.1);
mainLight.position.set(-2.2, 2.8, 2.6);
scene.add(mainLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 0.4);
rimLight.position.set(3, 2, -2);
scene.add(rimLight);

const bookGroup = new THREE.Group();
scene.add(bookGroup);

const state = {
  pageWidth: 1,
  pageHeight: 1.414,
  textures: [],
  blankTexture: createBlankTexture(),
  currentSpread: 0,
  curl: 0,
  targetCurl: 0,
  isDragging: false,
  isFlipping: false,
  flipDirection: 1,
  finalizeAction: null,
};

let shadowPlane;
let leftMesh;
let rightMesh;
let flipMesh;
let flipMaterial;
let anisotropy = renderer.capabilities.getMaxAnisotropy();

function getTexture(index) {
  return state.textures[index] || state.blankTexture;
}

function setupScene() {
  shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.0),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -state.pageHeight * 0.55;
  shadowPlane.position.z = -0.05;
  bookGroup.add(shadowPlane);

  const leftGeometry = new THREE.PlaneGeometry(state.pageWidth, state.pageHeight, 1, 1);
  const rightGeometry = new THREE.PlaneGeometry(state.pageWidth, state.pageHeight, 1, 1);
  leftMesh = new THREE.Mesh(
    leftGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05, map: state.blankTexture })
  );
  leftMesh.position.x = -state.pageWidth / 2;
  bookGroup.add(leftMesh);

  rightMesh = new THREE.Mesh(
    rightGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05, map: state.blankTexture })
  );
  rightMesh.position.x = state.pageWidth / 2;
  bookGroup.add(rightMesh);

  const flipGeometry = new THREE.PlaneGeometry(state.pageWidth, state.pageHeight, 90, 36);
  flipMaterial = createPageCurlMaterial({
    frontTexture: state.blankTexture,
    backTexture: state.blankTexture,
    pageWidth: state.pageWidth,
    lift: 0.18,
  });
  flipMesh = new THREE.Mesh(flipGeometry, flipMaterial);
  flipMesh.position.x = state.pageWidth / 2;
  flipMesh.visible = false;
  bookGroup.add(flipMesh);

  bookGroup.rotation.x = THREE.MathUtils.degToRad(-12);
  bookGroup.position.y = -0.05;
}

function updateStaticPages() {
  const leftIndex = state.currentSpread * 2;
  const rightIndex = leftIndex + 1;

  const leftTexture = getTexture(leftIndex);
  const rightTexture = getTexture(rightIndex);

  leftMesh.material.map = leftTexture;
  leftMesh.material.needsUpdate = true;
  leftMesh.visible = leftIndex < state.textures.length;

  rightMesh.material.map = rightTexture;
  rightMesh.material.needsUpdate = true;
  rightMesh.visible = rightIndex < state.textures.length;
}

function startFlip(direction) {
  state.flipDirection = direction;
  state.isFlipping = true;
  state.finalizeAction = null;
  state.curl = 0.01;
  state.targetCurl = 0.2;
  flipMaterial.uniforms.uCurl.value = state.curl;
  flipMaterial.uniforms.uDirection.value = direction;
  flipMaterial.uniforms.uHingeX.value = direction === 1 ? -state.pageWidth / 2 : state.pageWidth / 2;
  flipMesh.position.x = direction === 1 ? state.pageWidth / 2 : -state.pageWidth / 2;
  flipMesh.visible = true;

  const leftIndex = state.currentSpread * 2;
  const rightIndex = leftIndex + 1;

  if (direction === 1) {
    rightMesh.visible = false;
    const front = getTexture(rightIndex);
    const back = getTexture(rightIndex + 1);
    flipMaterial.updateTextures(front, back);
  } else {
    leftMesh.visible = false;
    const front = getTexture(leftIndex);
    const back = getTexture(leftIndex - 1);
    flipMaterial.updateTextures(front, back);
  }
}

function endFlip(complete) {
  if (!state.isFlipping) return;
  const direction = state.flipDirection;
  state.finalizeAction = complete
    ? direction === 1
      ? 'forward-complete'
      : 'backward-complete'
    : direction === 1
      ? 'forward-cancel'
      : 'backward-cancel';
  state.targetCurl = complete ? 1 : 0;
}

function finalizeFlip() {
  const action = state.finalizeAction;
  if (!action) return;

  const maxSpread = Math.max(Math.ceil(state.textures.length / 2) - 1, 0);
  if (action === 'forward-complete') {
    state.currentSpread = Math.min(state.currentSpread + 1, maxSpread);
  } else if (action === 'backward-complete') {
    state.currentSpread = Math.max(state.currentSpread - 1, 0);
  }

  updateStaticPages();
  leftMesh.visible = true;
  rightMesh.visible = true;
  flipMesh.visible = false;
  state.curl = 0;
  state.targetCurl = 0;
  flipMaterial.uniforms.uCurl.value = 0;
  state.isFlipping = false;
  state.finalizeAction = null;
}

function canFlipForward() {
  const rightIndex = state.currentSpread * 2 + 1;
  return rightIndex < state.textures.length;
}

function canFlipBackward() {
  return state.currentSpread > 0;
}

function onPointerDown(event) {
  if (state.isFlipping) return;
  event.preventDefault();
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = x / rect.width;

  if (ratio > 0.55 && canFlipForward()) {
    startFlip(1);
    state.isDragging = true;
  } else if (ratio < 0.45 && canFlipBackward()) {
    startFlip(-1);
    state.isDragging = true;
  }
}

function onPointerMove(event) {
  if (!state.isDragging) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ratio = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1);

  if (state.flipDirection === 1) {
    state.targetCurl = THREE.MathUtils.clamp(1 - ratio, 0, 1);
  } else {
    state.targetCurl = THREE.MathUtils.clamp(ratio, 0, 1);
  }
}

function onPointerUp() {
  if (!state.isDragging) return;
  state.isDragging = false;
  const complete = state.targetCurl > 0.5;
  endFlip(complete);
}

function onResize() {
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

async function loadPdf(url) {
  const resolvedUrl = resolvePdfUrl(url);
  if (!resolvedUrl) {
    setStatus('Please enter a valid PDF URL.', true);
    return;
  }
  try {
    setStatus('Fetching PDF…');
    loadButton.disabled = true;
    container.classList.add('loading');
    const { textures, pageWidth, pageHeight } = await loadPdfTextures(resolvedUrl, { scale: 2.2 });
    state.textures = textures;
    state.pageWidth = pageWidth;
    state.pageHeight = pageHeight;
    state.currentSpread = 0;

    anisotropy = renderer.capabilities.getMaxAnisotropy();
    state.textures.forEach((texture) => {
      texture.anisotropy = Math.min(anisotropy, 8);
      texture.needsUpdate = true;
    });

    if (!leftMesh) {
      setupScene();
    }

    const baseHeight = leftMesh.geometry.parameters.height;
    const scaleY = state.pageHeight / baseHeight;
    leftMesh.scale.y = scaleY;
    rightMesh.scale.y = scaleY;
    flipMesh.scale.y = scaleY;
    shadowPlane.position.y = -state.pageHeight * 0.55;
    flipMaterial.uniforms.uPageWidth.value = state.pageWidth;

    updateStaticPages();
    onResize();
    const totalPages = state.textures.length;
    const label = resolvedUrl === defaultPdfUrl ? 'Sample PDF' : resolvedUrl;
    setStatus(`Loaded ${totalPages} page${totalPages === 1 ? '' : 's'} from ${label}.`);
  } catch (error) {
    console.error('Unable to load PDF', error);
    setStatus('Failed to load PDF. See console for details.', true);
  } finally {
    container.classList.remove('loading');
    loadButton.disabled = false;
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (state.isFlipping) {
    state.curl += (state.targetCurl - state.curl) * 0.18;
    if (Math.abs(state.targetCurl - state.curl) < 0.002) {
      state.curl = state.targetCurl;
    }
    flipMaterial.uniforms.uCurl.value = state.curl;

    if (!state.isDragging && Math.abs(state.curl - state.targetCurl) < 0.01 && state.finalizeAction) {
      finalizeFlip();
    }
  }

  renderer.render(scene, camera);
}

renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('resize', onResize);
renderer.domElement.addEventListener('dragstart', (event) => event.preventDefault());

loadButton.addEventListener('click', () => {
  loadPdf(pdfInput.value);
});

onResize();
loadPdf(pdfInput.value);
animate();
