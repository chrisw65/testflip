# WebGL Flipbook Proof of Concept

This repository contains a browser-based proof of concept for rendering a realistic, shader-driven page curl for PDF documents.
It combines **Three.js** for the WebGL scene, a custom shader for the curling animation, and **PDF.js** to rasterize PDF pages into GPU textures. The resulting component is framework-agnostic and ready to be embedded in platforms such as WordPress via a simple module wrapper.

## Project structure

```
assets/            # Source copy of the sample PDF used by the demo viewer
public/            # Static entry point (HTML/CSS/JS, including sample.pdf for default testing)
```

## Running the demo locally

1. Install dependencies required for generating the sample PDF (optional – already committed):
   ```bash
   pip install reportlab
   ```
   > The sample `assets/sample.pdf` is already included. The instruction above is only needed if you want to regenerate it.

2. Serve the `public/` directory with any static file server. Examples:
   ```bash
   # Using Python
   python -m http.server --directory public 4173

   # Using npm's serve (if available)
   npx serve public -l 4173

   # Using the bundled Node.js helper
   node serve.mjs 4173
   ```

3. Open the browser at `http://localhost:4173/` (adjust the port if you changed it). When using
   `serve.mjs` you can also set a port via `PORT=5000 node serve.mjs`.

4. The viewer automatically loads the bundled sample document on start. When it finishes you will
   see a status message showing how many pages were detected. To try another PDF, paste its URL in
   the field and press **Load PDF** — the path is resolved relative to the current page, so both
   absolute URLs and local paths work. Pages are rendered at ~2.2× device pixel ratio for crisp
   textures while keeping GPU memory in check. Drag from the right or left edge of the book to flip
   forward and backward.

## Embedding in WordPress (or any site)

Because the flipbook is written as vanilla ES modules, you can bundle it with your preferred toolchain and expose an initialization function. For WordPress you might:

1. Bundle the modules (for example with Vite, Rollup, or webpack) into a single ES module.
2. Register a shortcode or block that outputs the container markup (`<div class="flipbook"></div>`) plus the script loader.
3. Pass the PDF URL via data attributes or shortcode attributes.

The component only relies on Three.js and PDF.js, both loaded from CDNs in the demo. In production you can self-host them or include them in your build for cache control.

## Customisation points

- **Page physics** – tweak `uLift`, `uShadowStrength`, and the curl easing in `public/pageCurlMaterial.js` to change how the page bends and how shadows behave.
- **Performance** – adjust the plane subdivision in `public/app.js` (currently `90 × 36`) and the PDF rendering scale in `loadPdfTextures` for different quality/performance trade-offs.
- **Textures** – extend `loadPdfTextures` in `public/pdfLoader.js` to support streaming or incremental loading if dealing with very large PDFs.
- **Interaction** – hook additional UI or events into the pointer handlers in `public/app.js` (e.g. page indicators, analytics, etc.).

## License

This proof of concept is provided under the MIT License (see `LICENSE`).
