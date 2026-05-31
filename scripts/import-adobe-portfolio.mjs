import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_ORIGIN = "https://quickbrown.net";
const PUBLIC_DIR = path.resolve("public");
const ASSET_DIR = path.join(PUBLIC_DIR, "assets");
const PROJECT_ASSET_DIR = path.join(ASSET_DIR, "projects");
const DATA_DIR = path.resolve("src", "data");
const CONCURRENCY = 4;

const siteDescription =
  "Luraは、Unityリアルタイムでの3DCG空間制作を得意とする背景デザイナー。VR住空間デザイン、イベント会場、アートディレクション、モデリング制作から最適化までを一貫して対応。PCVR, Quest, モバイル端末, WebGLに対応可能。";

const siteKeywords = [
  "3DCG",
  "Unity",
  "リアルタイム",
  "VR",
  "VR住空間",
  "イベント会場",
  "アートディレクション",
  "モデリング",
  "最適化",
  "PCVR",
  "Quest",
  "モバイル端末",
  "メタバース",
  "WebGL",
];

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 QuickbrownPortfolioImporter/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function cleanInlineHtml(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function firstMatch(input, pattern) {
  return input.match(pattern)?.[1]?.trim() ?? "";
}

function extractMeta(html, propertyOrName) {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(
    html,
    new RegExp(
      `<meta\\s+(?:name|property)=["']${escaped}["']\\s+content=["']([^"']+)["']`,
      "i",
    ),
  );
}

function getExtension(url) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ext || ".jpg";
}

function absoluteUrl(url) {
  return new URL(url, SOURCE_ORIGIN).toString();
}

function localPublicPath(filePath) {
  const normalized = filePath.replaceAll(path.sep, "/");
  const marker = "/public/";
  const index = normalized.lastIndexOf(marker);
  if (index === -1) {
    throw new Error(`Expected path under public: ${filePath}`);
  }
  return normalized.slice(index + marker.length - 1);
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 QuickbrownPortfolioImporter/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
  return localPublicPath(destination);
}

async function runLimited(items, worker) {
  const queue = items.map((item, index) => ({ item, index }));
  const results = new Array(items.length);
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const { item, index } = queue.shift();
      results[index] = await worker(item, index);
    }
  });
  await Promise.all(workers);
  return results;
}

function extractCoverEntries(workHtml) {
  const coverBlocks = [...workHtml.matchAll(/<a class="project-cover[\s\S]*?<\/a>/g)].map(
    (match) => match[0],
  );

  return coverBlocks.map((block) => {
    const slug = firstMatch(block, /href="\/([^"]+)"/i);
    const title = cleanInlineHtml(
      firstMatch(block, /<div class="title preserve-whitespace">([\s\S]*?)<\/div>/i),
    );
    const description = cleanInlineHtml(
      firstMatch(block, /<div class="description">([\s\S]*?)<\/div>/i),
    );
    const year = cleanInlineHtml(firstMatch(block, /<div class="date">([\s\S]*?)<\/div>/i));
    const coverUrl = absoluteUrl(
      firstMatch(block, /data-src="([^"]+)"/i) || firstMatch(block, /src="([^"]+)"/i),
    );

    return { slug, title, description, year, coverUrl };
  });
}

