import { MAP_DATA } from "./map-data.js";
import { invertAlbersUsa, invertMercator, projectAlbersUsa, projectMercator } from "./projections.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const presets = {
  atlanta: {
    title: "Atlanta Metro", scope: "counties", parentState: "Georgia",
    selected: ["Cherokee", "Forsyth", "Cobb", "Gwinnett", "Douglas", "Fulton", "DeKalb", "Clayton", "Rockdale", "Fayette", "Henry"],
    highlighted: [], cities: [{ name: "Fulton", region: "Fulton" }],
    style: { fill: "#e86f32", highlightFill: "#c94d31", border: "#fff3e9", borderWidth: 1.8, marker: "#17212b", markerSize: 4 },
    filename: "atlanta-region-map.svg"
  },
  california: stateCounties("California"),
  "new-york": stateCounties("New York"),
  texas: stateCounties("Texas"),
  ohio: stateCounties("Ohio"),
  virginia: stateCounties("Virginia"),
  minnesota: stateCounties("Minnesota"),
  michigan: stateCounties("Michigan"),
  missouri: stateCounties("Missouri"),
  "united-kingdom": countryRegions("United Kingdom"),
  mexico: countryRegions("Mexico")
};

const CITY_CATALOG = {
  atlanta: [city("Atlanta", 33.749, -84.388), city("Marietta", 33.9526, -84.5499), city("Decatur", 33.7748, -84.2963), city("Alpharetta", 34.0754, -84.2941), city("Roswell", 34.0232, -84.3616)],
  california: [city("Los Angeles", 34.0522, -118.2437), city("San Francisco", 37.7749, -122.4194), city("San Diego", 32.7157, -117.1611), city("Sacramento", 38.5816, -121.4944), city("San Jose", 37.3382, -121.8863)],
  "new-york": [city("New York City", 40.7128, -74.006), city("Buffalo", 42.8864, -78.8784), city("Rochester", 43.1566, -77.6088), city("Albany", 42.6526, -73.7562), city("Syracuse", 43.0481, -76.1474)],
  texas: [city("Austin", 30.2672, -97.7431), city("Dallas", 32.7767, -96.797), city("Houston", 29.7604, -95.3698), city("San Antonio", 29.4241, -98.4936), city("El Paso", 31.7619, -106.485)],
  ohio: [city("Columbus", 39.9612, -82.9988), city("Cleveland", 41.4993, -81.6944), city("Cincinnati", 39.1031, -84.512), city("Toledo", 41.6528, -83.5379), city("Akron", 41.0814, -81.519)],
  virginia: [city("Richmond", 37.5407, -77.436), city("Virginia Beach", 36.8529, -75.978), city("Norfolk", 36.8508, -76.2859), city("Arlington", 38.8816, -77.091), city("Roanoke", 37.271, -79.9414)],
  minnesota: [city("Minneapolis", 44.9778, -93.265), city("Saint Paul", 44.9537, -93.09), city("Duluth", 46.7867, -92.1005), city("Rochester", 44.0121, -92.4802)],
  michigan: [city("Detroit", 42.3314, -83.0458), city("Grand Rapids", 42.9634, -85.6681), city("Lansing", 42.7325, -84.5555), city("Ann Arbor", 42.2808, -83.743)],
  missouri: [city("Kansas City", 39.0997, -94.5786), city("St. Louis", 38.627, -90.1994), city("Springfield", 37.209, -93.2923), city("Columbia", 38.9517, -92.3341)],
  wisconsin: [city("Milwaukee", 43.0389, -87.9065), city("Madison", 43.0731, -89.4012), city("Green Bay", 44.5133, -88.0133), city("Kenosha", 42.5847, -87.8212), city("Eau Claire", 44.8113, -91.4985), city("La Crosse", 43.8138, -91.2519)],
  "united-kingdom": [city("London", 51.5074, -0.1278), city("Manchester", 53.4808, -2.2426), city("Birmingham", 52.4862, -1.8904), city("Edinburgh", 55.9533, -3.1883), city("Glasgow", 55.8642, -4.2518), city("Liverpool", 53.4084, -2.9916), city("Cardiff", 51.4816, -3.1791), city("Belfast", 54.5973, -5.9301)],
  mexico: [city("Mexico City", 19.4326, -99.1332), city("Guadalajara", 20.6597, -103.3496), city("Monterrey", 25.6866, -100.3161), city("Puebla", 19.0414, -98.2063), city("Tijuana", 32.5149, -117.0382), city("Cancún", 21.1619, -86.8515)]
};

