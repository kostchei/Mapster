#!/usr/bin/env node
"use strict";

const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "Examples", "tiles");
const PREVIEW_PATH = path.join(ROOT, "Examples", "hex-type-preview.svg");
const NOTES_PATH = path.join(ROOT, "Examples", "hex-rebuild-notes.md");

const TILE_W = 240;
const TILE_H = 220;
const CX = TILE_W / 2;
const CY = TILE_H / 2;
const R = 92;
const VARIANTS = [1, 2, 3];

const TYPES = [
  { key: "heartlands", label: "Heartlands (Farmland)" },
  { key: "city", label: "City (Urban/Suburban)" },
  { key: "dungeon", label: "Dungeon / Ruin / Tower" },
  { key: "forest", label: "Forest" },
  { key: "desert", label: "Calisham (Desert)" },
  { key: "ice", label: "Ice" },
  { key: "water", label: "Water" },
  { key: "mountains", label: "Mountains (incl. Hills)" }
];

function hexPoints(cx, cy, r) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 180) * (60 * i);
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points;
}

function pointsToString(points) {
  return points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
}

function wrapTile({ label, content }) {
  const points = pointsToString(hexPoints(CX, CY, R));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}">
  <rect x="0" y="0" width="${TILE_W}" height="${TILE_H}" fill="#fff"/>
  <polygon points="${points}" fill="#fff" stroke="#111" stroke-width="2"/>
  <g clip-path="url(#clipHex)">
    ${content}
  </g>
  <polygon points="${points}" fill="none" stroke="#111" stroke-width="2"/>
  <text x="${CX}" y="${TILE_H - 12}" font-family="Segoe UI, Arial, sans-serif" font-size="13" text-anchor="middle" fill="#111">${label}</text>
  <defs>
    <clipPath id="clipHex">
      <polygon points="${points}"/>
    </clipPath>
  </defs>
</svg>
`;
}

function farmlandContent(variant) {
  const ySets = {
    1: [60, 79, 99, 117, 136],
    2: [58, 74, 93, 114, 132, 149],
    3: [64, 84, 102, 120, 138]
  };
  const fieldSets = {
    1: [
      [62, 70, 28, 22],
      [112, 86, 26, 20],
      [152, 66, 30, 26]
    ],
    2: [
      [52, 68, 24, 18],
      [86, 84, 30, 24],
      [128, 74, 26, 20],
      [162, 92, 22, 18]
    ],
    3: [
      [58, 88, 30, 24],
      [102, 68, 24, 18],
      [136, 88, 24, 22],
      [166, 70, 20, 18]
    ]
  };

  const lines = ySets[variant]
    .map((y) => `<path d="M 32 ${y} C 70 ${y - 12}, 120 ${y - 10}, 208 ${y}"/>`)
    .join("\n");
  const fields = fieldSets[variant]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`)
    .join("\n");

  return `
  <rect x="30" y="45" width="180" height="130" fill="#f6f6f6"/>
  <g stroke="#555" stroke-width="1" fill="none">${lines}</g>
  <g stroke="#222" stroke-width="1.2" fill="none">${fields}</g>`;
}

