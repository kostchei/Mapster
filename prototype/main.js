const SQRT3 = Math.sqrt(3);
const SIGHT_RADIUS = 3;
const HEX_MILES = 6;
const PLAYER_POI_STORAGE_KEY = "mapster_player_pois";
const GM_POI_STORAGE_KEY = "mapster_gm_pois";
const LEGACY_PLAYER_PIN_STORAGE_KEY = "mapster_player_pins";
const LEGACY_GM_PIN_STORAGE_KEY = "mapster_gm_pin";
const SUBMAP_BBOX = {
  x: 3839,
  y: 1351,
  w: 4090,
  h: 1537
};

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const viewModeSelect = document.getElementById("viewMode");
const showMarkersInput = document.getElementById("showMarkers");
const resetViewButton = document.getElementById("resetView");
const addPlayerPinButton = document.getElementById("addPlayerPin");
const removePlayerPinButton = document.getElementById("removePlayerPin");
const addGmPinButton = document.getElementById("addGmPin");
const removeGmPinButton = document.getElementById("removeGmPin");
const clearFogButton = document.getElementById("clearFog");
const resetFogButton = document.getElementById("resetFog");
const meta = document.getElementById("meta");
const hoverInfo = document.getElementById("hoverInfo");

const SUBHEX_SLOTS = ["nw", "n", "ne", "sw", "c", "se", "s"];

const TERRAIN_SUBHEX_TILES = {
  heartlands: [
    "hex-tile-grassland1",
    "hex-tile-grassland2",
    "hex-tile-grassland3",
    "hex-tile-grassland4"
  ],
  forest: [
    "hex-tile-forest1",
    "hex-tile-forest2",
    "hex-tile-forest3",
    "hex-tile-forest4",
    "hex-tile-forest5",
    "hex-tile-forestlight1",
    "hex-tile-forestmixed1",
    "hex-tile-forestmixed2",
    "hex-tile-forestmixed3",
    "hex-tile-forestmixed4",
    "hex-tile-evergreen1",
    "hex-tile-evergreen2",
    "hex-tile-evergreen3",
    "hex-tile-hills-forest1",
    "hex-tile-hills-forest2",
    "hex-tile-hills-forest3",
    "hex-tile-hills-evergreen1",
    "hex-tile-hills-evergreen2",
    "hex-tile-hills-evergreen3"
  ],
  desert: [
    "hex-tile-desert1",
    "hex-tile-desert2",
    "hex-tile-desert3",
    "hex-tile-badlands1",
    "hex-tile-badlands2",
    "hex-tile-badlands3"
  ],
  mountains: [
    "hex-tile-mountains1",
    "hex-tile-mountains2",
    "hex-tile-mountains3",
    "hex-tile-mountains4",
    "hex-tile-mountains-forest1",
    "hex-tile-mountains-forest2",
    "hex-tile-mountains-forest3",
    "hex-tile-mountains-evergreen1",
    "hex-tile-mountains-evergreen2",
    "hex-tile-mountains-evergreen3",
    "hex-tile-hills1",
    "hex-tile-hills2",
    "hex-tile-hills3"
  ],
  ice: [
    "hex-tile-blank"
  ]
};

function buildSubhexUrls(tileName) {
  return SUBHEX_SLOTS.map(
    (slot) => `../Examples/Hexs/subhexes/${tileName}/${tileName}--${slot}.png`
  );
}

function buildTerrainTextureUrls() {
  const out = {};
  for (const [terrain, tiles] of Object.entries(TERRAIN_SUBHEX_TILES)) {
    out[terrain] = tiles.flatMap((tile) => buildSubhexUrls(tile));
  }
  return out;
}

const CITY_ICON_URLS = [
  "../Examples/Hexs/bw town.png",
  "../Examples/Hexs/bw town large.png",
  "../Examples/Hexs/bw city hill.png",
  "../Examples/Hexs/bw city tower magic.png",
  "../Examples/Hexs/bw village farm.png"
];

const DUNGEON_ICON_URLS = [
  "../Examples/Hexs/bw castle skull.png",
  "../Examples/Hexs/bw keep small.png",
  "../Examples/Hexs/bw tower ruined.png",
  "../Examples/Hexs/bw obelisk.png",
  "../Examples/Hexs/bw pillar circle.png"
];

let components;
let sourceMapImage;
let sourceMapData;
let hydroMaskMajor = null;
let hydroMaskMinor = null;
let coastMask = null;
let hydroMaskW = 0;
let hydroMaskH = 0;
const HYDRO_MASK_SCALE = 4;

const terrainTextures = {};
let cityIcons = [];
let dungeonIcons = [];

const camera = {
  zoom: 1,
  minZoom: 0.02,
  maxZoom: 4,
  panX: 0,
  panY: 0
};

const interaction = {
  dragging: false,
  dragMode: "none",
  startX: 0,
  startY: 0,
  moved: false
};

let viewportW = window.innerWidth;
let viewportH = window.innerHeight;
let visitedHexes = new Set();
let currentHex = null;
let markerOverrideCache = new Map();
let markerHexCache = new Map();
let playerPoiHexCache = new Map();
let gmPoiHexCache = new Map();
let terrainTypeCache = new Map();
let renderQueued = false;
let playerPois = [];
let gmPois = [];
let addPinMode = null;
let removePinMode = null;
let discoveredSpecialHexes = new Set();
const hoverState = {
  inside: false,
  screenX: 0,
  screenY: 0
};

function currentMode() {
  return viewModeSelect.value === "gm" ? "gm" : "player";
}

function hexSizePx() {
  return (HEX_MILES * components.scale.pixelsPerMile) / 1.5;
}

function isInsideSubmap(x, y) {
  return (
    x >= SUBMAP_BBOX.x &&
    y >= SUBMAP_BBOX.y &&
    x <= SUBMAP_BBOX.x + SUBMAP_BBOX.w &&
    y <= SUBMAP_BBOX.y + SUBMAP_BBOX.h
  );
}

function clampToSubmap(x, y) {
  return {
    x: Math.max(SUBMAP_BBOX.x, Math.min(SUBMAP_BBOX.x + SUBMAP_BBOX.w, x)),
    y: Math.max(SUBMAP_BBOX.y, Math.min(SUBMAP_BBOX.y + SUBMAP_BBOX.h, y))
  };
}

function axialToPixel(q, r, size) {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2)
  };
}

function pixelToAxial(x, y, size) {
  return {
    q: (2 / 3) * (x / size),
    r: ((-1 / 3) * x + (SQRT3 / 3) * y) / size
  };
}