async function extractHeroImage(workHtml) {
  const cssUrl = [...workHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
    .map((match) => match[1])
    .find((href) => href.includes("cdn.myportfolio.com"));

  if (!cssUrl) {
    return "";
  }

  const cssText = await fetchText(cssUrl);
  const heroImage = firstMatch(
    cssText,
    /\.masthead\s*\{[\s\S]*?background-image\s*:\s*url\("([^"]+)"\)/i,
  );

  return heroImage ? absoluteUrl(heroImage) : "";
}

function extractTextModules(pageHtml) {
  return [...pageHtml.matchAll(/<div class="project-module module text[\s\S]*?<div class="rich-text[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/g)]
    .map((match) => cleanInlineHtml(match[1]))
    .filter(Boolean);
}

function extractPageImages(pageHtml) {
  const imageUrls = [];

  for (const match of pageHtml.matchAll(/data-src="(https:\/\/cdn\.myportfolio\.com[^"]+)"/g)) {
    const url = absoluteUrl(decodeEntities(match[1]));
    if (!url.includes("data:image")) {
      imageUrls.push(url);
    }
  }

  return [...new Set(imageUrls)];
}

async function importProject(entry) {
  const html = await fetchText(`${SOURCE_ORIGIN}/${entry.slug}`);
  const title =
    cleanInlineHtml(firstMatch(html, /<h1 class="title[^"]*">([\s\S]*?)<\/h1>/i)) ||
    entry.title;
  const description =
    cleanInlineHtml(firstMatch(html, /<p class="description">([\s\S]*?)<\/p>/i)) ||
    entry.description;
  const body = extractTextModules(html).join("\n\n");
  const imageUrls = extractPageImages(html).filter((url) => url !== entry.coverUrl);
  const projectDir = path.join(PROJECT_ASSET_DIR, entry.slug);
  const coverPath = path.join(projectDir, `cover${getExtension(entry.coverUrl)}`);
  const cover = await download(entry.coverUrl, coverPath);

  const gallery = await runLimited(imageUrls, async (url, index) => {
    const imagePath = path.join(
      projectDir,
      `gallery-${String(index + 1).padStart(2, "0")}${getExtension(url)}`,
    );
    const src = await download(url, imagePath);
    return {
      src,
      alt: `${title} ${index + 1}`,
    };
  });

  return {
    slug: entry.slug,
    title,
    year: entry.year,
    description,
    body,
    cover,
    gallery,
  };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(ASSET_DIR, { recursive: true });

  const workHtml = await fetchText(`${SOURCE_ORIGIN}/work`);
  const aboutHtml = await fetchText(`${SOURCE_ORIGIN}/about`);
  const coverEntries = extractCoverEntries(workHtml);

  const logoUrl = absoluteUrl(
    firstMatch(workHtml, /<img src="([^"]+)" alt="Quickbrown">/i),
  );
  const ogImageUrl = absoluteUrl(extractMeta(workHtml, "og:image"));
  const aboutImageUrl = absoluteUrl(
    firstMatch(aboutHtml, /data-src="(https:\/\/cdn\.myportfolio\.com[^"]+)"/i),
  );
  const heroImageUrl = await extractHeroImage(workHtml);
  const aboutBody = extractTextModules(aboutHtml).join("\n\n");

  const [logo, ogImage, aboutImage, heroImage] = await Promise.all([
    download(logoUrl, path.join(ASSET_DIR, "brand", `quickbrown-logo${getExtension(logoUrl)}`)),
    download(ogImageUrl, path.join(ASSET_DIR, "brand", `og-image${getExtension(ogImageUrl)}`)),
    download(aboutImageUrl, path.join(ASSET_DIR, "about", `lura${getExtension(aboutImageUrl)}`)),
    heroImageUrl
      ? download(heroImageUrl, path.join(ASSET_DIR, "brand", `hero${getExtension(heroImageUrl)}`))
      : "",
  ]);

  const projects = await runLimited(coverEntries, importProject);
  projects.sort(
    (a, b) =>
      coverEntries.findIndex((entry) => entry.slug === a.slug) -
      coverEntries.findIndex((entry) => entry.slug === b.slug),
  );

  const site = {
    title: "Quickbrown",
    tagline: "Virtual Comfort Creation",
    subtagline: "For People Living in Virtual Reality",
    description: siteDescription,
    keywords: siteKeywords,
    canonicalOrigin: SOURCE_ORIGIN,
    googleAnalyticsId: "G-RMRDGRRCVZ",
    logo,
    ogImage,
    heroImage,
    aboutImage,
    contactEmail: "quickbrown9999@gmail.com",
    twitterUrl: "https://twitter.com/Lu_Ra_999",
    footerText: "Quickbrown\n+\nVirtual Fox Design Studio",
    aboutBody,
  };

  await writeFile(path.join(DATA_DIR, "site.json"), `${JSON.stringify(site, null, 2)}\n`);
  await writeFile(path.join(DATA_DIR, "projects.json"), `${JSON.stringify(projects, null, 2)}\n`);

  console.log(`Imported ${projects.length} projects.`);
  console.log(`Saved data to ${path.relative(process.cwd(), DATA_DIR)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
