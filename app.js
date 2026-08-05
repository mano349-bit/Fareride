const pickup = document.getElementById('pickup');
const destination = document.getElementById('destination');
const estimateBtn = document.getElementById('estimateBtn');
const estimatePanel = document.getElementById('estimatePanel');
const statusPanel = document.getElementById('statusPanel');
const tripDistance = document.getElementById('tripDistance');
const selectedFare = document.getElementById('selectedFare');
const requestBtn = document.getElementById('requestBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusText = document.getElementById('statusText');

let selectedType = 'Standard';
let selectedPrice = 18;

estimateBtn.addEventListener('click', () => {
  if (!pickup.value.trim() || !destination.value.trim()) {
    alert('Please enter pickup and destination.');
    return;
  }
  estimatePanel.classList.remove('hidden');
  tripDistance.textContent = 'Approx. 7.4 mi';
  estimatePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelectorAll('.ride-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ride-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedType = btn.dataset.type;
    selectedPrice = Number(btn.dataset.price);
    selectedFare.textContent = `$${selectedPrice}`;
    requestBtn.textContent = `Request ${selectedType}`;
  });
});

requestBtn.addEventListener('click', () => {
  estimatePanel.classList.add('hidden');
  statusPanel.classList.remove('hidden');
  statusText.textContent = `${selectedType} ride requested for an estimated $${selectedPrice}.`;
  statusPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

cancelBtn.addEventListener('click', () => {
  statusPanel.classList.add('hidden');
  estimatePanel.classList.remove('hidden');
});

document.getElementById('profileBtn').addEventListener('click', () => {
  alert('Customer profile screen will be connected in the next version.');
});