function cityContent(variant) {
  const blocks = {
    1: [
      [55, 62, 20, 20], [86, 58, 26, 26], [122, 64, 20, 18], [154, 56, 30, 28],
      [60, 96, 24, 20], [96, 94, 18, 22], [124, 94, 36, 20], [72, 126, 24, 22],
      [108, 124, 20, 22], [142, 122, 30, 24]
    ],
    2: [
      [52, 60, 24, 24], [84, 64, 20, 18], [112, 58, 22, 22], [142, 62, 22, 20],
      [170, 58, 20, 24], [58, 94, 20, 18], [84, 90, 32, 22], [124, 94, 20, 18],
      [150, 92, 34, 20], [70, 122, 22, 20], [98, 120, 24, 24], [130, 126, 22, 18]
    ],
    3: [
      [56, 58, 28, 22], [90, 56, 18, 24], [116, 60, 30, 20], [152, 56, 20, 24],
      [60, 88, 22, 22], [90, 90, 22, 18], [120, 88, 18, 24], [146, 90, 34, 22],
      [72, 120, 24, 22], [104, 120, 20, 20], [132, 118, 20, 22], [158, 122, 20, 18]
    ]
  };
  const roads = {
    1: ["M 40 90 L 200 90", "M 44 118 L 198 118"],
    2: ["M 42 84 L 198 84", "M 38 112 L 202 112", "M 52 140 L 188 140"],
    3: ["M 50 84 L 194 84", "M 44 110 L 200 110", "M 48 138 L 196 138"]
  };
  const blockMarkup = blocks[variant]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`)
    .join("\n");
  const roadsMarkup = roads[variant].map((d) => `<path d="${d}"/>`).join("\n");

  return `
  <rect x="36" y="46" width="168" height="126" fill="#f8f8f8"/>
  <g stroke="#111" stroke-width="1.6" fill="#fff">${blockMarkup}</g>
  <g stroke="#444" stroke-width="1.2" fill="none">${roadsMarkup}</g>`;
}

function dungeonContent(variant) {
  const rooms = {
    1: `<rect x="86" y="86" width="70" height="48"/><rect x="102" y="100" width="18" height="20"/><rect x="128" y="100" width="16" height="20"/><circle cx="121" cy="80" r="9" fill="#fff"/>`,
    2: `<rect x="74" y="82" width="92" height="52"/><rect x="88" y="96" width="22" height="22"/><rect x="118" y="90" width="16" height="18"/><rect x="140" y="98" width="18" height="20"/><circle cx="122" cy="76" r="8" fill="#fff"/>`,
    3: `<rect x="80" y="84" width="82" height="50"/><rect x="94" y="98" width="16" height="20"/><rect x="116" y="94" width="20" height="16"/><rect x="142" y="100" width="14" height="18"/><circle cx="120" cy="78" r="10" fill="#fff"/>`
  };
  const hatchTilt = variant === 1 ? 0 : variant === 2 ? -12 : 10;

  return `
  <rect x="34" y="44" width="172" height="130" fill="#fbfbfb"/>
  <g transform="translate(${hatchTilt},0)" stroke="#666" stroke-width="1">
    <path d="M 40 48 L 96 104"/>
    <path d="M 70 48 L 126 104"/>
    <path d="M 100 48 L 156 104"/>
    <path d="M 130 48 L 186 104"/>
  </g>
  <g stroke="#111" stroke-width="2" fill="#fff">${rooms[variant]}</g>
  <g stroke="#111" stroke-width="1.4" fill="none">
    <path d="M 92 136 L 154 136"/>
    <path d="M 92 142 L 154 142"/>
  </g>`;
}

function forestContent(variant) {
  const treeSets = {
    1: [[62, 130, 74, 100, 86, 130], [84, 138, 98, 104, 112, 138], [112, 132, 126, 96, 140, 132], [138, 140, 154, 100, 170, 140], [52, 98, 66, 66, 80, 98], [84, 96, 100, 62, 116, 96], [120, 98, 136, 64, 152, 98], [152, 102, 166, 72, 180, 102]],
    2: [[56, 132, 70, 98, 84, 132], [82, 142, 96, 110, 110, 142], [112, 136, 126, 102, 140, 136], [142, 136, 156, 102, 170, 136], [166, 140, 180, 110, 194, 140], [66, 100, 80, 68, 94, 100], [102, 102, 116, 70, 130, 102], [138, 104, 152, 74, 166, 104]],
    3: [[60, 134, 74, 104, 88, 134], [90, 136, 104, 102, 118, 136], [118, 140, 132, 106, 146, 140], [146, 134, 160, 100, 174, 134], [174, 138, 188, 106, 202, 138], [70, 98, 84, 66, 98, 98], [108, 96, 122, 64, 136, 96], [146, 98, 160, 68, 174, 98]]
  };
  const trees = treeSets[variant]
    .map(([x1, y1, x2, y2, x3, y3]) => `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}"/>`)
    .join("\n");
  const trunks = treeSets[variant]
    .slice(0, 5)
    .map((t) => {
      const midX = Math.round((t[0] + t[4]) / 2);
      return `<line x1="${midX}" y1="${t[1]}" x2="${midX}" y2="${t[1] + 12}"/>`;
    })
    .join("\n");

  return `
  <rect x="30" y="45" width="180" height="130" fill="#f7f7f7"/>
  <g stroke="#111" stroke-width="1.4" fill="#fff">${trees}</g>
  <g stroke="#111" stroke-width="1.2">${trunks}</g>`;
}

