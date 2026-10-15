import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../atlanta-region-map.svg", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const { MAP_DATA } = await import(new URL("../src/map-data.js", import.meta.url));
const { projectAlbersUsa, invertAlbersUsa, projectMercator, invertMercator } = await import(new URL("../src/projections.js", import.meta.url));
const pathCount = (svg.match(/<path /g) || []).length;
const circleCount = (svg.match(/<circle /g) || []).length;
const viewBox = svg.match(/viewBox="([^"]+)/)?.[1];

assert(pathCount === 11, `Expected 11 Atlanta metro county paths, found ${pathCount}`);
assert(circleCount === 2, `Expected a marker ring and dot, found ${circleCount} circles`);
assert(viewBox && viewBox.split(" ").map(Number).every(Number.isFinite), "Expected a numeric cropped viewBox");
assert(!pkg.dependencies && !pkg.devDependencies, "Root project must not ship mapping dependencies");
assert(!/<rect|background-color/.test(svg), "SVG must not include a background layer");
assert(svg.includes('data-county="Fulton"'), "Fulton County path is missing");
assert(svg.includes('data-county="DeKalb"'), "DeKalb County path is missing");
assert(svg.includes('data-region-marker="Fulton"'), "Fulton region marker is missing");
assert(Object.keys(MAP_DATA.counties.California).length === 58, "California counties are incomplete");
assert(Object.keys(MAP_DATA.counties.Texas).length === 254, "Texas counties are incomplete");
assert(Object.keys(MAP_DATA.subdivisions["United Kingdom"]).length === 4, "UK regions are incomplete");
assert(Object.keys(MAP_DATA.subdivisions.Mexico).length === 32, "Mexico states are incomplete");
assert(appSource.includes('city("London"') && appSource.includes('city("Mexico City"'), "Global city presets are missing");
assert(appSource.includes('wisconsin: [city("Milwaukee"') && appSource.includes('Wisconsin: "wisconsin"'), "Wisconsin city marker presets are missing");
assert(appSource.includes("placeMarkerFromMap") && appSource.includes("getCityCatalog"), "Marker placement controls are missing");
assert(appSource.includes('mode === "name"') && appSource.includes('mode === "dot-name"'), "Marker name display modes are missing");
assert(appSource.includes("renderRegionMarkerOptions") && appSource.includes("Region center"), "Region marker selection is missing");
assert(appSource.includes("markerBorderWidth") && appSource.includes("markerBorder"), "Marker border controls are missing");
assert(htmlSource.includes('id="marker-border-color"') && htmlSource.includes('id="marker-border-width"'), "Marker border inputs are missing");
assert(htmlSource.includes('min="0.25"') && appSource.includes("startMarkerDrag") && appSource.includes("finishMarkerDrag"), "Fine marker sizing or drag controls are missing");

const atlanta = [-84.388, 33.749];
const atlantaRoundTrip = invertAlbersUsa(...projectAlbersUsa(...atlanta));
assert(distance(atlanta, atlantaRoundTrip) < 1e-8, "US click-to-coordinate conversion is inaccurate");
const milwaukeePoint = projectAlbersUsa(-87.9065, 43.0389);
const wisconsinBounds = MAP_DATA.states.Wisconsin.bounds;
assert(milwaukeePoint && pointInsideBounds(milwaukeePoint, wisconsinBounds), "Wisconsin city markers do not project inside the state");
const london = [-0.1278, 51.5074];
const londonRoundTrip = invertMercator(...projectMercator(...london));
assert(distance(london, londonRoundTrip) < 1e-8, "Global click-to-coordinate conversion is inaccurate");

console.log({ pathCount, circleCount, viewBox, dependencies: "none", transparent: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function pointInsideBounds(point, bounds) {
  return point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3];
}
