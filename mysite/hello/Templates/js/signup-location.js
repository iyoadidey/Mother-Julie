document.addEventListener('DOMContentLoaded', function () {
  const icon = document.getElementById('use-my-location');
  if (!icon) return;

  const configEl = document.getElementById('gmaps-config');
  const apiKey = configEl ? (configEl.getAttribute('data-api-key') || '') : '';

  const latEl = document.getElementById('latitude');
  const lonEl = document.getElementById('longitude');
  const locEl = document.getElementById('location');

  async function reverseGeocode(lat, lon) {
    if (!apiKey) return null;
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results && data.results.length) {
        return data.results[0].formatted_address;
      }
    } catch (_) {
      // swallow
    }
    return null;
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (latEl) latEl.value = lat;
      if (lonEl) lonEl.value = lon;
      const address = await reverseGeocode(lat, lon);
      if (address && locEl) {
        locEl.value = address;
      }
    }, () => {
      alert('Unable to get current location.');
    });
  }

  icon.addEventListener('click', handleUseMyLocation);
});


