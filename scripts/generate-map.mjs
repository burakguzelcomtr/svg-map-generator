#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const toolRoot = resolve(args["tool-dir"] || join(root, ".map-tools"));
const requireFromTools = createRequire(join(toolRoot, "package.json"));

let d3;
let topojson;
try {
  d3 = await import(pathToFileURL(join(toolRoot, "node_modules/d3-geo/src/index.js")).href);
  topojson = requireFromTools("topojson-client");
} catch {
  console.error([
    "Temporary map tools are missing.",
    "Install them locally without changing project dependencies:",
    "npm install --prefix .map-tools --no-save d3-geo@3 topojson-client@3 us-atlas@3 world-atlas@2"
  ].join("\n"));
  process.exit(1);
}

const STATE_FIPS = {
  Alabama: "01", Alaska: "02", Arizona: "04", Arkansas: "05", California: "06",
  Colorado: "08", Connecticut: "09", Delaware: "10", Florida: "12", Georgia: "13",
  Hawaii: "15", Idaho: "16", Illinois: "17", Indiana: "18", Iowa: "19", Kansas: "20",
  Kentucky: "21", Louisiana: "22", Maine: "23", Maryland: "24", Massachusetts: "25",
  Michigan: "26", Minnesota: "27", Mississippi: "28", Missouri: "29", Montana: "30",
  Nebraska: "31", Nevada: "32", "New Hampshire": "33", "New Jersey": "34",
  "New Mexico": "35", "New York": "36", "North Carolina": "37", "North Dakota": "38",
  Ohio: "39", Oklahoma: "40", Oregon: "41", Pennsylvania: "42", "Rhode Island": "44",
  "South Carolina": "45", "South Dakota": "46", Tennessee: "47", Texas: "48", Utah: "49",
  Vermont: "50", Virginia: "51", Washington: "53", "West Virginia": "54", Wisconsin: "55",
  Wyoming: "56", "District of Columbia": "11"
};

const COUNTRY_IDS = { "United Kingdom": "826", Mexico: "484" };

const usPath = requireFromTools.resolve("us-atlas/states-10m.json");
const usCountiesPath = requireFromTools.resolve("us-atlas/counties-10m.json");
const worldPath = requireFromTools.resolve("world-atlas/countries-110m.json");
const usTopology = JSON.parse(await readFile(usPath, "utf8"));
const usCountiesTopology = JSON.parse(await readFile(usCountiesPath, "utf8"));
const worldTopology = JSON.parse(await readFile(worldPath, "utf8"));
const adminSources = {
  "United Kingdom": {
    file: join(toolRoot, "geoboundaries/GBR-ADM1.geojson"),
    url: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GBR/ADM1/geoBoundaries-GBR-ADM1_simplified.geojson"
  },
  Mexico: {
    file: join(toolRoot, "geoboundaries/MEX-ADM1.geojson"),
    url: "https://github.com/wmgeolab/geoBoundaries/raw/90a1d52/releaseData/gbOpen/MEX/ADM1/geoBoundaries-MEX-ADM1_simplified.geojson"
  }
};
const adminFeatures = {};
for (const [country, source] of Object.entries(adminSources)) {
  try { adminFeatures[country] = JSON.parse(await readFile(source.file, "utf8")).features.map(rewindForD3); }
  catch {
    if (args["emit-data"]) {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`Unable to download ${country} boundaries: ${response.status}`);
      const json = await response.json();
      await mkdir(dirname(source.file), { recursive: true });
      await writeFile(source.file, JSON.stringify(json), "utf8");
      adminFeatures[country] = json.features.map(rewindForD3);
    } else adminFeatures[country] = [];
  }
}

const stateFeatures = topojson.feature(usTopology, usTopology.objects.states).features;
const countyFeatures = topojson.feature(usCountiesTopology, usCountiesTopology.objects.counties).features;
const countryFeatures = topojson.feature(worldTopology, worldTopology.objects.countries).features;

if (args["emit-data"]) {
  await emitRuntimeData(resolveOutput(args["emit-data"]));
  process.exit(0);
}

const configPath = resolve(args.config || join(root, "configs/atlanta-region.json"));
const config = JSON.parse(await readFile(configPath, "utf8"));
applyCliOverrides(config, args);
const outputPath = resolveOutput(config.output || args.output || "map.svg");
const svg = createSvg(config);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg, "utf8");
console.log(`Generated ${outputPath}`);

