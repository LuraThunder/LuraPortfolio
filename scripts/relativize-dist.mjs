import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import projects from "../src/data/projects.json" with { type: "json" };

const root = path.resolve("dist");
const routes = new Set(["/", "/about", "/work", "/contact", ...projects.map((project) => `/${project.slug}`)]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativePrefix(file) {
  const relativeDir = path.relative(root, path.dirname(file)).replaceAll("\\", "/");
  if (!relativeDir) return "";
  return "../".repeat(relativeDir.split("/").length);
}

function rewriteTarget(target, prefix) {
  const cleanTarget = target.replace(/\/$/, "");
  if (target.startsWith("/assets/") || target.startsWith("/_astro/") || target === "/favicon.svg") {
    return `${prefix}${target.replace(/^\/+/, "")}`;
  }
  if (routes.has(cleanTarget || "/")) {
    if (cleanTarget === "") return prefix || "./";
    return `${prefix}${cleanTarget.replace(/^\/+/, "")}/`;
  }
  return target;
}

function rewriteHtml(content, prefix) {
  let next = content.replace(/\b(href|src)=(["'])\/([^"'#][^"']*)\2/g, (match, attr, quote, target) => {
    const rewritten = rewriteTarget(`/${target}`, prefix);
    return `${attr}=${quote}${rewritten}${quote}`;
  });

  next = next.replace(/url\(&#34;\/([^&#]+)&#34;\)/g, (_match, target) => {
    return `url(&#34;${rewriteTarget(`/${target}`, prefix)}&#34;)`;
  });

  next = next.replace(/url\((["']?)\/([^"')]+)\1\)/g, (_match, quote, target) => {
    return `url(${quote}${rewriteTarget(`/${target}`, prefix)}${quote})`;
  });

  return next;
}

await stat(root);

const files = await walk(root);
for (const file of files) {
  const prefix = relativePrefix(file);
  const content = await readFile(file, "utf8");
  await writeFile(file, rewriteHtml(content, prefix));
}

console.log(`Relativized ${files.length} generated HTML files.`);