function desertContent(variant) {
  const wave = {
    1: [72, 96, 122, 146],
    2: [66, 90, 118, 142],
    3: [76, 100, 126, 150]
  };
  const lines = wave[variant]
    .map((y, i) => `<path d="M 36 ${y} C 52 ${y - 10}, 72 ${y - 14}, 92 ${y - 2} C 118 ${y + 12}, 142 ${y - 10}, 168 ${y + 2} C 186 ${y + 10}, 198 ${y - 2}, 206 ${y + 2}"/>`)
    .join("\n");
  const dots = {
    1: [[76, 84], [118, 110], [94, 136], [156, 100]],
    2: [[70, 90], [104, 118], [138, 98], [174, 126]],
    3: [[82, 92], [116, 128], [148, 106], [176, 142]]
  }[variant]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`)
    .join("\n");

  return `
  <rect x="30" y="45" width="180" height="130" fill="#fcfcfc"/>
  <g stroke="#444" stroke-width="1.2" fill="none">${lines}</g>
  <g fill="#333">${dots}</g>`;
}

function iceContent(variant) {
  const cracks = {
    1: ["M 44 74 L 84 96 L 112 82 L 146 104 L 188 90", "M 42 116 L 72 106 L 102 130 L 130 120 L 168 140", "M 56 152 L 94 136 L 126 156 L 154 146 L 184 162"],
    2: ["M 40 78 L 70 92 L 106 76 L 138 94 L 180 86", "M 46 114 L 82 104 L 114 124 L 146 118 L 176 134", "M 62 148 L 96 132 L 130 150 L 160 142 L 188 154"],
    3: ["M 42 82 L 78 98 L 112 88 L 150 110 L 190 98", "M 38 120 L 70 108 L 100 126 L 136 116 L 170 136", "M 54 150 L 88 140 L 122 160 L 154 148 L 186 160"]
  };
  const sparkle = {
    1: [[82, 84], [140, 126]],
    2: [[74, 88], [146, 120]],
    3: [[90, 92], [134, 124]]
  }[variant]
    .map(([x, y]) => `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}"/><line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}"/>`)
    .join("\n");

  return `
  <rect x="30" y="45" width="180" height="130" fill="#fafafa"/>
  <g stroke="#666" stroke-width="1.2" fill="none">${cracks[variant].map((d) => `<path d="${d}"/>`).join("\n")}</g>
  <g stroke="#111" stroke-width="1">${sparkle}</g>`;
}

function waterContent(variant) {
  const phase = variant === 1 ? 0 : variant === 2 ? 10 : -10;
  const ys = [72, 98, 124, 150];
  const lines = ys
    .map((y) => {
      const a = y + phase;
      const b = y + 12 + phase;
      return `<path d="M 36 ${a} C 50 ${a - 12}, 64 ${a - 12}, 78 ${a} C 92 ${b}, 106 ${b}, 120 ${a} C 134 ${a - 12}, 148 ${a - 12}, 162 ${a} C 176 ${b}, 190 ${b}, 204 ${a}"/>`;
    })
    .join("\n");

  return `
  <rect x="30" y="45" width="180" height="130" fill="#fafafa"/>
  <g stroke="#111" stroke-width="1.4" fill="none">${lines}</g>`;
}

function mountainContent(variant) {
  const peaks = {
    1: [[48, 146, 76, 92, 104, 146], [86, 146, 122, 76, 158, 146], [136, 146, 166, 96, 196, 146]],
    2: [[44, 148, 72, 102, 100, 148], [78, 148, 112, 82, 146, 148], [120, 148, 152, 90, 184, 148], [156, 148, 182, 106, 208, 148]],
    3: [[52, 148, 82, 96, 112, 148], [94, 148, 126, 78, 158, 148], [142, 148, 172, 92, 202, 148]]
  };
  const ridges = {
    1: [[61, 122, 75, 102], [100, 122, 120, 90], [146, 122, 164, 102]],
    2: [[58, 126, 72, 108], [94, 124, 110, 94], [132, 126, 150, 98], [170, 126, 182, 112]],
    3: [[66, 124, 80, 106], [108, 124, 124, 90], [154, 124, 170, 100]]
  };

  return `
  <rect x="30" y="45" width="180" height="130" fill="#f8f8f8"/>
  <g stroke="#111" stroke-width="1.6" fill="#fff">
    ${peaks[variant].map((p) => `<polygon points="${p[0]},${p[1]} ${p[2]},${p[3]} ${p[4]},${p[5]}"/>`).join("\n")}
  </g>
  <g stroke="#555" stroke-width="1.2" fill="none">
    ${ridges[variant].map((r) => `<path d="M ${r[0]} ${r[1]} L ${r[2]} ${r[3]}"/>`).join("\n")}
  </g>`;
}

function tileContent(key, variant) {
  switch (key) {
    case "heartlands": return farmlandContent(variant);
    case "city": return cityContent(variant);
    case "dungeon": return dungeonContent(variant);
    case "forest": return forestContent(variant);
    case "desert": return desertContent(variant);
    case "ice": return iceContent(variant);
    case "water": return waterContent(variant);
    case "mountains": return mountainContent(variant);
    default: return `<rect x="30" y="45" width="180" height="130" fill="#fff"/>`;
  }
}

function previewSheet(tiles) {
  const cols = 6;
  const rows = Math.ceil(tiles.length / cols);
  const cellW = 250;
  const cellH = 230;
  const pad = 18;
  const w = cols * cellW + pad * 2;
  const h = rows * cellH + pad * 2 + 28;

  const groups = tiles
    .map((tile, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * cellW;
      const y = pad + row * cellH + 28;
      return `<g transform="translate(${x},${y})">${tile.body}</g>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>
  <text x="${pad}" y="22" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#111">Mapster 8-Type Hex Content Examples (3 Variants Each, Low-Ink B/W)</text>
  ${groups}
