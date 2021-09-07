const geolib = require('geolib');

const coordFromURLregex = /([0-9]*\.[0-9]*)[,|/|%2C]([0-9]*\.[0-9]*)/;
const dateOptions = {
  day: '2-digit',
  year: 'numeric',
  month: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
};

const parseURL = (url) => {
  const parsed = url.match(coordFromURLregex);
  if (parsed.length < 3)
    throw new Error('URL parsing failed');
  const lon = parseFloat(parsed[2]);
  const lat = parseFloat(parsed[1]);
  return { lon, lat };
};

const dateString = (date) => {
  return date.toLocaleDateString('de-DE', dateOptions);
};

const getDistance = (from, to) => {
  return geolib.getDistance({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
};

module.exports = {
  parseURL,
  dateString,
  getDistance,
};