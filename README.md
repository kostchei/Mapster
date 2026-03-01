# Mapster (Faerun Rebuild Starter)

This project extracts AideDD Faerun map components, then runs a black-and-white flat-top hex explorer prototype with fog of war.

## Fastest Setup (Windows LAN)

Use this when the GM hosts on a Windows laptop and players (phones/tablets/laptops/smart TV) open it on the same Wi-Fi.

1. Optional one-time desktop shortcut:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\windows\Install-Desktop-Shortcut.ps1
```

2. Start hosting (either method):

- Double-click desktop shortcut `Start Mapster LAN`
- Or run:

```powershell
.\deploy\windows\Start-Mapster-LAN.cmd
```

3. Open on GM laptop:

- `http://localhost:8080/prototype/`

4. Open on player devices / smart TV:

- `http://<laptop-ip>:8080/prototype/`

Notes:

- Keep the launcher window open while hosting.
- First run may prompt for firewall access; allow on Private networks.
- Browser state (`localStorage`) is per-device.

## What The Source Code Says About Scale

From `dataF.js`:

- `factorDist = 2.104`
- Comment: `1052 px = 500 miles -> 2.104 px = 1 miles`

So at native map resolution (`7990 x 5635`):

- `2.104 px = 1 mile`
- `1 px = 0.475285 miles`
- `1 px = 0.764853 km`
- Full map width: `7990 / 2.104 = 3797.53 miles`
- Full map height: `5635 / 2.104 = 2678.42 miles`

Distance in the original app is computed as:

```text
distanceMiles += pixelDistance / factorDist
```

## Extracted Components

The extractor pulls and parses:

- Base raster map image
- Zone polygons (`zones[]`, SVG paths)
- Marker/POI list (`groupe[]` entries excluding `name: "GROUP"`)
- Legend groups (`groupe[]` entries with `name: "GROUP"`)
- Scale metadata

Outputs:

- `atlas/components.json`
- `atlas/markers.csv`
- `atlas/faerun-7990-5635.jpg`
- Raw source files in `atlas/source/`

## Run

1. Extract data/assets:

```powershell
node .\scripts\extract-atlas.js
```

2. Serve this folder (required for browser fetch):

```powershell
cd D:\Code\Mapster
python -m http.server 8080
```

3. Open:

- `http://localhost:8080/prototype/`

## Prototype Features

- Grayscale map rendering (black/white style)
- Flat-top hex overlay
- Fixed `6 mile` hex spacing
- Low-ink black/white render tuned for printing
- Two view modes:
- `GM`: no fog of war (full map, full marker visibility)
- `Player`: fog of war active
- Terrain rendering is assembled per gameplay hex from `Examples/Hexs/subhexes` assets (not from full-size source map labels)
- Coast/water detection uses a downsampled hydro mask built from the original color atlas, then water hexes are forced from mask coverage (major water + channels/coastline)
- Sub-map extent is constrained to your selected `Extent.png` area
- Player hex states:
- `Unknown` hexes: white (hidden)
- `Visited` hexes: same map shown but paler, with dotted outline
- `Visible` hexes: full-contrast black/white map (fixed sight radius `3`)
- Hex grid lines are gray dotted
- Pan/zoom camera
- Optional marker overlay (shown only in visible hexes)
- Exploration state saved in `localStorage`
- Player pins:
- Add pin with `Add player pin` button, then click a hex
- Pins are saved in `localStorage`
- App starts fully zoomed in on the most recent pin
