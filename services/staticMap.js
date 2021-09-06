const request = require('postman-request');
const circleToPolygon = require('circle-to-polygon');

const staticImageUrl = 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/';
const width = 600;
const height = 600;
const defaultRadius = 50;

const mapImage = (lon, lat) => {
	return new Promise((resolve, reject) => {
		const point = {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: [
					lon, lat,
				],
			},
			properties: {},
		};
		const polygon = {
			type: 'Feature',
			geometry: circleToPolygon([lon, lat], defaultRadius),
			properties: {},
		};
		const geojson = {
			type: 'FeatureCollection',
			features: [
				polygon, point,
			],
		};

		const url = staticImageUrl + 'geojson(' + encodeURIComponent(JSON.stringify(geojson)) + ')/' + encodeURIComponent(lon) + ',' +
            encodeURIComponent(lat) + ',15/' + width + 'x' + height + '?access_token=' + encodeURIComponent(process.env.MAPBOX_API_KEY);

		request({ url, encoding: null }, (error, { body } = {}) => {
			if (error)
				reject('Unable to connect to static image api! ' + error);
			else
				resolve(Buffer.from(body));
		});
	});
};

module.exports = mapImage;