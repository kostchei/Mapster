#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs/promises");
const path = require("path");
const vm = require("vm");
const https = require("https");

const SOURCE_URL = "https://www.aidedd.org/atlas/faerun/";
const SOURCE_PARENT_URL = new URL("../", SOURCE_URL).toString();

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirected = new URL(res.headers.location, url).toString();
          res.resume();
          resolve(fetchBuffer(redirected));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed for ${url} (${res.statusCode})`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function fetchText(url) {
  const buffer = await fetchBuffer(url);
  return buffer.toString("utf8");
}

async function fetchTextWithFallback(urls) {
  let lastError;
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      return { url, text };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Failed to fetch text with fallback URLs.");
}

function candidateUrls(src) {
  return [
    new URL(src, SOURCE_URL).toString(),
    new URL(src, SOURCE_PARENT_URL).toString()
  ];
}

function looksLikeHtml(buffer) {
  const head = buffer.subarray(0, 256).toString("utf8").toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
}

function looksLikeRasterImage(buffer) {
  if (buffer.length < 12) {
    return false;
  }
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  return isJpeg || isPng;
}

function extractScriptSources(html) {
  const srcs = [];
  const regex = /<script[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
  let match = regex.exec(html);
  while (match) {
    srcs.push(match[1]);
    match = regex.exec(html);
  }
  return srcs;
}

function toCsvRow(cells) {
  return cells
    .map((cell) => {
      const value = cell == null ? "" : String(cell);
      return `"${value.replaceAll('"', '""')}"`;
    })
    .join(",");
}

async function main() {
  const root = process.cwd();
  const outDir = path.resolve(root, "atlas");
  const sourceDir = path.join(outDir, "source");

  await fs.mkdir(sourceDir, { recursive: true });

  const html = await fetchText(SOURCE_URL);
  await fs.writeFile(path.join(sourceDir, "faerun.html"), html, "utf8");

  const scriptSrcs = extractScriptSources(html);
  const dataSrc = scriptSrcs.find((src) => /dataF\.js/i.test(src));
  const functionsSrc = scriptSrcs.find((src) => /fonctions\.js/i.test(src));

  if (!dataSrc) {
    throw new Error("Could not locate dataF.js in source HTML.");
  }

  const dataResult = await fetchTextWithFallback(candidateUrls(dataSrc));
  let dataUrl = dataResult.url;
  let dataToExecute = dataResult.text;
  if (dataToExecute.trimStart().startsWith("<")) {
    const directDataUrl = new URL("dataF.js", SOURCE_PARENT_URL).toString();
    dataToExecute = await fetchText(directDataUrl);
    dataUrl = directDataUrl;
    if (dataToExecute.trimStart().startsWith("<")) {
      throw new Error("dataF.js fetch returned HTML for all tried URLs.");
    }
  }
  await fs.writeFile(path.join(sourceDir, "dataF.js"), dataToExecute, "utf8");

  let functionsUrl = null;
  if (functionsSrc) {
    const functionsResult = await fetchTextWithFallback(candidateUrls(functionsSrc));
    functionsUrl = functionsResult.url;
    let functionsJs = functionsResult.text;
    if (functionsJs.trimStart().startsWith("<")) {
      const directFunctionsUrl = new URL("fonctions.js", SOURCE_PARENT_URL).toString();
      functionsJs = await fetchText(directFunctionsUrl);
      functionsUrl = directFunctionsUrl;
    }
    await fs.writeFile(path.join(sourceDir, "fonctions.js"), functionsJs, "utf8");
  }

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(dataToExecute, sandbox, { filename: "dataF.js" });

  const legendEntries = (sandbox.groupe || [])
    .filter((item) => item.name === "GROUP")
    .map((item) => ({
      color: item.color,
      label: item.txt
    }));
  const legendByColor = new Map(legendEntries.map((entry) => [entry.color, entry.label]));

  const markers = (sandbox.groupe || [])
    .filter((item) => item.name !== "GROUP")
    .map((item) => ({
      name: item.name,
      x: item.x,
      y: item.y,
      color: item.color,
      category: legendByColor.get(item.color) || "Uncategorized",
      detailType: item.t ?? 0,
      textHtml: item.txt || "",
      imageHtml: item.img || ""
    }));

  const pixelsPerMile = Number(sandbox.factorDist);
  const milesPerPixel = 1 / pixelsPerMile;
  const kmPerMile = 1.609344;

  const mapMeta = {
    mapId: sandbox.carte,
    author: sandbox.auteur,
    image: sandbox.image,
    imageMobile: sandbox.imageMob,
    mini: sandbox.mini,
    imageW: sandbox.imageW,
    imageH: sandbox.imageH,
    zoomMaxDesktop: sandbox.zoomMax,
    zoomMaxMobile: sandbox.zoomCelMax
  };

  const scaleMeta = {
    pixelsPerMile,
    milesPerPixel,
    pixelsPerKm: pixelsPerMile / kmPerMile,
    kmPerPixel: milesPerPixel * kmPerMile,
    sourceNote: "AideDD dataF.js: `factorDist` and comment `1052 px = 500 miles`",
    mapWidthMiles: sandbox.imageW * milesPerPixel,
    mapHeightMiles: sandbox.imageH * milesPerPixel
  };

  const imageCandidates = candidateUrls(`images/${sandbox.image}`);
  let mapImageBuffer;
  for (const imageUrl of imageCandidates) {
    try {
      const candidate = await fetchBuffer(imageUrl);
      if (looksLikeHtml(candidate) || !looksLikeRasterImage(candidate)) {
        continue;
      }
      mapImageBuffer = candidate;
      break;
    } catch {
      // try next candidate
    }
  }
  if (!mapImageBuffer) {
    throw new Error(`Could not download map image: ${sandbox.image}`);
  }
  await fs.writeFile(path.join(outDir, sandbox.image), mapImageBuffer);

  const components = {
    extractedAtUtc: new Date().toISOString(),
    source: {
      page: SOURCE_URL,
      dataJs: dataUrl,
      functionsJs: functionsUrl
    },
    map: mapMeta,
    scale: scaleMeta,
    legend: legendEntries,
    zones: sandbox.zones || [],
    markers
  };

  await fs.writeFile(path.join(outDir, "components.json"), JSON.stringify(components, null, 2), "utf8");

  const markerCsvLines = [
    toCsvRow(["name", "x", "y", "category", "color", "detailType"]),
    ...markers.map((m) => toCsvRow([m.name, m.x, m.y, m.category, m.color, m.detailType]))
  ];
  await fs.writeFile(path.join(outDir, "markers.csv"), markerCsvLines.join("\n"), "utf8");

  console.log("Extracted atlas assets and components:");
  console.log(`- ${path.join(outDir, "components.json")}`);
  console.log(`- ${path.join(outDir, "markers.csv")}`);
  console.log(`- ${path.join(outDir, sandbox.image)}`);
  console.log(`Scale: ${pixelsPerMile.toFixed(3)} px/mile (${milesPerPixel.toFixed(6)} miles/px)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
