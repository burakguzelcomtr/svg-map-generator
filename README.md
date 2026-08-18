# Territory SVG Map Generator

A dependency-free browser editor plus a reusable local generator for standalone SVG maps. US presets render county subdivisions, while custom multi-state regions and country presets remain supported. Runtime paths are pre-generated from `topojson/us-atlas`; no D3, TopoJSON, or mapping library is shipped with the app.

## Run the visual generator

```bash
npm run dev
```

Open `http://localhost:4173`. Choose a preset or “See all states”, set fills and borders, toggle any county/region highlight, and add multiple markers. Use the populated city picker, click “Pick a point on the map” to place one visually, or enter coordinates manually. Then export or copy the SVG.

City markers support three export-safe display modes: dot, editable SVG text only, or dot plus editable SVG text.
Marker border color and width are independently configurable. The same border settings drive the dot's outer ring and the text outline in name modes; a width of zero disables the border.
Markers and text labels can be dragged directly in the preview. Dragging a generated region-center marker converts it to a free geographic position so the exported SVG keeps the adjusted placement. Marker/text size supports values from `0.25` to `12`.

Region markers can be added without coordinates: selecting a displayed county/state/region places the marker or label at its generated visual centroid. City and free-point markers remain available as optional alternatives. Config files can use `regionMarkers: ["Fulton", "DeKalb"]` or the CLI flag `--mark-regions "Fulton,DeKalb"`.

## Static build

Create a dependency-free production folder:

```bash
npm run build
```

The generated `dist/` contains only `index.html`, `styles.css`, and one classic `bundle.js`. It can be opened directly by double-clicking `index.html` (`file://`) or served from any static HTTP host. No Node.js server, ES-module loading, or mapping library is required in production.

US state presets contain county subdivisions. United Kingdom contains its four constituent countries and Mexico contains its 32 first-level administrative regions; every unit remains a separate SVG path.

## Generate SVGs from configuration

The first map is configured in `configs/atlanta-region.json` and contains the 11 Atlanta metro counties:

```bash
npm run generate:atlanta
npm run generate:uk
npm run generate:mexico
```

The output is `atlanta-region-map.svg`. Every county is a separate `<path>`, the `viewBox` is cropped to the selected region, and the background is transparent.

To make another map, copy the JSON config and change:

- `mode`: `counties` for county-level output
- `state`: the parent state for county lookup
- `counties`: county names
- `highlightedCounties`: zero or more highlighted counties
- `cities`: `{ name, latitude, longitude }` entries
- `output`: destination filename
- `style`: fills, border, marker colors, and sizes

Then run:

```bash
node scripts/generate-map.mjs --config configs/your-map.json
```

You can also override common values without editing JSON:

```bash
node scripts/generate-map.mjs --config configs/atlanta-region.json --counties "Fulton,DeKalb,Cobb,Gwinnett" --city "Atlanta,33.749,-84.388" --output atlanta-core.svg
```

## Temporary generation tools

Install generation-only packages into the ignored `.map-tools` folder. They are intentionally absent from the root `package.json` dependencies:

```bash
npm install --prefix .map-tools --no-save d3-geo@3 topojson-client@3 us-atlas@3 world-atlas@2
```

Regenerate the browser's static path data with:

```bash
npm run generate:data
```

The app itself only loads `src/map-data.js`, which contains plain SVG path strings. Global administrative boundaries are downloaded to the ignored `.map-tools` cache when needed.

US geometry comes from `topojson/us-atlas`. United Kingdom and Mexico ADM1 geometry comes from [geoBoundaries gbOpen](https://www.geoboundaries.org/) under its source licenses; exported global SVGs include attribution metadata.
