const API = 'https://vpic.nhtsa.dot.gov/api/vehicles/';
const OTHER = '__other__';
// Familiar passenger-car, SUV and pickup brands; other vehicles can be entered manually.
const MAKES = ['Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick',
  'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Fisker', 'Ford',
  'Genesis', 'GMC', 'Honda', 'Hummer', 'Hyundai', 'Infiniti', 'Isuzu', 'Jaguar', 'Jeep',
  'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Lucid', 'Maserati',
  'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Oldsmobile', 'Plymouth',
  'Polestar', 'Pontiac', 'Porsche', 'Ram', 'Rivian', 'Rolls-Royce', 'Saab', 'Saturn',
  'Scion', 'Smart', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'VinFast', 'Volkswagen', 'Volvo'];
const VEHICLE_TYPES = ['car', 'truck', 'multipurpose'];
const normalizeMake = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cache = new Map();

async function catalog(path) {
  const key = 'fareride_vehicle_catalog_v2:' + path;
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
  let active = false, loadingModels = false, version = 0;
  year.replaceChildren(new Option('Select year', ''));
  for (let value = new Date().getFullYear() + 1; value >= 1900; value--) year.add(new Option(String(value), String(value)));
  options(make, MAKES.map(name => ({id: name, name})).sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})), 'Select make');
  options(model, [], 'Select make first');

  function description() {
    const makeName = make.value === OTHER ? customMake.value.trim() : make.selectedOptions[0]?.textContent;
    const modelName = model.value === OTHER ? customModel.value.trim() : model.selectedOptions[0]?.textContent;
    if (!year.value || !make.value || !model.value || !makeName || !modelName || loadingModels) {
      throw new Error('Choose the vehicle year, make and model, or enter the unlisted vehicle details.');
    }
    const value = [year.value, makeName, modelName].join(' ');
    if (value.length > 500) throw new Error('Keep vehicle details under 500 characters.');
    return value;
  }
  function sync() {
    make.disabled = !year.value;
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
      const base = 'GetModelsForMakeYear/make/' + encodeURIComponent(makeId)
        + (Number(selectedYear) > 1995 ? '/modelyear/' + selectedYear : '');
      const results = (await Promise.all(VEHICLE_TYPES.map(type => catalog(base + '/vehicletype/' + type)))).flat();
      if (request !== version) return;
      const names = [...new Set(results.filter(row => normalizeMake(row.Make_Name) === normalizeMake(makeId)).map(row => row.Model_Name?.trim()).filter(Boolean))]
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
  year.addEventListener('change', loadModels);
  make.addEventListener('change', () => { customMake.value = ''; loadModels(); });
  model.addEventListener('change', changed);
  customMake.addEventListener('input', changed);
  customModel.addEventListener('input', changed);
  retry.addEventListener('click', loadModels);
  sync();
  return {description, setActive(value) { active = value; sync(); }};
}
