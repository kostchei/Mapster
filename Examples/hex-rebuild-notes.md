# Hex Rebuild Feasibility (6-mile Flat-Top)

Yes, the map can be rebuilt as majority-terrain hexes at 6-mile scale.

## Suggested Process

1. Build 6-mile hex grid from source scale (`2.104 px = 1 mile`).
2. For each hex, estimate terrain coverage from map image and/or metadata.
3. Assign dominant type (or weighted tie-break rule).
4. Render each hex with one of 8 terrain classes and rotate among 3 variants per class to avoid visual repetition.
5. Keep place names as vector text labels on top (not baked into raster), so zoom stays sharp.

## What This Folder Contains

- `tiles/*.svg`: 24 tile examples (`8 types x 3 variants`).
- `hex-type-preview.svg`: overview sheet of all variants.