</svg>
`;
}

function extractBody(svg) {
  const start = svg.indexOf(">") + 1;
  const end = svg.lastIndexOf("</svg>");
  return svg.slice(start, end).trim();
}

async function writeNotes() {
  const text = `# Hex Rebuild Feasibility (6-mile Flat-Top)

Yes, the map can be rebuilt as majority-terrain hexes at 6-mile scale.

## Suggested Process

1. Build 6-mile hex grid from source scale (\`2.104 px = 1 mile\`).
2. For each hex, estimate terrain coverage from map image and/or metadata.
3. Assign dominant type (or weighted tie-break rule).
4. Render each hex with one of 8 terrain classes and rotate among 3 variants per class to avoid visual repetition.
5. Keep place names as vector text labels on top (not baked into raster), so zoom stays sharp.

## What This Folder Contains

- \`tiles/*.svg\`: 24 tile examples (\`8 types x 3 variants\`).
- \`hex-type-preview.svg\`: overview sheet of all variants.

`;
  await fs.writeFile(NOTES_PATH, text, "utf8");
}

async function clearOldSvgTiles() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const entries = await fs.readdir(OUT_DIR);
  await Promise.all(
    entries
      .filter((name) => name.toLowerCase().endsWith(".svg"))
      .map((name) => fs.unlink(path.join(OUT_DIR, name)))
  );
}

async function main() {
  await clearOldSvgTiles();

  const rendered = [];
  for (const type of TYPES) {
    for (const variant of VARIANTS) {
      const svg = wrapTile({
        label: `${type.label} v${variant}`,
        content: tileContent(type.key, variant)
      });
      const file = path.join(OUT_DIR, `${type.key}-v${variant}.svg`);
      await fs.writeFile(file, svg, "utf8");
      rendered.push({ key: `${type.key}-v${variant}`, body: extractBody(svg) });
    }
  }

  await fs.writeFile(PREVIEW_PATH, previewSheet(rendered), "utf8");
  await writeNotes();

  console.log(`Wrote ${TYPES.length * VARIANTS.length} tile SVGs to ${OUT_DIR}`);
  console.log(`Wrote preview: ${PREVIEW_PATH}`);
  console.log(`Wrote notes: ${NOTES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