function createSvg(config) {
  const countyMode = config.mode === "counties" || Array.isArray(config.counties);
  const subdivisionMode = config.mode === "subdivisions" || Array.isArray(config.regions);
  const names = subdivisionMode ? (config.regions || []) : countyMode ? (config.counties || []) : (config.states || []);
  const unitName = subdivisionMode ? "region" : countyMode ? "county" : "state";
  if (!names.length) throw new Error(`Config must include at least one ${unitName}.`);
  const selected = subdivisionMode ? selectGlobalRegions(config.country, names) : countyMode ? selectCounties(config.state, names) : names.map(name => {
      const id = STATE_FIPS[name];
      const feature = stateFeatures.find(item => String(item.id).padStart(2, "0") === id);
      if (!feature) throw new Error(`Unknown state: ${name}`);
      return { name, id, feature };
    });

  const projection = subdivisionMode ? d3.geoMercator().scale(150).translate([480, 250]) : d3.geoAlbersUsa();
  const path = d3.geoPath(projection);
  const collection = { type: "FeatureCollection", features: selected.map(item => item.feature) };
  const [[x0, y0], [x1, y1]] = path.bounds(collection);
  const padding = Number(config.padding ?? 18);
  const vx = round(x0 - padding);
  const vy = round(y0 - padding);
  const width = round(x1 - x0 + padding * 2);
  const height = round(y1 - y0 + padding * 2);
  const style = {
    fill: "#d9dde4", highlightFill: "#f26b4f", border: "#18212f",
    borderWidth: 1.5, marker: "#18212f", markerBorder: "#ffffff", markerBorderWidth: 2.5,
    markerRing: "#ffffff", markerRadius: 5, markerRingPadding: 2.5, markerMode: "dot",
    ...(config.style || {})
  };
  const highlighted = new Set(subdivisionMode ? (config.highlightedRegions || []) : countyMode ? (config.highlightedCounties || []) : (config.highlightedStates || []));
  const paths = selected.map(({ name, id, feature }) =>
    `  <path id="${unitName}-${id}" data-${unitName}="${escapeXml(name)}" d="${path(feature)}" fill="${highlighted.has(name) ? style.highlightFill : style.fill}" stroke="${style.border}" stroke-width="${style.borderWidth}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
  ).join("\n");
  const markerConfigs = [
    ...(config.cities || []),
    ...(config.regionMarkers || []).map(marker => typeof marker === "string" ? { name: marker, region: marker } : marker)
  ];
  const cities = markerConfigs.map(city => {
    const regionFeature = city.region ? selected.find(item => item.name === city.region)?.feature : null;
    const point = regionFeature ? path.centroid(regionFeature) : projection([Number(city.longitude), Number(city.latitude)]);
    if (!point) throw new Error(`Marker position is unavailable: ${city.name || city.region || "unnamed marker"}`);
    const [cx, cy] = point.map(round);
    const radius = Number(city.radius || style.markerRadius);
    const name = escapeXml(city.name || "City");
    const mode = city.mode || style.markerMode || "dot";
    const markerBorder = city.borderColor || config.style?.markerBorder || config.style?.markerRing || style.markerBorder;
    const markerBorderWidth = Number(city.borderWidth ?? config.style?.markerBorderWidth ?? config.style?.markerRingPadding ?? style.markerBorderWidth);
    const markerAttribute = city.region ? `data-region-marker="${escapeXml(city.region)}"` : `data-city="${name}"`;
    const markerParts = [`  <g ${markerAttribute} aria-label="${name}">`];
    if (mode === "dot" || mode === "dot-name") {
      markerParts.push(`    <circle cx="${cx}" cy="${cy}" r="${round(radius + markerBorderWidth)}" fill="${markerBorder}" opacity="0.96"/>`);
      markerParts.push(`    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${style.marker}"/>`);
    }
    if (mode === "name" || mode === "dot-name") {
      const fontSize = round(radius * 2.25);
      const labelX = round(cx + (mode === "dot-name" ? radius * 2.1 : 0));
      markerParts.push(`    <text x="${labelX}" y="${round(cy + fontSize * .34)}" text-anchor="${mode === "dot-name" ? "start" : "middle"}" font-family="Manrope, Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing=".02em" fill="${style.marker}" stroke="${markerBorder}" stroke-width="${markerBorderWidth}" paint-order="stroke fill" stroke-linejoin="round">${name}</text>`);
    }
    markerParts.push("  </g>");
    return markerParts.join("\n");
  }).join("\n");
  const title = config.title || `${subdivisionMode ? `${config.country} regions` : countyMode ? `${config.state} counties` : names.join(", ")} map`;

  const metadata = subdivisionMode
    ? "  <metadata>Administrative boundaries: geoBoundaries gbOpen (CC BY); generated locally by Territory.</metadata>\n"
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${width} ${height}" role="img" aria-labelledby="map-title" style="background:transparent">
  <title id="map-title">${escapeXml(title)}</title>