const AREA_CATALOG = {
  Georgia: "atlanta", California: "california", "New York": "new-york", Texas: "texas", Ohio: "ohio",
  Virginia: "virginia", Minnesota: "minnesota", Michigan: "michigan", Missouri: "missouri", Wisconsin: "wisconsin",
  "United Kingdom": "united-kingdom", Mexico: "mexico"
};

const defaults = {
  fill: "#d9dde4", highlightFill: "#f26b4f", border: "#18212f",
  borderWidth: 1.6, marker: "#18212f", markerSize: 5, markerMode: "dot",
  markerBorder: "#ffffff", markerBorderWidth: 2
};

let state = { ...clone(presets.atlanta), style: { ...defaults, ...presets.atlanta.style }, preset: "atlanta", zoom: 100 };
let draftSelection = new Set(state.selected);
let toastTimer;
let renderedMarkerRadius = 5;
let renderedMarkerBorderWidth = 2;
let placementMode = false;
let markerDrag = null;

const elements = {
  title: $("map-title"), regions: $("regions-layer"), cities: $("cities-layer"), preview: $("map-preview"),
  count: $("region-count"), viewBox: $("viewbox-readout"), caption: $("caption-name"), details: $("caption-details"),
  highlightList: $("highlight-list"), cityList: $("city-list"), dialog: $("state-dialog"), grid: $("state-grid"),
  selectedCount: $("selected-count"), cityForm: $("city-form"), toast: $("toast"), zoom: $("zoom-value")
};

document.querySelectorAll("[data-preset]").forEach(button => {
  button.addEventListener("click", () => loadPreset(button.dataset.preset));
});

bindColor("base-fill", "fill", "base-fill-code");
bindColor("highlight-fill", "highlightFill", "highlight-fill-code");
bindColor("border-color", "border", "border-color-code");
bindColor("marker-color", "marker", "marker-color-code");
bindColor("marker-border-color", "markerBorder", "marker-border-color-code");
bindRange("border-width", "borderWidth", "border-width-value", value => `${value} px`);
bindRange("marker-size", "markerSize", "marker-size-value", value => `${value} px`);
bindRange("marker-border-width", "markerBorderWidth", "marker-border-width-value", value => `${value} px`);

$("export-svg").addEventListener("click", downloadSvg);
$("copy-svg").addEventListener("click", copySvg);
$("reset-map").addEventListener("click", () => loadPreset(state.preset || "atlanta"));
$("zoom-in").addEventListener("click", () => setZoom(state.zoom + 10));
$("zoom-out").addEventListener("click", () => setZoom(state.zoom - 10));
$("see-all").addEventListener("click", openStateDialog);
$("close-dialog").addEventListener("click", () => elements.dialog.close());
$("state-search").addEventListener("input", renderStateGrid);
$("apply-states").addEventListener("click", applyStateSelection);
$("add-city").addEventListener("click", () => { elements.cityForm.hidden = false; $("city-name").focus(); });
$("cancel-city").addEventListener("click", hideCityForm);
$("save-city").addEventListener("click", addCity);
$("city-preset").addEventListener("change", addPresetCity);
$("region-marker-preset").addEventListener("change", addRegionMarker);
$("marker-mode").addEventListener("change", event => { state.style.markerMode = event.target.value; render(); });
$("place-marker").addEventListener("click", togglePlacementMode);
elements.preview.addEventListener("click", placeMarkerFromMap);
elements.preview.addEventListener("pointermove", moveMarkerDrag);
elements.preview.addEventListener("pointerup", finishMarkerDrag);
elements.preview.addEventListener("pointercancel", finishMarkerDrag);
document.addEventListener("keydown", event => { if (event.key === "Escape" && placementMode) stopPlacementMode(); });

render();

