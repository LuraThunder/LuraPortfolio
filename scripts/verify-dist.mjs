import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const projects = JSON.parse(await readFile("src/data/projects.json", "utf8"));
const contactHtmlPath = path.join(root, "contact", "index.html");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function resolveRequest(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const directPath = path.join(root, relativePath);
  if (path.extname(directPath)) return directPath;
  return path.join(directPath, "index.html");
}

const requiredFiles = [
  path.join(root, "index.html"),
  path.join(root, "work", "index.html"),
  path.join(root, "about", "index.html"),
  contactHtmlPath,
  ...projects.map((project) => path.join(root, project.slug, "index.html")),
];

for (const file of requiredFiles) {
  if (!(await exists(file))) {
    throw new Error(`Missing generated file: ${path.relative(process.cwd(), file)}`);
  }
}

const generatedTextFiles = (await walk(root)).filter((file) =>
  [".html", ".css", ".js"].includes(path.extname(file).toLowerCase()),
);

for (const file of generatedTextFiles) {
  const content = await readFile(file, "utf8");
  if (content.includes("cdn.myportfolio.com")) {
    throw new Error(`Adobe CDN reference found in ${path.relative(process.cwd(), file)}`);
  }
}

const contactHtml = await readFile(contactHtmlPath, "utf8");
if (!contactHtml.includes("mailto:quickbrown9999@gmail.com?subject=Portfolio%20Contact")) {
  throw new Error("Contact mailto link was not generated correctly.");
}

const server = createServer(async (request, response) => {
  try {
    const filePath = resolveRequest(request.url ?? "/");
    if (!filePath.startsWith(root) || !(await exists(filePath))) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(await readFile(filePath));
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const checks = [
    ["/work", "Virtual Comfort Creation"],
    ["/contact", "quickbrown9999@gmail.com"],
    [`/${projects[0].slug}`, projects[0].title],
  ];

  for (const [urlPath, expected] of checks) {
    const response = await fetch(`${baseUrl}${urlPath}`);
    if (!response.ok) {
      throw new Error(`${urlPath} returned ${response.status}`);
    }
    const html = await response.text();
    if (!html.includes(expected)) {
      throw new Error(`${urlPath} did not contain ${expected}`);
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Verified ${requiredFiles.length} generated pages.`);
console.log("No Adobe CDN references found in generated HTML/CSS/JS.");
console.log("Contact mailto and representative local routes passed.");