function roundAxial(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

function worldToHex(x, y, size) {
  const axial = pixelToAxial(x, y, size);
  return roundAxial(axial.q, axial.r);
}

function hexKey(q, r) {
  return `${q},${r}`;
}

function hashInt(a, b, salt = 0) {
  let h = (a * 73856093) ^ (b * 19349663) ^ (salt * 83492791);
  h ^= h >>> 13;
  h *= 1274126177;
  h ^= h >>> 16;
  return Math.abs(h);
}

function hexDistance(dq, dr) {
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - camera.panX) / camera.zoom,
    y: (sy - camera.panY) / camera.zoom
  };
}

function hexCorners(cx, cy, size) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 180) * (60 * i);
    points.push({
      x: cx + size * Math.cos(a),
      y: cy + size * Math.sin(a)
    });
  }
  return points;
}

function beginPathFromPoints(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

function viewportWorldBounds() {
  const a = screenToWorld(0, 0);
  const b = screenToWorld(viewportW, viewportH);
  return {
    xMin: Math.min(a.x, b.x),
    yMin: Math.min(a.y, b.y),
    xMax: Math.max(a.x, b.x),
    yMax: Math.max(a.y, b.y)
  };
}

function visibleHexRange(bounds, size) {
  const corners = [
    pixelToAxial(bounds.xMin, bounds.yMin, size),
    pixelToAxial(bounds.xMax, bounds.yMin, size),
    pixelToAxial(bounds.xMax, bounds.yMax, size),
    pixelToAxial(bounds.xMin, bounds.yMax, size)
  ];

  const qValues = corners.map((p) => p.q);
  const rValues = corners.map((p) => p.r);
  const pad = 4;
  return {
    qMin: Math.floor(Math.min(...qValues)) - pad,
    qMax: Math.ceil(Math.max(...qValues)) + pad,
    rMin: Math.floor(Math.min(...rValues)) - pad,
    rMax: Math.ceil(Math.max(...rValues)) + pad
  };
}

function buildVisibleSet() {
  const set = new Set();
  if (!currentHex) {
    return set;
  }
  for (let dq = -SIGHT_RADIUS; dq <= SIGHT_RADIUS; dq += 1) {
    for (let dr = -SIGHT_RADIUS; dr <= SIGHT_RADIUS; dr += 1) {
      if (hexDistance(dq, dr) <= SIGHT_RADIUS) {
        set.add(hexKey(currentHex.q + dq, currentHex.r + dr));
      }
    }
  }
  return set;
}

function revealFromHex(hex) {
  for (let dq = -SIGHT_RADIUS; dq <= SIGHT_RADIUS; dq += 1) {
    for (let dr = -SIGHT_RADIUS; dr <= SIGHT_RADIUS; dr += 1) {
      if (hexDistance(dq, dr) <= SIGHT_RADIUS) {
        visitedHexes.add(hexKey(hex.q + dq, hex.r + dr));
      }
    }
  }
}

function markSpecialHexesFromCenter(hex) {
  for (let dq = -SIGHT_RADIUS; dq <= SIGHT_RADIUS; dq += 1) {
    for (let dr = -SIGHT_RADIUS; dr <= SIGHT_RADIUS; dr += 1) {
      if (hexDistance(dq, dr) > SIGHT_RADIUS) {
        continue;
      }
      const key = hexKey(hex.q + dq, hex.r + dr);
      const t = markerOverrideCache.get(key);
      if (t === "city" || t === "dungeon") {
        discoveredSpecialHexes.add(key);
      }
    }
  }
}

function parseCategory(category) {
  const c = String(category || "").toLowerCase();
  if (c.includes("city") || c.includes("town")) {
    return "city";
  }
  if (
    c.includes("dungeon") ||
    c.includes("ruin") ||
    c.includes("castle") ||
    c.includes("tower") ||
    c.includes("site")
  ) {
    return "dungeon";
  }
  return null;
}

function htmlToPlainText(html) {
  if (!html) {
    return "";
  }
  const normalized = String(html)
    .replaceAll("<%>", "</p><p>")
    .replace(/<\/p>/gi, "</p>\n");
  const div = document.createElement("div");
  div.innerHTML = normalized;
  return (div.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function rebuildMarkerOverrideCache() {
  markerOverrideCache = new Map();
  markerHexCache = new Map();
  const size = hexSizePx();
  for (const marker of components.markers) {
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) {
      continue;
    }
    const markerType = parseCategory(marker.category);
    const h = worldToHex(marker.x, marker.y, size);
    const key = hexKey(h.q, h.r);
    const existingMarkers = markerHexCache.get(key) || [];
    existingMarkers.push({
      name: marker.name || "Unnamed marker",
      category: marker.category || "Uncategorized",
      text: htmlToPlainText(marker.textHtml || marker.imageHtml || ""),
      url: "",
      source: "map"
    });
    markerHexCache.set(key, existingMarkers);

    if (markerType) {
      const existing = markerOverrideCache.get(key);
      if (existing === "city") {
        continue;
      }
      if (!existing || markerType === "city") {
        markerOverrideCache.set(key, markerType);
      }
    }
  }
}

function normalizePoiText(text) {
  if (text == null) {
    return "";
  }
  return String(text).trim();
}

function normalizePoiUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function buildPoiFromRaw(raw, idx, fallbackPrefix) {
  if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
    return null;
  }
  const h =
    Number.isFinite(raw.q) && Number.isFinite(raw.r)
      ? { q: raw.q, r: raw.r }
      : worldToHex(raw.x, raw.y, hexSizePx());
  return {
    x: raw.x,
    y: raw.y,
    q: h.q,
    r: h.r,
    name: normalizePoiText(raw.name || raw.label) || `${fallbackPrefix} ${idx + 1}`,
    category: normalizePoiText(raw.category) || "User POI",
    text: normalizePoiText(raw.text),
    url: normalizePoiUrl(raw.url),
    createdAt: raw.createdAt || null
  };
}

function rebuildUserPoiCaches() {
  playerPoiHexCache = new Map();
  gmPoiHexCache = new Map();

  for (const poi of playerPois) {
    const key = hexKey(poi.q, poi.r);
    const list = playerPoiHexCache.get(key) || [];
    list.push(poi);
    playerPoiHexCache.set(key, list);
  }

  for (const poi of gmPois) {
    const key = hexKey(poi.q, poi.r);
    const list = gmPoiHexCache.get(key) || [];
    list.push(poi);
    gmPoiHexCache.set(key, list);
  }
}

function dedupePoisByHex(pois) {
  const byHex = new Map();
  for (const poi of pois) {
    const key = hexKey(poi.q, poi.r);
    if (byHex.has(key)) {
      byHex.delete(key);
    }
    byHex.set(key, poi);
  }
  return Array.from(byHex.values());
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hideHoverInfo() {
  hoverInfo.style.display = "none";
  hoverInfo.innerHTML = "";
}

function renderPoiRow(poi) {
  const parts = [
    `<div class="row">`,
    `<div class="name">${escapeHtml(poi.name)}</div>`,
    `<div class="cat">${escapeHtml(poi.category)}</div>`
  ];
  if (poi.text) {
    parts.push(`<div class="text">${escapeHtml(poi.text)}</div>`);
  }
  if (poi.url) {
    parts.push(`<div class="url">${escapeHtml(poi.url)}</div>`);
  }
  parts.push(`</div>`);
  return parts.join("");
}

function renderPoiTier(title, entries) {
  if (!entries.length) {
    return "";
  }
  return [
    `<div class="tier">${escapeHtml(title)}</div>`,
    entries.map((entry) => renderPoiRow(entry)).join("")
  ].join("");
}

function updateHoverInfoAtScreen(sx, sy) {
  if (!hoverState.inside) {
    hideHoverInfo();
    return;
  }

  const world = screenToWorld(sx, sy);
  if (
    world.x < 0 ||
    world.y < 0 ||
    world.x > components.map.imageW ||
    world.y > components.map.imageH ||
    !isInsideSubmap(world.x, world.y)
  ) {
    hideHoverInfo();
    return;
  }

  const h = worldToHex(world.x, world.y, hexSizePx());
  const key = hexKey(h.q, h.r);
  const mode = currentMode();
  if (mode === "player") {
    const visibleSet = buildVisibleSet();
    const isKnown = visitedHexes.has(key) || visibleSet.has(key);
    if (!isKnown) {
      hideHoverInfo();
      return;
    }
  }

  const mapPois = markerHexCache.get(key) || [];
  const playerAddedPois = playerPoiHexCache.get(key) || [];
  const gmAddedPois = mode === "gm" ? gmPoiHexCache.get(key) || [] : [];
  if (!mapPois.length && !playerAddedPois.length && !gmAddedPois.length) {
    hideHoverInfo();
    return;
  }

  hoverInfo.innerHTML = [
    renderPoiTier("Map POIs", mapPois),
    renderPoiTier("Player-added POIs", playerAddedPois),
    renderPoiTier("GM-added POIs", gmAddedPois)
  ].join("");
  hoverInfo.style.display = "block";

  const rect = hoverInfo.getBoundingClientRect();
  const margin = 10;
  let left = sx + 14;
  let top = sy + 14;

  if (left + rect.width + margin > viewportW) {
    left = sx - rect.width - 14;
  }
  if (top + rect.height + margin > viewportH) {
    top = sy - rect.height - 14;
  }

  left = Math.max(margin, Math.min(viewportW - rect.width - margin, left));
  top = Math.max(margin, Math.min(viewportH - rect.height - margin, top));

  hoverInfo.style.left = `${left}px`;
  hoverInfo.style.top = `${top}px`;
}

function refreshHoverInfo() {
  if (!hoverState.inside) {
    hideHoverInfo();
    return;
  }
  updateHoverInfoAtScreen(hoverState.screenX, hoverState.screenY);
}

function clearClassificationCaches() {
  terrainTypeCache = new Map();
  rebuildMarkerOverrideCache();
  rebuildUserPoiCaches();
}

function sampleColor(x, y) {
  const ix = Math.max(0, Math.min(components.map.imageW - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(components.map.imageH - 1, Math.round(y)));
  const idx = (iy * components.map.imageW + ix) * 4;
  return {
    r: sourceMapData[idx],
    g: sourceMapData[idx + 1],
    b: sourceMapData[idx + 2]
  };
}

function sampleMask(mask, x, y) {
  if (!mask || hydroMaskW === 0 || hydroMaskH === 0) {
    return 0;
  }
  const mx = Math.max(0, Math.min(hydroMaskW - 1, Math.floor(x / HYDRO_MASK_SCALE)));
  const my = Math.max(0, Math.min(hydroMaskH - 1, Math.floor(y / HYDRO_MASK_SCALE)));
  return mask[my * hydroMaskW + mx];
}

function rgbToHsv(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rr) {
      h = ((gg - bb) / d) % 6;
    } else if (max === gg) {
      h = (bb - rr) / d + 2;
    } else {
      h = (rr - gg) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function isBlueLike(r, g, b) {
  if (b > g + 9 && b > r + 10) {
    return true;
  }
  const hsv = rgbToHsv(r, g, b);
  if (hsv.s < 0.08 || hsv.v < 0.18) {
    return false;
  }
  return hsv.h >= 165 && hsv.h <= 255;
}

function smoothBinary(mask, w, h, iterations = 1) {
  let cur = mask;
  for (let pass = 0; pass < iterations; pass += 1) {
    const nxt = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y += 1) {
      const yw = y * w;
      for (let x = 1; x < w - 1; x += 1) {
        const i = yw + x;
        let n = 0;
        n += cur[i - w - 1];
        n += cur[i - w];
        n += cur[i - w + 1];
        n += cur[i - 1];
        n += cur[i];
        n += cur[i + 1];
        n += cur[i + w - 1];
        n += cur[i + w];
        n += cur[i + w + 1];
        nxt[i] = n >= 5 ? 1 : 0;
      }
    }
    cur = nxt;
  }
  return cur;
}

function buildHydroMasks() {
  hydroMaskW = Math.floor(components.map.imageW / HYDRO_MASK_SCALE);
  hydroMaskH = Math.floor(components.map.imageH / HYDRO_MASK_SCALE);
  const len = hydroMaskW * hydroMaskH;
  const blueRaw = new Uint8Array(len);

  for (let y = 0; y < hydroMaskH; y += 1) {
    for (let x = 0; x < hydroMaskW; x += 1) {
      const sx = Math.min(components.map.imageW - 1, x * HYDRO_MASK_SCALE + 2);
      const sy = Math.min(components.map.imageH - 1, y * HYDRO_MASK_SCALE + 2);
      const idx = (sy * components.map.imageW + sx) * 4;
      const r = sourceMapData[idx];
      const g = sourceMapData[idx + 1];
      const b = sourceMapData[idx + 2];
      blueRaw[y * hydroMaskW + x] = isBlueLike(r, g, b) ? 1 : 0;
    }
  }

  const blueSmoothed = smoothBinary(blueRaw, hydroMaskW, hydroMaskH, 2);
  hydroMaskMinor = blueSmoothed;

  const labels = new Int32Array(len);
  labels.fill(-1);
  const compAreas = [];
  const compTouchesBorder = [];
  const q = new Int32Array(len);
  let compId = 0;

  for (let i = 0; i < len; i += 1) {
    if (!blueSmoothed[i] || labels[i] !== -1) {
      continue;
    }
    let head = 0;
    let tail = 0;
    q[tail++] = i;
    labels[i] = compId;
    let area = 0;
    let touches = false;

    while (head < tail) {
      const v = q[head++];
      area += 1;
      const y = Math.floor(v / hydroMaskW);
      const x = v - y * hydroMaskW;
      if (x === 0 || y === 0 || x === hydroMaskW - 1 || y === hydroMaskH - 1) {
        touches = true;
      }

      const n1 = v - hydroMaskW;
      const n2 = v + hydroMaskW;
      const n3 = v - 1;
      const n4 = v + 1;
      if (y > 0 && blueSmoothed[n1] && labels[n1] === -1) {
        labels[n1] = compId;
        q[tail++] = n1;
      }
      if (y < hydroMaskH - 1 && blueSmoothed[n2] && labels[n2] === -1) {
        labels[n2] = compId;
        q[tail++] = n2;
      }
      if (x > 0 && blueSmoothed[n3] && labels[n3] === -1) {
        labels[n3] = compId;
        q[tail++] = n3;
      }
      if (x < hydroMaskW - 1 && blueSmoothed[n4] && labels[n4] === -1) {
        labels[n4] = compId;
        q[tail++] = n4;
      }
    }

    compAreas.push(area);
    compTouchesBorder.push(touches);
    compId += 1;
  }

  const major = new Uint8Array(len);
  const largeLakeThreshold = Math.floor((hydroMaskW * hydroMaskH) * 0.00022);
  for (let i = 0; i < len; i += 1) {
    const c = labels[i];
    if (c < 0) {
      continue;
    }
    if (compTouchesBorder[c] || compAreas[c] >= largeLakeThreshold) {
      major[i] = 1;
    }
  }

  hydroMaskMajor = smoothBinary(major, hydroMaskW, hydroMaskH, 1);

  const coast = new Uint8Array(len);
  for (let y = 1; y < hydroMaskH - 1; y += 1) {
    const yw = y * hydroMaskW;
    for (let x = 1; x < hydroMaskW - 1; x += 1) {
      const i = yw + x;
      const m = hydroMaskMajor[i];
      if (!m) {
        continue;
      }
      const neighborLand =
        !hydroMaskMajor[i - 1] ||
        !hydroMaskMajor[i + 1] ||
        !hydroMaskMajor[i - hydroMaskW] ||
        !hydroMaskMajor[i + hydroMaskW];
      if (neighborLand) {
        coast[i] = 1;
      }
    }
  }
  coastMask = coast;
}

function sampleHexStats(center, size) {
  const offsets = [
    [0, 0],
    [0.34, 0], [-0.34, 0],
    [0, 0.30], [0, -0.30],
    [0.22, 0.20], [-0.22, 0.20],
    [0.22, -0.20], [-0.22, -0.20],
    [0.56, 0.02], [-0.56, 0.02],
    [0.28, 0.44], [-0.28, 0.44],
    [0.28, -0.44], [-0.28, -0.44]
  ];

  let count = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let satSum = 0;
  let valSum = 0;

  let water = 0;
  let desert = 0;
  let forest = 0;
  let mountain = 0;
  let ice = 0;
  let hydroMajorHits = 0;
  let hydroMinorHits = 0;
  let coastHits = 0;
  let centerMajor = 0;
  let centerMinor = 0;

  for (const [ox, oy] of offsets) {
    const x = center.x + ox * size;
    const y = center.y + oy * size;
    if (x < 0 || y < 0 || x >= components.map.imageW || y >= components.map.imageH) {
      continue;
    }

    const c = sampleColor(x, y);
    const hsv = rgbToHsv(c.r, c.g, c.b);

    count += 1;
    rSum += c.r;
    gSum += c.g;
    bSum += c.b;
    satSum += hsv.s;
    valSum += hsv.v;

    if (c.b > c.r + 8 && c.b > c.g + 6) {
      water += 1;
    }
    if (c.r > 150 && c.g > 120 && c.b < 130) {
      desert += 1;
    }
    if (c.g > c.r + 10 && c.g > c.b + 10 && hsv.s > 0.12) {
      forest += 1;
    }
    if (Math.abs(c.r - c.g) < 26 && Math.abs(c.g - c.b) < 26 && hsv.v < 0.72) {
      mountain += 1;
    }
    if (hsv.s < 0.12 && hsv.v > 0.72) {
      ice += 1;
    }

    const isMajor = sampleMask(hydroMaskMajor, x, y);
    const isMinor = sampleMask(hydroMaskMinor, x, y);
    const isCoast = sampleMask(coastMask, x, y);
    hydroMajorHits += isMajor;
    hydroMinorHits += isMinor;
    coastHits += isCoast;
    if (ox === 0 && oy === 0) {
      centerMajor = isMajor;
      centerMinor = isMinor;
    }
  }

  if (count === 0) {
    return null;
  }

  return {
    count,
    avgR: rSum / count,
    avgG: gSum / count,
    avgB: bSum / count,
    avgS: satSum / count,
    avgV: valSum / count,
    waterFrac: water / count,
    waterMajorFrac: hydroMajorHits / count,
    waterMinorFrac: hydroMinorHits / count,
    coastFrac: coastHits / count,
    centerMajor,
    centerMinor,
    desertFrac: desert / count,
    forestFrac: forest / count,
    mountainFrac: mountain / count,
    iceFrac: ice / count
  };
}

function classifyByColor(q, r, center) {
  const stats = sampleHexStats(center, hexSizePx());
  if (!stats) {
    return "water";
  }

  const yNorm = center.y / components.map.imageH;

  // Hydro mask has priority: this is the coastline/sea/lake guardrail.
  if (stats.centerMajor || stats.waterMajorFrac >= 0.28) {
    return "water";
  }
  if (stats.coastFrac >= 0.18 && stats.waterMajorFrac >= 0.12) {
    return "water";
  }
  // Minor hydro catches thin rivers/channels that don't dominate area.
  if (stats.centerMinor && stats.waterMinorFrac >= 0.08) {
    return "water";
  }
  if (stats.waterMinorFrac >= 0.20) {
    return "water";
  }

  if (stats.iceFrac >= 0.38 && yNorm < 0.34) {
    return "ice";
  }
  if (stats.desertFrac >= 0.35) {
    return "desert";
  }
  if (stats.forestFrac >= 0.34) {
    return "forest";
  }
  if (stats.mountainFrac >= 0.33) {
    return "mountains";
  }

  if (stats.avgB > stats.avgR + 10 && stats.avgB > stats.avgG + 6 && stats.avgS > 0.11) {
    return "water";
  }
  if (stats.avgG > stats.avgR + 9 && stats.avgG > stats.avgB + 10 && stats.avgS > 0.12) {
    return "forest";
  }
  if (stats.avgR > 155 && stats.avgG > 125 && stats.avgB < 130 && stats.avgS > 0.15) {
    return "desert";
  }
  if (stats.avgS < 0.14 && stats.avgV < 0.70) {
    return "mountains";
  }
  if (yNorm < 0.30 && stats.avgS < 0.12 && stats.avgV > 0.72) {
    return "ice";
  }

  return "heartlands";
}

function classifyHexType(q, r) {
  const key = hexKey(q, r);
  const cached = terrainTypeCache.get(key);
  if (cached) {
    return cached;
  }

  const override = markerOverrideCache.get(key);
  if (override) {
    terrainTypeCache.set(key, override);
    return override;
  }

  const center = axialToPixel(q, r, hexSizePx());
  let type = "water";
  if (
    center.x >= 0 &&
    center.x <= components.map.imageW &&
    center.y >= 0 &&
    center.y <= components.map.imageH
  ) {
    type = classifyByColor(q, r, center);
  }

  terrainTypeCache.set(key, type);
  return type;
}

function pickVariant(images, q, r, salt) {
  if (!images || images.length === 0) {
    return null;
  }
  const i = hashInt(q, r, salt) % images.length;
  return images[i];
}

function drawClippedImage(corners, image, center, size, alpha = 1) {
  if (!image) {
    return;
  }
  const h = SQRT3 * size;
  ctx.save();
  beginPathFromPoints(corners);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, center.x - size, center.y - h / 2, size * 2, h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawWaterPattern(corners, center, size, alpha = 1) {
  ctx.save();
  beginPathFromPoints(corners);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#f5f5f5";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 0.8 / camera.zoom;
  for (let k = -2; k <= 2; k += 1) {
    const y = center.y + k * (size * 0.38);
    ctx.beginPath();
    ctx.moveTo(center.x - size * 1.05, y);
    ctx.bezierCurveTo(
      center.x - size * 0.55,
      y - size * 0.18,
      center.x - size * 0.1,
      y + size * 0.18,
      center.x + size * 0.3,
      y
    );
    ctx.bezierCurveTo(
      center.x + size * 0.55,
      y - size * 0.18,
      center.x + size * 0.82,
      y + size * 0.12,
      center.x + size * 1.1,
      y
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawIceCracks(corners, center, size, alpha = 1) {
  ctx.save();
  beginPathFromPoints(corners);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 0.9 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.95, center.y - size * 0.2);
  ctx.lineTo(center.x - size * 0.3, center.y + size * 0.05);
  ctx.lineTo(center.x + size * 0.25, center.y - size * 0.1);
  ctx.lineTo(center.x + size * 0.95, center.y + size * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.65, center.y + size * 0.45);
  ctx.lineTo(center.x - size * 0.2, center.y + size * 0.25);
  ctx.lineTo(center.x + size * 0.55, center.y + size * 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTypedTerrain(corners, center, size, type, q, r, state) {
  const pale = state === "visited";
  const alpha = pale ? 0.42 : 1;

  if (type === "water") {
    drawWaterPattern(corners, center, size, alpha);
    return;
  }

  if (type === "ice") {
    const base = pickVariant(terrainTextures.ice, q, r, 17);
    drawClippedImage(corners, base, center, size, alpha);
    drawIceCracks(corners, center, size, alpha);
    return;
  }

  if (type === "city") {
    const base = pickVariant(terrainTextures.heartlands, q, r, 31);
    drawClippedImage(corners, base, center, size, alpha);
    const icon = pickVariant(cityIcons, q, r, 41);
    drawClippedImage(corners, icon, center, size * 0.9, pale ? 0.5 : 0.95);
    return;
  }

  if (type === "dungeon") {
    const base = pickVariant(terrainTextures.mountains, q, r, 53);
    drawClippedImage(corners, base, center, size, alpha);
    const icon = pickVariant(dungeonIcons, q, r, 61);
    drawClippedImage(corners, icon, center, size * 0.9, pale ? 0.52 : 1);
    return;
  }

  const img = pickVariant(terrainTextures[type], q, r, 23);
  drawClippedImage(corners, img, center, size, alpha);
}

function drawHexEdgeFeather(corners, size, intensity = 1) {
  const hexScreenRadius = size * camera.zoom;
  const outerBandScreen = Math.max(1.6, hexScreenRadius * 0.20);
  const innerBandScreen = Math.max(1.0, hexScreenRadius * 0.10);
  const outerBand = outerBandScreen / camera.zoom;
  const innerBand = innerBandScreen / camera.zoom;

  ctx.save();
  beginPathFromPoints(corners);
  ctx.clip();

  beginPathFromPoints(corners);
  ctx.strokeStyle = `rgba(255,255,255,${0.22 * intensity})`;
  ctx.lineWidth = outerBand * 2;
  ctx.stroke();

  beginPathFromPoints(corners);
  ctx.strokeStyle = `rgba(255,255,255,${0.34 * intensity})`;
  ctx.lineWidth = innerBand * 2;
  ctx.stroke();

  ctx.restore();
}

function drawGridStroke(corners, state, mode) {
  beginPathFromPoints(corners);
  ctx.strokeStyle = "#787878";
  ctx.lineWidth = state === "visible" ? 1.2 / camera.zoom : 1 / camera.zoom;
  ctx.setLineDash([2.6 / camera.zoom, 4.2 / camera.zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTerrainHexes(bounds, visibleSet, mode) {
  const size = hexSizePx();
  const range = visibleHexRange(bounds, size);
  const mapW = components.map.imageW;
  const mapH = components.map.imageH;
  const margin = size * 2;

  for (let q = range.qMin; q <= range.qMax; q += 1) {
    for (let r = range.rMin; r <= range.rMax; r += 1) {
      const center = axialToPixel(q, r, size);
      if (
        center.x < -margin ||
        center.y < -margin ||
        center.x > mapW + margin ||
        center.y > mapH + margin
      ) {
        continue;
      }
      if (!isInsideSubmap(center.x, center.y)) {
        continue;
      }

      const key = hexKey(q, r);
      const corners = hexCorners(center.x, center.y, size);
      let state = "visible";
      if (mode === "player") {
        const isVisited = visitedHexes.has(key);
        const isVisible = visibleSet.has(key);
        if (!isVisited && !isVisible) {
          state = "unknown";
        } else if (isVisited && !isVisible) {
          state = "visited";
        } else {
          state = "visible";
        }
      }

      if (state === "unknown") {
        beginPathFromPoints(corners);
        ctx.fillStyle = "#fff";
        ctx.fill();
        drawGridStroke(corners, state, mode);
        continue;
      }

      const type = classifyHexType(q, r);
      drawTypedTerrain(corners, center, size, type, q, r, state);
      drawHexEdgeFeather(corners, size, state === "visited" ? 0.6 : 1);
      drawGridStroke(corners, state, mode);
    }
  }

  if (mode === "player" && currentHex) {
    const p = axialToPixel(currentHex.q, currentHex.r, size);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.7 / camera.zoom, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }
}

function drawMarkers(bounds, visibleSet, mode) {
  const showMarkerDots = showMarkersInput.checked;
  const size = hexSizePx();
  const referenceZoom = camera.maxZoom || 1;
  const screenScale = Math.sqrt(camera.zoom / referenceZoom);
  const labelFontPx = (14 * screenScale) / camera.zoom;
  const labelOffset = (7 * screenScale) / camera.zoom;
  const haloWidth = (3.2 * screenScale) / camera.zoom;
  ctx.font = `700 ${labelFontPx}px Georgia, serif`;

  for (const marker of components.markers) {
    if (marker.x < bounds.xMin || marker.x > bounds.xMax || marker.y < bounds.yMin || marker.y > bounds.yMax) {
      continue;
    }
    if (!isInsideSubmap(marker.x, marker.y)) {
      continue;
    }

    if (mode === "player") {
      const mh = worldToHex(marker.x, marker.y, size);
      const key = hexKey(mh.q, mh.r);
      if (!visibleSet.has(key) && !visitedHexes.has(key)) {
        continue;
      }
    }

    if (showMarkerDots) {
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 3.2 / camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1 / camera.zoom;
      ctx.fill();
      ctx.stroke();
    }

    const tx = marker.x + labelOffset;
    const ty = marker.y - labelOffset;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = haloWidth;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(marker.name, tx, ty);

    ctx.fillStyle = "#6b2f20";
    ctx.fillText(marker.name, tx, ty);
  }
}

function drawUserPoi(poi, fillColor, strokeColor, labelColor) {
  ctx.save();
  ctx.lineWidth = 1 / camera.zoom;
  ctx.font = `700 ${14 / camera.zoom}px Georgia, serif`;

  ctx.beginPath();
  ctx.moveTo(poi.x, poi.y + 5.5 / camera.zoom);
  ctx.lineTo(poi.x, poi.y + 13 / camera.zoom);
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(poi.x, poi.y, 5.5 / camera.zoom, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  const tx = poi.x + 9 / camera.zoom;
  const ty = poi.y - 8 / camera.zoom;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3 / camera.zoom;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeText(poi.name, tx, ty);
  ctx.fillStyle = labelColor;
  ctx.fillText(poi.name, tx, ty);
  ctx.restore();
}

function drawPlayerPois(bounds, visibleSet, mode) {
  const size = hexSizePx();
  for (const poi of playerPois) {
    if (poi.x < bounds.xMin || poi.x > bounds.xMax || poi.y < bounds.yMin || poi.y > bounds.yMax) {
      continue;
    }
    if (!isInsideSubmap(poi.x, poi.y)) {
      continue;
    }
    if (mode === "player") {
      const key = hexKey(poi.q, poi.r);
      if (!visibleSet.has(key) && !visitedHexes.has(key)) {
        continue;
      }
    }
    drawUserPoi(poi, "#8b4a32", "#2b120a", "#8b4a32");
  }
}

function drawGmPois(bounds, mode) {
  if (mode !== "gm") {
    return;
  }
  for (const poi of gmPois) {
    if (poi.x < bounds.xMin || poi.x > bounds.xMax || poi.y < bounds.yMin || poi.y > bounds.yMax) {
      continue;
    }
    if (!isInsideSubmap(poi.x, poi.y)) {
      continue;
    }
    drawUserPoi(poi, "#2a7dff", "#0d3f91", "#0d3f91");
  }
}

function queueRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  const mode = currentMode();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.panX, camera.panY);
  ctx.imageSmoothingEnabled = true;

  const bounds = viewportWorldBounds();
  const visibleSet = mode === "player" ? buildVisibleSet() : new Set();
  drawTerrainHexes(bounds, visibleSet, mode);
  drawMarkers(bounds, visibleSet, mode);
  drawPlayerPois(bounds, visibleSet, mode);
  drawGmPois(bounds, mode);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function fitView() {
  const mapW = SUBMAP_BBOX.w;
  const mapH = SUBMAP_BBOX.h;
  const fitZoom = Math.min(viewportW / mapW, viewportH / mapH);
  camera.minZoom = Math.max(fitZoom * 0.5, 0.02);
  camera.maxZoom = 4;
  camera.zoom = fitZoom;
  camera.panX = (viewportW - mapW * fitZoom) / 2 - SUBMAP_BBOX.x * fitZoom;
  camera.panY = (viewportH - mapH * fitZoom) / 2 - SUBMAP_BBOX.y * fitZoom;
  queueRender();
}

function resizeCanvas() {
  viewportW = window.innerWidth;
  viewportH = window.innerHeight;
  canvas.width = viewportW;
  canvas.height = viewportH;
  canvas.style.width = `${viewportW}px`;
  canvas.style.height = `${viewportH}px`;
}

function setCurrentHexAtScreen(sx, sy) {
  const world = screenToWorld(sx, sy);
  if (
    world.x < 0 ||
    world.y < 0 ||
    world.x > components.map.imageW ||
    world.y > components.map.imageH ||
    !isInsideSubmap(world.x, world.y)
  ) {
    return;
  }
  const hex = worldToHex(world.x, world.y, hexSizePx());
  currentHex = hex;
  revealFromHex(hex);
  markSpecialHexesFromCenter(hex);
  saveExploration();
  updateMeta();
  refreshHoverInfo();
  queueRender();
}

function promptPoiDetails(kind, defaultName) {
  const label = kind === "gm" ? "GM pin" : "Player pin";
  const nameRaw = window.prompt(`${label} name`, defaultName);
  if (nameRaw === null) {
    return null;
  }
  const textRaw = window.prompt(`${label} notes/description (optional)`, "") || "";
  const urlRaw = window.prompt(`${label} URL (optional)`, "") || "";
  return {
    name: normalizePoiText(nameRaw) || defaultName,
    text: normalizePoiText(textRaw),
    url: normalizePoiUrl(urlRaw)
  };
}

function addUserPoiAtScreen(sx, sy, kind) {
  const world = screenToWorld(sx, sy);
  if (!isInsideSubmap(world.x, world.y)) {
    addPinMode = null;
    removePinMode = null;
    syncPinUi();
    return;
  }

  const size = hexSizePx();
  const h = worldToHex(world.x, world.y, size);
  const p = axialToPixel(h.q, h.r, size);
  const c = clampToSubmap(p.x, p.y);
  const ts = new Date().toISOString();
  const targetList = kind === "gm" ? gmPois : playerPois;
  const defaultName = kind === "gm" ? `GM Pin ${targetList.length + 1}` : `Player Pin ${targetList.length + 1}`;
  const details = promptPoiDetails(kind, defaultName);
  if (!details) {
    addPinMode = null;
    removePinMode = null;
    syncPinUi();
    return;
  }

  const poi = {
    x: c.x,
    y: c.y,
    q: h.q,
    r: h.r,
    name: details.name,
    category: kind === "gm" ? "GM Added POI" : "Player Added POI",
    text: details.text,
    url: details.url,
    createdAt: ts
  };

  const existingIdx = targetList.findIndex((entry) => entry.q === h.q && entry.r === h.r);
  if (existingIdx >= 0) {
    targetList[existingIdx] = poi;
  } else {
    targetList.push(poi);
  }
  rebuildUserPoiCaches();
  saveUserPois();

  if (kind === "player") {
    currentHex = { q: h.q, r: h.r };
    revealFromHex(currentHex);
    markSpecialHexesFromCenter(currentHex);
    saveExploration();
  }

  addPinMode = null;
  removePinMode = null;
  syncPinUi();
  updateMeta();
  refreshHoverInfo();
  queueRender();
}

function removeUserPoiAtScreen(sx, sy, kind) {
  const world = screenToWorld(sx, sy);
  if (!isInsideSubmap(world.x, world.y)) {
    removePinMode = null;
    syncPinUi();
    return;
  }

  const size = hexSizePx();
  const h = worldToHex(world.x, world.y, size);
  const targetList = kind === "gm" ? gmPois : playerPois;
  let bestIdx = -1;
  let bestDistSq = Infinity;

  for (let i = 0; i < targetList.length; i += 1) {
    const poi = targetList[i];
    if (poi.q !== h.q || poi.r !== h.r) {
      continue;
    }
    const dx = poi.x - world.x;
    const dy = poi.y - world.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    targetList.splice(bestIdx, 1);
    rebuildUserPoiCaches();
    saveUserPois();
  }

  removePinMode = null;
  syncPinUi();
  updateMeta();
  refreshHoverInfo();
  queueRender();
}

function explorationStorageKey() {
  return `mapster_explore_${components.map.mapId}_${HEX_MILES}`;
}

function saveExploration() {
  const payload = {
    visited: Array.from(visitedHexes),
    currentHex,
    discoveredSpecial: Array.from(discoveredSpecialHexes)
  };
  localStorage.setItem(explorationStorageKey(), JSON.stringify(payload));
}

function loadExploration() {
  const raw = localStorage.getItem(explorationStorageKey());
  if (!raw) {
    visitedHexes = new Set();
    currentHex = null;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    visitedHexes = new Set(parsed.visited || []);
    discoveredSpecialHexes = new Set(parsed.discoveredSpecial || []);
    if (discoveredSpecialHexes.size === 0 && visitedHexes.size > 0) {
      for (const key of visitedHexes) {
        const t = markerOverrideCache.get(key);
        if (t === "city" || t === "dungeon") {
          discoveredSpecialHexes.add(key);
        }
      }
    }
    currentHex =
      parsed.currentHex && Number.isInteger(parsed.currentHex.q) && Number.isInteger(parsed.currentHex.r)
        ? parsed.currentHex
        : null;
  } catch {
    visitedHexes = new Set();
    discoveredSpecialHexes = new Set();
    currentHex = null;
  }
}

function saveUserPois() {
  localStorage.setItem(PLAYER_POI_STORAGE_KEY, JSON.stringify(playerPois));
  localStorage.setItem(GM_POI_STORAGE_KEY, JSON.stringify(gmPois));
}

function loadUserPoisFromKey(storageKey, fallbackPrefix) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupePoisByHex(
      parsed
      .map((item, idx) => buildPoiFromRaw(item, idx, fallbackPrefix))
      .filter((item) => Boolean(item))
    );
  } catch {
    return [];
  }
}

function migrateLegacyPlayerPins() {
  const legacy = loadUserPoisFromKey(LEGACY_PLAYER_PIN_STORAGE_KEY, "Player Pin");
  if (legacy.length) {
    playerPois = legacy;
  }
}

function migrateLegacyGmPin() {
  const raw = localStorage.getItem(LEGACY_GM_PIN_STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
      return;
    }
    const migrated = buildPoiFromRaw(
      {
        ...parsed,
        name: parsed.name || "GM Pin 1",
        category: "GM Added POI",
        text: parsed.text || "",
        url: parsed.url || ""
      },
      0,
      "GM Pin"
    );
    gmPois = migrated ? [migrated] : [];
  } catch {
    // ignore bad legacy payload
  }
}

function loadUserPois() {
  playerPois = loadUserPoisFromKey(PLAYER_POI_STORAGE_KEY, "Player Pin");
  gmPois = loadUserPoisFromKey(GM_POI_STORAGE_KEY, "GM Pin");

  if (!playerPois.length) {
    migrateLegacyPlayerPins();
  }
  if (!gmPois.length) {
    migrateLegacyGmPin();
  }

  playerPois = dedupePoisByHex(playerPois);
  gmPois = dedupePoisByHex(gmPois);

  rebuildUserPoiCaches();
}

function uiStorageKey() {
  return "mapster_ui_mode";
}

function saveUiPrefs() {
  localStorage.setItem(uiStorageKey(), JSON.stringify({ mode: currentMode() }));
}

function loadUiPrefs() {
  const raw = localStorage.getItem(uiStorageKey());
  if (!raw) {
    viewModeSelect.value = "player";
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    viewModeSelect.value = parsed.mode === "gm" ? "gm" : "player";
  } catch {
    viewModeSelect.value = "player";
  }
}

function updateMeta() {
  if (!meta) {
    return;
  }
  meta.textContent = "";
}

function syncPinUi() {
  if (!addPlayerPinButton || !removePlayerPinButton || !addGmPinButton || !removeGmPinButton) {
    return;
  }
  const isGm = currentMode() === "gm";
  addGmPinButton.style.display = isGm ? "" : "none";
  removeGmPinButton.style.display = isGm ? "" : "none";
  if (!isGm) {
    if (addPinMode === "gm") {
      addPinMode = null;
    }
    if (removePinMode === "gm") {
      removePinMode = null;
    }
  }
  addPlayerPinButton.textContent =
    addPinMode === "player" ? "Click map to place player pin" : "Add player pin";
  removePlayerPinButton.textContent =
    removePinMode === "player" ? "Click player pin hex to remove" : "Remove player pin";
  addGmPinButton.textContent = addPinMode === "gm" ? "Click map to place GM pin" : "Add GM pin";
  removeGmPinButton.textContent = removePinMode === "gm" ? "Click GM pin hex to remove" : "Remove GM pin";
}

function setupInteractions() {
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mouseleave", () => {
    hoverState.inside = false;
    hideHoverInfo();
  });

  canvas.addEventListener("mousedown", (event) => {
    interaction.dragging = true;
    interaction.startX = event.clientX;
    interaction.startY = event.clientY;
    interaction.moved = false;
    interaction.dragMode = event.button === 2 || event.button === 1 || event.shiftKey ? "pan" : "set-current";
  });

  window.addEventListener("mousemove", (event) => {
    const overCanvas = event.target === canvas;
    if (overCanvas) {
      hoverState.inside = true;
      hoverState.screenX = event.clientX;
      hoverState.screenY = event.clientY;
    } else if (!interaction.dragging) {
      hoverState.inside = false;
      hideHoverInfo();
    }

    if (!interaction.dragging) {
      if (overCanvas) {
        updateHoverInfoAtScreen(event.clientX, event.clientY);
      }
      return;
    }
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      interaction.moved = true;
    }
    if (interaction.dragMode === "pan") {
      hideHoverInfo();
      camera.panX += dx;
      camera.panY += dy;
      interaction.startX = event.clientX;
      interaction.startY = event.clientY;
      queueRender();
    }
  });

  window.addEventListener("mouseup", (event) => {
    if (!interaction.dragging) {
      return;
    }
    if (interaction.dragMode === "set-current" && !interaction.moved && event.button === 0) {
      if (addPinMode === "player") {
        addUserPoiAtScreen(event.clientX, event.clientY, "player");
      } else if (addPinMode === "gm") {
        addUserPoiAtScreen(event.clientX, event.clientY, "gm");
      } else if (removePinMode === "player") {
        removeUserPoiAtScreen(event.clientX, event.clientY, "player");
      } else if (removePinMode === "gm") {
        removeUserPoiAtScreen(event.clientX, event.clientY, "gm");
      } else {
        setCurrentHexAtScreen(event.clientX, event.clientY);
      }
    } else {
      refreshHoverInfo();
    }
    interaction.dragging = false;
    interaction.dragMode = "none";
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
      const worldBefore = screenToWorld(event.clientX, event.clientY);
      camera.zoom = nextZoom;
      camera.panX = event.clientX - worldBefore.x * camera.zoom;
      camera.panY = event.clientY - worldBefore.y * camera.zoom;
      refreshHoverInfo();
      queueRender();
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    resizeCanvas();
    fitView();
    refreshHoverInfo();
  });
}

function setupUi() {
  viewModeSelect.addEventListener("change", () => {
    saveUiPrefs();
    syncPinUi();
    updateMeta();
    refreshHoverInfo();
    queueRender();
  });

  showMarkersInput.addEventListener("change", queueRender);

  resetViewButton.addEventListener("click", fitView);
  addPlayerPinButton.addEventListener("click", () => {
    addPinMode = addPinMode === "player" ? null : "player";
    if (addPinMode === "player") {
      removePinMode = null;
    }
    syncPinUi();
  });
  removePlayerPinButton.addEventListener("click", () => {
    removePinMode = removePinMode === "player" ? null : "player";
    if (removePinMode === "player") {
      addPinMode = null;
    }
    syncPinUi();
  });
  addGmPinButton.addEventListener("click", () => {
    if (currentMode() !== "gm") {
      return;
    }
    addPinMode = addPinMode === "gm" ? null : "gm";
    if (addPinMode === "gm") {
      removePinMode = null;
    }
    syncPinUi();
  });
  removeGmPinButton.addEventListener("click", () => {
    if (currentMode() !== "gm") {
      return;
    }
    removePinMode = removePinMode === "gm" ? null : "gm";
    if (removePinMode === "gm") {
      addPinMode = null;
    }
    syncPinUi();
  });

  clearFogButton.addEventListener("click", () => {
    visitedHexes = new Set();
    discoveredSpecialHexes = new Set();
    if (currentHex) {
      revealFromHex(currentHex);
      markSpecialHexesFromCenter(currentHex);
    }
    saveExploration();
    updateMeta();
    refreshHoverInfo();
    queueRender();
  });

  resetFogButton.addEventListener("click", () => {
    visitedHexes = new Set();
    discoveredSpecialHexes = new Set();
    currentHex = null;
    playerPois = [];
    gmPois = [];
    rebuildUserPoiCaches();
    saveUserPois();
    addPinMode = null;
    removePinMode = null;
    syncPinUi();
    saveExploration();
    updateMeta();
    refreshHoverInfo();
    queueRender();
  });
}

async function fetchJsonWithFallback(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      return await response.json();
    } catch {
      // next URL
    }
  }
  throw new Error("Could not fetch components.json");
}

async function loadImageWithFallback(urls) {
  for (const url of urls) {
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    } catch {
      // next URL
    }
  }
  throw new Error(`Could not load image from candidate URLs: ${urls.join(", ")}`);
}

async function loadImageSet(urls) {
  return Promise.all(urls.map((url) => loadImageWithFallback([url])));
}

function buildSourceMapData() {
  const off = document.createElement("canvas");
  off.width = components.map.imageW;
  off.height = components.map.imageH;
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(sourceMapImage, 0, 0, components.map.imageW, components.map.imageH);
  sourceMapData = octx.getImageData(0, 0, components.map.imageW, components.map.imageH).data;
}

async function boot() {
  components = await fetchJsonWithFallback([
    "../atlas/components.json",
    "/atlas/components.json",
    "./atlas/components.json"
  ]);

  sourceMapImage = await loadImageWithFallback([
    `../atlas/${components.map.image}`,
    `/atlas/${components.map.image}`,
    `./atlas/${components.map.image}`
  ]);
  buildSourceMapData();
  buildHydroMasks();

  const terrainTextureUrls = buildTerrainTextureUrls();
  for (const [type, urls] of Object.entries(terrainTextureUrls)) {
    terrainTextures[type] = await loadImageSet(urls);
  }
  cityIcons = await loadImageSet(CITY_ICON_URLS);
  dungeonIcons = await loadImageSet(DUNGEON_ICON_URLS);

  resizeCanvas();
  fitView();
  setupInteractions();
  setupUi();
  loadUiPrefs();
  loadExploration();
  loadUserPois();
  clearClassificationCaches();
  syncPinUi();
  fitView();
  updateMeta();
  queueRender();
}

boot().catch((error) => {
  console.error(error);
  if (meta) {
    meta.textContent = `Failed to load data: ${error.message}`;
  }
});
