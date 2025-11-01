import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const pdfjsLib = window.pdfjsLib;
if (!pdfjsLib) {
  throw new Error('pdf.js library is not loaded. Include pdf.min.js before loading pdfLoader.js');
}

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.js';

export async function loadPdfTextures(url, { scale = 2, maxPages } = {}) {
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;
  const totalPages = maxPages ? Math.min(maxPages, pdf.numPages) : pdf.numPages;
  const textures = [];
  let aspectRatio = 1;

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    aspectRatio = viewport.height / viewport.width;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    textures.push(texture);
  }

  return {
    textures,
    pageWidth: 1,
    pageHeight: aspectRatio,
  };
}

export function createBlankTexture(color = '#f5f5f5') {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