function render() {
  const dataSet = currentDataSet();
  const selectedData = state.selected.map(name => dataSet[name]).filter(Boolean);
  if (!selectedData.length) return;

  const geometryBounds = combinedBounds(selectedData.map(item => item.bounds));
  const tentativeRadius = Math.max(.005, Math.min(geometryBounds.width, geometryBounds.height) * state.style.markerSize / 180);
  const tentativeBorderWidth = tentativeRadius * state.style.markerBorderWidth / 3;
  const markerBounds = state.cities.map(city => {
    const point = projectCity(city);
    if (!point) return null;
    const mode = state.style.markerMode || "dot";
    if (mode === "dot") {
      const outerRadius = tentativeRadius + tentativeBorderWidth;
      return [point[0] - outerRadius, point[1] - outerRadius, point[0] + outerRadius, point[1] + outerRadius];
    }
    const textWidth = tentativeRadius * 1.35 * (city.name || "City").length + tentativeBorderWidth * 2;
    const labelHeight = tentativeRadius * 2.8 + tentativeBorderWidth;
    return mode === "dot-name"
      ? [point[0] - tentativeRadius * 1.6, point[1] - labelHeight, point[0] + tentativeRadius * 2.1 + textWidth, point[1] + labelHeight]
      : [point[0] - textWidth / 2, point[1] - labelHeight, point[0] + textWidth / 2, point[1] + labelHeight];
  }).filter(Boolean);
  const bounds = combinedBounds([geometryBoundsToArray(geometryBounds), ...markerBounds]);
  const padding = Math.max(.8, Math.min(bounds.width, bounds.height) * 0.065);
  const viewBox = [bounds.x - padding, bounds.y - padding, bounds.width + padding * 2, bounds.height + padding * 2].map(round);
  renderedMarkerRadius = Math.max(.005, Math.min(viewBox[2], viewBox[3]) * state.style.markerSize / 180);
  renderedMarkerBorderWidth = renderedMarkerRadius * state.style.markerBorderWidth / 3;
  elements.preview.setAttribute("viewBox", viewBox.join(" "));
  elements.preview.setAttribute("aria-label", `${state.title} map`);
  elements.regions.replaceChildren(...state.selected.map(name => createRegion(name, dataSet[name])));
  elements.cities.replaceChildren(...state.cities.map((marker, index) => createMarker(marker, index)).filter(Boolean));
  elements.title.textContent = state.title;
  elements.count.textContent = `${state.selected.length} ${state.selected.length === 1 ? "path" : "paths"}`;
  elements.viewBox.textContent = `VIEWBOX ${viewBox.join(" / ")}`;
  elements.caption.textContent = state.title.toUpperCase();
  const regionLabel = state.scope === "counties" ? (state.selected.length === 1 ? "COUNTY" : "COUNTIES")
    : state.scope === "subdivisions" ? (state.selected.length === 1 ? "REGION" : "REGIONS")
    : state.scope === "states" ? (state.selected.length === 1 ? "STATE" : "STATES")
      : (state.selected.length === 1 ? "COUNTRY" : "COUNTRIES");
  elements.details.textContent = `${state.selected.length} ${regionLabel} · ${state.cities.length} ${state.cities.length === 1 ? "MARKER" : "MARKERS"}`;
  renderHighlightChips();
  renderCities();
  renderRegionMarkerOptions();
  renderCityOptions();
  syncControls();
}

function createRegion(name, data) {
  const path = document.createElementNS(SVG_NS, "path");
  const regionType = state.scope === "counties" ? "county" : state.scope === "subdivisions" ? "region" : state.scope === "states" ? "state" : "country";
  path.setAttribute("id", `${regionType}-${data.id}`);
  path.dataset.region = name;
  path.dataset[regionType] = name;
  path.setAttribute("d", data.path);
  path.setAttribute("fill", state.highlighted.includes(name) ? state.style.highlightFill : state.style.fill);
  path.setAttribute("stroke", state.style.border);
  path.setAttribute("stroke-width", state.style.borderWidth);
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = name;
  path.append(title);
  return path;
}