${metadata}${paths}
${cities}
</svg>\n`;
}

async function emitRuntimeData(outputPath) {
  const stateProjection = d3.geoAlbersUsa();
  const statePath = d3.geoPath(stateProjection);
  const worldProjection = d3.geoMercator().scale(150).translate([480, 250]);
  const worldGeoPath = d3.geoPath(worldProjection);
  const states = {};
  for (const [name, id] of Object.entries(STATE_FIPS)) {
    const feature = stateFeatures.find(item => String(item.id).padStart(2, "0") === id);
    if (feature) states[name] = { id, path: statePath(feature), bounds: statePath.bounds(feature).flat().map(round), centroid: statePath.centroid(feature).map(round) };
  }
  const countries = {};
  for (const [name, id] of Object.entries(COUNTRY_IDS)) {
    const feature = countryFeatures.find(item => String(item.id).padStart(3, "0") === id);
    if (feature) countries[name] = { id, path: worldGeoPath(feature), bounds: worldGeoPath.bounds(feature).flat().map(round), centroid: worldGeoPath.centroid(feature).map(round) };
  }
  const counties = {};
  const presetStates = ["Georgia", "California", "New York", "Texas", "Ohio", "Virginia", "Minnesota", "Michigan", "Missouri"];
  for (const stateName of presetStates) {
    const stateId = STATE_FIPS[stateName];
    counties[stateName] = {};
    for (const feature of countyFeatures.filter(item => String(item.id).padStart(5, "0").startsWith(stateId))) {
      const name = feature.properties?.name || String(feature.id);
      counties[stateName][name] = {
        id: String(feature.id).padStart(5, "0"),
        path: statePath(feature),
        bounds: statePath.bounds(feature).flat().map(round),
        centroid: statePath.centroid(feature).map(round)
      };
    }
  }
  const subdivisions = {};
  for (const [country, features] of Object.entries(adminFeatures)) {
    subdivisions[country] = {};
    for (const feature of features) {
      const name = feature.properties?.shapeName || feature.properties?.name;
      const id = feature.properties?.shapeISO || feature.properties?.shapeID;
      subdivisions[country][name] = { id, path: worldGeoPath(feature), bounds: worldGeoPath.bounds(feature).flat().map(round), centroid: worldGeoPath.centroid(feature).map(round) };
    }
  }
  const source = `// Generated from us-atlas, world-atlas and geoBoundaries by scripts/generate-map.mjs.\nexport const MAP_DATA = ${JSON.stringify({ states, counties, countries, subdivisions }, null, 2)};\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, "utf8");
  console.log(`Generated ${outputPath}`);
}

function applyCliOverrides(config, argv) {
  if (argv.states) config.states = splitList(argv.states);
  if (argv.counties) { config.mode = "counties"; config.counties = splitList(argv.counties); }
  if (argv.regions) { config.mode = "subdivisions"; config.regions = splitList(argv.regions); }
  if (argv["mark-regions"]) config.regionMarkers = splitList(argv["mark-regions"]);
  if (argv.highlight) {
    const target = config.mode === "subdivisions" ? "highlightedRegions" : config.mode === "counties" ? "highlightedCounties" : "highlightedStates";
    config[target] = splitList(argv.highlight);
  }
  if (argv.output) config.output = argv.output;
  if (argv.city) {
    const [name, latitude, longitude] = String(argv.city).split(",");
    config.cities = [{ name, latitude: Number(latitude), longitude: Number(longitude) }];
  }
}

function selectCounties(stateName, names) {
  const stateId = STATE_FIPS[stateName];
  if (!stateId) throw new Error(`Unknown county parent state: ${stateName}`);
  return names.map(name => {
    const feature = countyFeatures.find(item =>
      String(item.id).padStart(5, "0").startsWith(stateId) && item.properties?.name === name
    );
    if (!feature) throw new Error(`Unknown county in ${stateName}: ${name}`);
    return { name, id: String(feature.id).padStart(5, "0"), feature };
  });
}

function selectGlobalRegions(country, names) {
  const features = adminFeatures[country] || [];
  if (!features.length) throw new Error(`Admin boundaries are unavailable for ${country}.`);
  return names.map(name => {
    const feature = features.find(item => (item.properties?.shapeName || item.properties?.name) === name);
    if (!feature) throw new Error(`Unknown region in ${country}: ${name}`);
    return { name, id: feature.properties?.shapeISO || feature.properties?.shapeID, feature };
  });
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = values[index + 1];
    parsed[key] = !next || next.startsWith("--") ? true : next;
    if (parsed[key] !== true) index += 1;
  }
  return parsed;
}

function splitList(value) {
  return String(value).split(",").map(item => item.trim()).filter(Boolean);
}

function resolveOutput(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function rewindForD3(feature) {
  const geometry = feature.geometry;
  if (geometry?.type === "Polygon") geometry.coordinates.forEach(ring => ring.reverse());
  if (geometry?.type === "MultiPolygon") geometry.coordinates.forEach(polygon => polygon.forEach(ring => ring.reverse()));
  return feature;
}
