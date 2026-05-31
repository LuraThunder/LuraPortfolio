import { createServer } from "node:http";
import { readFile, stat, appendFile } from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const root = path.resolve("dist");
const host = args.get("--host") ?? "127.0.0.1";
const port = Number(args.get("--port") ?? "4321");
const logFile = args.get("--log") ? path.resolve(args.get("--log")) : undefined;

async function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  if (logFile) {
    await appendFile(logFile, line);
    return;
  }
  console.log(message);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function resolveRequest(urlPath) {
  const cleanPath = decodeURIComponent((urlPath ?? "/").split("?")[0]);
  const relativePath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const directPath = path.resolve(root, relativePath);
  if (!directPath.startsWith(root)) return undefined;
  if (path.extname(directPath)) return directPath;
  return path.join(directPath, "index.html");
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequest(request.url);
  if (!filePath || !(await exists(filePath))) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": contentType(filePath) });
  response.end(await readFile(filePath));
});

server.on("error", async (error) => {
  await log(`failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, async () => {
  await log(`serving ${root} at http://${host}:${port}/work`);
});