function createMarker(city, index) {
  const point = projectCity(city);
  if (!point) return null;
  const group = document.createElementNS(SVG_NS, "g");
  group.classList.add("map-marker");
  group.setAttribute("tabindex", "0");
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", `Move ${city.name || "marker"}`);
  group.addEventListener("pointerdown", event => startMarkerDrag(event, index, group, point));
  if (city.region) group.dataset.regionMarker = city.region;
  else group.dataset.city = city.name || "City";
  const mode = state.style.markerMode || "dot";
  if (mode === "dot" || mode === "dot-name") {
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", round(point[0])); ring.setAttribute("cy", round(point[1]));
    ring.setAttribute("r", round(renderedMarkerRadius + renderedMarkerBorderWidth)); ring.setAttribute("fill", state.style.markerBorder); ring.setAttribute("opacity", ".96");
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", round(point[0])); dot.setAttribute("cy", round(point[1]));
    dot.setAttribute("r", round(renderedMarkerRadius)); dot.setAttribute("fill", state.style.marker);
    group.append(ring, dot);
  }
  if (mode === "name" || mode === "dot-name") {
    const label = document.createElementNS(SVG_NS, "text");
    const fontSize = round(renderedMarkerRadius * 2.25);
    label.textContent = city.name || "City";
    label.setAttribute("x", round(point[0] + (mode === "dot-name" ? renderedMarkerRadius * 2.1 : 0)));
    label.setAttribute("y", round(point[1] + fontSize * .34));
    label.setAttribute("text-anchor", mode === "dot-name" ? "start" : "middle");
    label.setAttribute("font-family", "Manrope, Arial, sans-serif");
    label.setAttribute("font-size", fontSize);
    label.setAttribute("font-weight", "700");
    label.setAttribute("letter-spacing", ".02em");
    label.setAttribute("fill", state.style.marker);
    label.setAttribute("stroke", state.style.markerBorder);
    label.setAttribute("stroke-width", round(renderedMarkerBorderWidth));
    label.setAttribute("paint-order", "stroke fill");
    label.setAttribute("stroke-linejoin", "round");
    label.setAttribute("pointer-events", "painted");
    group.append(label);
  }
  const title = document.createElementNS(SVG_NS, "title"); title.textContent = city.name || "City";
  group.append(title);
  return group;
}

function renderHighlightChips() {
  elements.highlightList.replaceChildren(...state.selected.map(name => {
    const button = document.createElement("button");
    button.className = `chip${state.highlighted.includes(name) ? " active" : ""}`;
    button.textContent = name;
    button.addEventListener("click", () => {
      state.highlighted = state.highlighted.includes(name)
        ? state.highlighted.filter(item => item !== name)
        : [...state.highlighted, name];
      render();
    });
    return button;
  }));
}

