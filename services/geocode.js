const request = require('postman-request');

const forward = (address) => {
  return new Promise((resolve, reject) => {
    const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(address) + '.json?' +
            'access_token=' + encodeURIComponent(process.env.MAPBOX_API_KEY) +
            '&limit=1';

    request({ url, json: true }, (error, { body } = {}) => {
      if (error) {
        reject('Unable to connet to location services! ' + error);
      } else if (body.features.length === 0) {
        reject('Location not found! Try another search term.');
      } else {
        const { place_name: location, center } = body.features[0];
        resolve({
          location,
          lon: center[0],
          lat: center[1],
        });
      }
    });
  });
};

const reverse = (lon, lat) => {
  return new Promise((resolve, reject) => {
    const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(lon) + ',' + encodeURIComponent(lat) + '.json?' +
        'access_token=' + encodeURIComponent(process.env.MAPBOX_API_KEY) + '&limit=1&language=de';

    request({ url, json: true }, (error, { body } = {}) => {
      if (error) {
        reject('Unable to connet to location services! ' + error);
      } else if (!body.features || body.features.length === 0) {
        reject('Location not found! Try another search term.');
      } else {
        const { place_name } = body.features[0];
        resolve({
          place_name,
        });
      }
    });
  });
};

module.exports = {
  forward,
  reverse,
};