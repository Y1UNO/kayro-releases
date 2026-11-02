// Local server for the step-14 board (read-only, 127.0.0.1 only): the repository's files, the
// Steam image cache (/steam/…) and Kayro's icon cache (/icons/…). Nothing is copied or written.
// Run: node reference/planches-14/serve.mjs  →  http://localhost:4173/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROOTS = {
  "/steam/": process.env.KAYRO_STEAM_CACHE ?? "C:/Program Files (x86)/Steam/appcache/librarycache",
  "/icons/": join(process.env.APPDATA ?? "", "Kayro", "cache", "icons"),
  "/": repo,
};
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (req.method !== "GET") return res.writeHead(405).end();
  if (path === "/") return res.writeHead(302, { location: "/reference/planches-14/index.html" }).end();
  const [prefix, root] = Object.entries(ROOTS).find(([p]) => path.startsWith(p));
  const file = normalize(join(root, path.slice(prefix.length)));
  if (!file.startsWith(normalize(root) + sep) || !TYPES[extname(file).toLowerCase()]) return res.writeHead(404).end();
  let body;
  try {
    body = await readFile(file);
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] }).end(body);
}).listen(4173, "127.0.0.1", () => console.log("Planches : http://localhost:4173/"));