function renderCities() {
  if (!state.cities.length) {
    const empty = document.createElement("p");
    empty.className = "field-label";
    empty.textContent = "No markers added";
    elements.cityList.replaceChildren(empty);
    return;
  }
  elements.cityList.replaceChildren(...state.cities.map((city, index) => {
    const row = document.createElement("div"); row.className = "city-item";
    const pin = document.createElement("span"); pin.className = "city-pin"; pin.textContent = "●";
    const info = document.createElement("div"); info.className = "city-info";
    const name = document.createElement("strong"); name.textContent = city.name || "City";
    const coords = document.createElement("span");
    coords.textContent = city.region
      ? `Region center · ${city.region}`
      : `${Number(city.latitude).toFixed(4)}, ${Number(city.longitude).toFixed(4)}`;
    info.append(name, coords);
    const remove = document.createElement("button"); remove.className = "remove-city"; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove ${city.name}`);
    remove.addEventListener("click", () => { state.cities.splice(index, 1); render(); });
    row.append(pin, info, remove);
    return row;
  }));
}

function renderRegionMarkerOptions() {
  const select = $("region-marker-preset");
  const markedRegions = new Set(state.cities.filter(marker => marker.region).map(marker => marker.region));
  const available = state.selected.filter(region => !markedRegions.has(region));
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = available.length ? `Choose a region… (${available.length})` : "All regions marked";
  select.replaceChildren(placeholder, ...available.map(region => {
    const option = document.createElement("option"); option.value = region; option.textContent = region; return option;
  }));
  select.disabled = available.length === 0;
}

function addRegionMarker(event) {
  const region = event.target.value;
  if (!region || !currentDataSet()[region]?.centroid) return;
  state.cities.push({ name: region, region });
  render();
  showToast(`${region} marker added`);
}

function renderCityOptions() {
  const select = $("city-preset");
  const catalog = getCityCatalog();
  const available = catalog.filter(candidate => !state.cities.some(item => item.name === candidate.name));
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = catalog.length ? (available.length ? `Choose a city… (${available.length})` : "All preset cities added") : "No saved cities — pick on map";
  select.replaceChildren(placeholder, ...available.map(candidate => {
    const option = document.createElement("option"); option.value = candidate.name; option.textContent = candidate.name; return option;
  }));
  select.disabled = available.length === 0;
}

function addPresetCity(event) {
  const selectedName = event.target.value;
  if (!selectedName) return;
  const selectedCity = getCityCatalog().find(item => item.name === selectedName);
  if (!selectedCity) return;
  state.cities.push(clone(selectedCity));
  render();
  showToast(`${selectedName} marker added`);
}

function loadPreset(key) {
  const preset = presets[key];
  if (!preset) return;
  stopPlacementMode();
  state = { ...clone(preset), style: { ...defaults, ...(preset.style || {}) }, preset: key, zoom: 100 };
  document.querySelectorAll("[data-preset]").forEach(button => button.classList.toggle("active", button.dataset.preset === key));
  setZoom(100);
  render();
}

function openStateDialog() {
  draftSelection = new Set(state.scope === "states" ? state.selected : []);
  $("state-search").value = "";
  renderStateGrid();
  elements.dialog.showModal();
}

function renderStateGrid() {
  const query = $("state-search").value.toLowerCase().trim();
  const names = Object.keys(MAP_DATA.states).filter(name => name.toLowerCase().includes(query));
  elements.grid.replaceChildren(...names.map(name => {
    const label = document.createElement("label"); label.className = `state-option${draftSelection.has(name) ? " selected" : ""}`;
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = draftSelection.has(name);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? draftSelection.add(name) : draftSelection.delete(name);
      label.classList.toggle("selected", checkbox.checked);
      updateSelectedCount();
    });
    const span = document.createElement("span"); span.textContent = name;
    label.append(checkbox, span); return label;
  }));
  updateSelectedCount();
}

function updateSelectedCount() {
  elements.selectedCount.textContent = `${draftSelection.size} selected`;
  $("apply-states").disabled = draftSelection.size === 0;
}

function applyStateSelection() {
  if (!draftSelection.size) return;
  state.scope = "states";
  delete state.parentState;
  delete state.parentCountry;
  state.selected = [...draftSelection];
  state.highlighted = state.highlighted.filter(name => draftSelection.has(name));
  state.cities = [];
  state.title = state.selected.length === 1 ? state.selected[0] : "Custom US Region";
  state.filename = `${slugify(state.title)}-map.svg`;
  state.preset = null;
  document.querySelectorAll("[data-preset]").forEach(button => button.classList.remove("active"));
  elements.dialog.close();
  render();
}

function addCity() {
  const name = $("city-name").value.trim() || "City";
  const latitude = parseCoordinate($("city-lat").value);
  const longitude = parseCoordinate($("city-lon").value);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    showToast("Enter valid latitude and longitude"); return;
  }
  if (!projectCity({ latitude, longitude })) { showToast("This point is outside the current map projection"); return; }
  state.cities.push({ name, latitude, longitude });
  hideCityForm(); render();
}

function hideCityForm() {
  stopPlacementMode();
  elements.cityForm.hidden = true;
  ["city-name", "city-lat", "city-lon"].forEach(id => { $(id).value = ""; });
}

function togglePlacementMode() {
  placementMode ? stopPlacementMode() : startPlacementMode();
}

function startPlacementMode() {
  placementMode = true;
  $("map-stage").classList.add("placing-marker");
  $("place-marker").classList.add("active");
  $("place-marker").textContent = "Click the map…";
  $("placement-hint").hidden = false;
  showToast("Click the desired position on the map");
}

function stopPlacementMode() {
  placementMode = false;
  $("map-stage").classList.remove("placing-marker");
  $("place-marker").classList.remove("active");
  $("place-marker").innerHTML = "<span>⌖</span>Pick a point on the map";
  $("placement-hint").hidden = true;
}

function placeMarkerFromMap(event) {
  if (!placementMode) return;
  event.preventDefault();
  const matrix = elements.preview.getScreenCTM();
  if (!matrix) return;
  const cursor = elements.preview.createSVGPoint();
  cursor.x = event.clientX; cursor.y = event.clientY;
  const point = cursor.matrixTransform(matrix.inverse());
  const [longitude, latitude] = state.scope === "countries" || state.scope === "subdivisions"
    ? invertMercator(point.x, point.y)
    : invertAlbersUsa(point.x, point.y);
  const markerName = `Marker ${state.cities.length + 1}`;
  state.cities.push({ name: markerName, latitude, longitude });
  stopPlacementMode();
  render();
  showToast(`${markerName} added`);
}

function startMarkerDrag(event, index, group, point) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  stopPlacementMode();
  group.setPointerCapture(event.pointerId);
  group.classList.add("dragging");
  markerDrag = {
    index, group, pointerId: event.pointerId, origin: point,
    cursorStart: eventToSvgPoint(event), cursorCurrent: eventToSvgPoint(event)
  };
}

function moveMarkerDrag(event) {
  if (!markerDrag || event.pointerId !== markerDrag.pointerId) return;
  event.preventDefault();
  markerDrag.cursorCurrent = eventToSvgPoint(event);
  const dx = markerDrag.cursorCurrent.x - markerDrag.cursorStart.x;
  const dy = markerDrag.cursorCurrent.y - markerDrag.cursorStart.y;
  markerDrag.group.setAttribute("transform", `translate(${round(dx)} ${round(dy)})`);
}

function finishMarkerDrag(event) {
  if (!markerDrag || event.pointerId !== markerDrag.pointerId) return;
  const dx = markerDrag.cursorCurrent.x - markerDrag.cursorStart.x;
  const dy = markerDrag.cursorCurrent.y - markerDrag.cursorStart.y;
  const projected = [markerDrag.origin[0] + dx, markerDrag.origin[1] + dy];
  const [longitude, latitude] = state.scope === "countries" || state.scope === "subdivisions"
    ? invertMercator(...projected)
    : invertAlbersUsa(...projected);
  const marker = state.cities[markerDrag.index];
  marker.longitude = longitude;
  marker.latitude = latitude;
  delete marker.region;
  markerDrag.group.classList.remove("dragging");
  if (markerDrag.group.hasPointerCapture(markerDrag.pointerId)) markerDrag.group.releasePointerCapture(markerDrag.pointerId);
  markerDrag = null;
  render();
  showToast(`${marker.name} position updated`);
}

function eventToSvgPoint(event) {
  const matrix = elements.preview.getScreenCTM();
  const point = elements.preview.createSVGPoint();
  point.x = event.clientX; point.y = event.clientY;
  return matrix ? point.matrixTransform(matrix.inverse()) : point;
}

function standaloneSvg() {
  const preview = elements.preview.cloneNode(true);
  preview.removeAttribute("id");
  preview.setAttribute("xmlns", SVG_NS);
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-labelledby", "map-title");
  preview.setAttribute("style", "background:transparent");
  preview.querySelector("title").id = "map-title";
  preview.querySelector("title").textContent = `${state.title} map`;
  if (state.scope === "subdivisions") {
    const metadata = document.createElementNS(SVG_NS, "metadata");
    metadata.textContent = "Administrative boundaries: geoBoundaries gbOpen (CC BY); generated by Territory.";
    preview.insertBefore(metadata, preview.querySelector("title").nextSibling);
  }
  preview.querySelectorAll("g").forEach(group => group.removeAttribute("id"));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${preview.outerHTML}\n`;
}

function downloadSvg() {
  const blob = new Blob([standaloneSvg()], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = state.filename || `${slugify(state.title)}-map.svg`;
  link.click(); URL.revokeObjectURL(url); showToast(`Exported ${link.download}`);
}

async function copySvg() {
  try { await navigator.clipboard.writeText(standaloneSvg()); showToast("SVG copied to clipboard"); }
  catch { showToast("Clipboard access is unavailable"); }
}

function bindColor(inputId, styleKey, codeId) {
  $(inputId).addEventListener("input", event => {
    state.style[styleKey] = event.target.value;
    $(codeId).textContent = event.target.value.toUpperCase();
    render();
  });
}

function bindRange(inputId, styleKey, outputId, format) {
  $(inputId).addEventListener("input", event => {
    const value = Number(event.target.value); state.style[styleKey] = value;
    $(outputId).textContent = format(value); updateRangeFill(event.target); render();
  });
}

function syncControls() {
  const bindings = [
    ["base-fill", state.style.fill, "base-fill-code"], ["highlight-fill", state.style.highlightFill, "highlight-fill-code"],
    ["border-color", state.style.border, "border-color-code"], ["marker-color", state.style.marker, "marker-color-code"],
    ["marker-border-color", state.style.markerBorder, "marker-border-color-code"]
  ];
  bindings.forEach(([input, value, code]) => { $(input).value = value; $(code).textContent = value.toUpperCase(); });
  $("border-width").value = state.style.borderWidth; $("border-width-value").textContent = `${state.style.borderWidth} px`;
  $("marker-size").value = state.style.markerSize; $("marker-size-value").textContent = `${state.style.markerSize} px`;
  $("marker-border-width").value = state.style.markerBorderWidth; $("marker-border-width-value").textContent = `${state.style.markerBorderWidth} px`;
  $("marker-mode").value = state.style.markerMode || "dot";
  updateRangeFill($("border-width")); updateRangeFill($("marker-size"));
  updateRangeFill($("marker-border-width"));
}

function updateRangeFill(input) {
  const percent = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  input.style.setProperty("--range", `${percent}%`);
}

function setZoom(value) {
  state.zoom = Math.max(60, Math.min(140, value));
  elements.zoom.textContent = `${state.zoom}%`;
  elements.preview.style.width = `min(${state.zoom * .78}%, 900px)`;
  elements.preview.style.height = `min(${state.zoom * .68}%, 620px)`;
}

function combinedBounds(items) {
  const x0 = Math.min(...items.map(item => item[0])), y0 = Math.min(...items.map(item => item[1]));
  const x1 = Math.max(...items.map(item => item[2])), y1 = Math.max(...items.map(item => item[3]));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function geometryBoundsToArray(bounds) {
  return [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height];
}

function stateCounties(name) {
  return {
    title: `${name} Counties`, scope: "counties", parentState: name,
    selected: Object.keys(MAP_DATA.counties?.[name] || {}), highlighted: [], cities: [],
    style: { fill: "#e86f32", highlightFill: "#c94d31", border: "#fff3e9", borderWidth: 1.25, marker: "#17212b", markerSize: 4 },
    filename: `${slugify(name)}-counties-map.svg`
  };
}

function countryRegions(name) {
  return {
    title: `${name} Regions`, scope: "subdivisions", parentCountry: name,
    selected: Object.keys(MAP_DATA.subdivisions?.[name] || {}), highlighted: [], cities: [],
    style: { fill: "#e86f32", highlightFill: "#c94d31", border: "#fff3e9", borderWidth: 1.1, marker: "#17212b", markerSize: 4 },
    filename: `${slugify(name)}-regions-map.svg`
  };
}

function currentDataSet() {
  if (state.scope === "countries") return MAP_DATA.countries;
  if (state.scope === "subdivisions") return MAP_DATA.subdivisions?.[state.parentCountry] || {};
  if (state.scope === "counties") return MAP_DATA.counties?.[state.parentState] || {};
  return MAP_DATA.states;
}

function getCityCatalog() {
  const keys = [];
  if (state.parentState) keys.push(AREA_CATALOG[state.parentState]);
  if (state.parentCountry) keys.push(AREA_CATALOG[state.parentCountry]);
  if (state.scope === "states") state.selected.forEach(area => keys.push(AREA_CATALOG[area]));
  if (!keys.length && state.preset) keys.push(state.preset);
  const seen = new Set();
  return keys.filter(Boolean).flatMap(key => CITY_CATALOG[key] || []).filter(item => {
    const identity = `${item.name}:${item.latitude}:${item.longitude}`;
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  });
}

function projectCity(marker) {
  if (marker.region) return currentDataSet()[marker.region]?.centroid || null;
  return state.scope === "countries" || state.scope === "subdivisions"
    ? projectMercator(Number(marker.longitude), Number(marker.latitude))
    : projectAlbersUsa(Number(marker.longitude), Number(marker.latitude));
}

function parseCoordinate(value) {
  const normalized = String(value).trim().replace(",", ".");
  return normalized === "" ? NaN : Number(normalized);
}

function city(name, latitude, longitude) { return { name, latitude, longitude }; }

function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function round(value) { return Math.round(value * 100) / 100; }
function $(id) { return document.getElementById(id); }
function showToast(message) {
  elements.toast.textContent = message; elements.toast.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}
