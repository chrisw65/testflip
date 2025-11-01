#!/usr/bin/env node
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import process from 'node:process';

const DEFAULT_PORT = 4173;
const root = resolve(process.cwd(), 'public');
const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const port = Number(process.env.PORT ?? portArg ?? DEFAULT_PORT);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function isPathInside(parent, child) {
  const resolvedParent = parent.endsWith(sep) ? parent : parent + sep;
  const resolvedChild = resolve(child);
  return resolvedChild === parent || resolvedChild.startsWith(resolvedParent);
}

async function resolveFilePath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const stripped = safePath.replace(/^\/+/, '');
  const candidate = join(root, stripped);
  const resolvedCandidate = resolve(candidate);

  if (!isPathInside(root, resolvedCandidate)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  let filePath = resolvedCandidate;
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    stats = undefined;
  }

  if (stats?.isDirectory()) {
    filePath = join(filePath, 'index.html');
    stats = await stat(filePath).catch(() => undefined);
  }

  if (!stats) {
    const fallback = join(root, 'index.html');
    const fallbackStats = await stat(fallback).catch(() => undefined);
    if (!fallbackStats) {
      throw Object.assign(new Error('Not found'), { statusCode: 404 });
    }
    return fallback;
  }

  return filePath;
}

const server = http.createServer(async (req, res) => {
  try {
    const filePath = await resolveFilePath(req.url ?? '/');
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.pdf' ? 'public, max-age=3600' : 'public, max-age=300',
    });
    const stream = createReadStream(filePath);
    stream.on('error', (error) => {
      console.error('Stream error', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('500 Internal Server Error');
    });
    stream.pipe(res);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error(error);
    }
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${status} ${error.message || 'Error'}`);
  }
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => process.exit(0));
});
