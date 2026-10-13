const API = 'https://vpic.nhtsa.dot.gov/api/vehicles/';
const OTHER = '__other__';
const cache = new Map();

async function catalog(path) {
  const key = 'fareride_vehicle_catalog_v1:' + path;
  if (cache.has(path)) return cache.get(path);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Date.now() - saved.time < 7 * 86400000 && Array.isArray(saved.results)) {
      cache.set(path, saved.results);
      return saved.results;
    }
  } catch {}
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API + path + '?format=json', {signal: controller.signal});
    if (!response.ok) throw new Error('Vehicle catalog unavailable.');
    const data = await response.json();
    if (!Array.isArray(data.Results)) throw new Error('Invalid vehicle catalog.');
    cache.set(path, data.Results);
    try { localStorage.setItem(key, JSON.stringify({time: Date.now(), results: data.Results})); } catch {}
    return data.Results;
  } finally { clearTimeout(timer); }
}

function options(select, rows, placeholder) {
  select.replaceChildren(new Option(placeholder, ''));
  for (const row of rows) select.add(new Option(row.name, row.id));
  select.add(new Option('Other / not listed', OTHER));
}

export function createVehiclePicker() {
  const get = id => document.getElementById(id);
  const year = get('towVehicleYear'), make = get('towVehicleMake'), model = get('towVehicleModel');
  const customMake = get('towVehicleMakeOther'), customModel = get('towVehicleModelOther');
  const status = get('vehicleCatalogStatus'), retry = get('vehicleCatalogRetry');
  let active = false, makesLoaded = false, loadingMakes = false, loadingModels = false, version = 0;
  year.replaceChildren(new Option('Select year', ''));
  for (let value = new Date().getFullYear() + 1; value >= 1900; value--) year.add(new Option(String(value), String(value)));
  options(make, [], 'Select year first');
  options(model, [], 'Select make first');

  function description() {
    const makeName = make.value === OTHER ? customMake.value.trim() : make.selectedOptions[0]?.textContent;
    const modelName = model.value === OTHER ? customModel.value.trim() : model.selectedOptions[0]?.textContent;
    if (!year.value || !make.value || !model.value || !makeName || !modelName || loadingModels || loadingMakes) {
      throw new Error('Choose the vehicle year, make and model, or enter the unlisted vehicle details.');
    }
    const value = [year.value, makeName, modelName].join(' ');
    if (value.length > 500) throw new Error('Keep vehicle details under 500 characters.');
    return value;
  }
  function sync() {
    make.disabled = !year.value || loadingMakes;
    model.disabled = !year.value || !make.value || loadingModels;
    customMake.closest('label').hidden = make.value !== OTHER;
    customModel.closest('label').hidden = model.value !== OTHER;
    year.required = active;
    make.required = active;
    model.required = active;
    customMake.required = active && make.value === OTHER;
    customModel.required = active && model.value === OTHER;
    customMake.disabled = make.value !== OTHER;
    customModel.disabled = model.value !== OTHER;
    try { get('towVehicle').value = description(); } catch { get('towVehicle').value = ''; }
  }
  function changed() {
    sync();
    get('towVehicle').dispatchEvent(new Event('input', {bubbles: true}));
  }
  async function loadMakes() {
    if (loadingMakes || makesLoaded) return;
    loadingMakes = true;
    status.textContent = 'Loading vehicle makes…'; retry.hidden = true; sync();
    try {
      const results = await catalog('GetAllMakes');
      const unique = new Map();
      for (const row of results) if (row.Make_ID && row.Make_Name?.trim()) unique.set(String(row.Make_ID), row.Make_Name.trim());
      const rows = [...unique].map(([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
      if (!rows.length) throw new Error('No makes available.');
      options(make, rows, 'Select make'); makesLoaded = true;
      status.textContent = 'Choose your vehicle year, make and model.';
    } catch {
      options(make, [], 'Select make');
      status.textContent = 'Vehicle catalog unavailable. Choose Other / not listed and enter your make and model, or retry.';
      retry.hidden = false;
    } finally { loadingMakes = false; changed(); }
  }
  async function loadModels() {
    const request = ++version, makeId = make.value, selectedYear = year.value;
    loadingModels = false;
    customModel.value = '';
    options(model, [], makeId ? 'Select model' : 'Select make first');
    retry.hidden = true;
    if (!makeId || !selectedYear) { status.textContent = 'Choose your vehicle year, make and model.'; changed(); return; }
    if (makeId === OTHER) {
      model.value = OTHER;
      status.textContent = 'Enter your vehicle make and model.'; changed(); return;
    }
    loadingModels = true;
    status.textContent = 'Loading models…'; changed();
    try {
      // The year-specific endpoint supports model years after 1995.
      const path = Number(selectedYear) > 1995
        ? 'GetModelsForMakeIdYear/makeId/' + makeId + '/modelyear/' + selectedYear
        : 'GetModelsForMakeId/' + makeId;
      const results = await catalog(path);
      if (request !== version) return;
      const names = [...new Set(results.filter(row => String(row.Make_ID) === makeId).map(row => row.Model_Name?.trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'en', {sensitivity: 'base'}));
      options(model, names.map(name => ({id: name, name})), 'Select model');
      status.textContent = names.length ? (Number(selectedYear) <= 1995 ? 'Older vehicle: models are listed across all years. Choose the model on your vehicle.' : 'Select the model for your ' + selectedYear + ' ' + make.selectedOptions[0].textContent + '.')
        : 'No models listed for this year and make. Choose Other / not listed to enter your model.';
    } catch {
      if (request !== version) return;
      status.textContent = 'Models could not load. Choose Other / not listed to enter your model, or retry.';
      retry.hidden = false;
    } finally { if (request === version) { loadingModels = false; changed(); } }
  }
  year.addEventListener('change', () => { if (!makesLoaded) loadMakes(); loadModels(); });
  make.addEventListener('change', () => { customMake.value = ''; loadModels(); });
  model.addEventListener('change', changed);
  customMake.addEventListener('input', changed);
  customModel.addEventListener('input', changed);
  retry.addEventListener('click', () => makesLoaded ? loadModels() : loadMakes());
  sync();
  return {description, setActive(value) { active = value; sync(); if (active) loadMakes(); }};
}
