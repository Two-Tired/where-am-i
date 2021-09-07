const yargs = require('yargs');
// const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
const utils = require('./utils');
const wobinich = require('./wobinich');

module.exports = yargs
  .scriptName('!')
  .alias('h', 'help')
  .help('help')
  .showHelpOnFail(false, 'Specify --help for available options')
  .command(
    'start [url]',
    'Startet eine neue Runde "Wo bin ich?" mit dem angehängten Foto. Kann nur ausgeführt werden, falls nicht bereits eine Runde läuft.',
    _yargs => _yargs
      .option('lon', {
        alias: 'e',
        implies: 'lat',
        describe: 'geographische Länge des Aufnahmeortes (E)',
        conflicts: 'url',
        float: true,
      })
      .option('lat', {
        alias: 'n',
        implies: 'lon',
        describe: 'geographische Breite des Aufnahmeortes (N)',
        conflicts: 'url',
        float: true,
      })
      .positional('url', {
        conflicts: [ 'lat', 'lon' ],
        describe: 'URL von OpenStreetMaps, Google Maps or www.koordinaten-umrechner.de des Aufnahmeortes.',
        string: true,
      })
      .option('radius', {
        alias: 'r',
        demandOption: false,
        describe: 'maximaler Radius in Metern um die angegebenen Koordinaten in dem eine Lösung als richtig gilt, default: 50',
        float: true,
      })
      .middleware(convertURLtoLonLat)
      .check(checkCoordinateInput),
    wobinich.newGameHandler,
  )
  .command(
    'finish',
    'Beendet eine laufende Runde "Wo bin ich?" und sendet die Lösung in den Channel. Kann nur ausgeführt werden, wenn man der Master der aktuellen Runde ist.',
    _yargs => _yargs,
    wobinich.finishGameHandler,
  )
  .command(
    'guess [url]',
    'Gibt einen Tipp zur derzeitigen Runde ab.',
    _yargs => _yargs
      .option('lon', {
        alias: 'e',
        implies: 'lat',
        describe: 'geographische Länge des Tipps (E)',
        conflicts: 'url',
        float: true,
      })
      .option('lat', {
        alias: 'n',
        implies: 'lon',
        describe: 'geographische Breite des Tipps (N)',
        conflicts: 'url',
        float: true,
      })
      .positional('url', {
        conflicts: [ 'lat', 'lon' ],
        describe: 'URL von OpenStreetMaps, Google Maps or www.koordinaten-umrechner.de des Tipps.',
        string: true,
      })
      .middleware(convertURLtoLonLat)
      .check(checkCoordinateInput),
    wobinich.guessHandler,
  );

const checkCoordinateInput = ({ lon, lat, url }) => {
  if (!lon && !lat && !url)
    throw new Error('Entweder lon-lat oder url müssen gesetzt sein!');
  if (lon < -180 || lon > 180)
    throw new Error('Longitude muss im Bereich -180 (W) bis 180 (E) liegen!');
  if (lat < -90 || lat > 90)
    throw new Error('Latitude muss im Bereich -90 (S) bis 90 (N) liegen!');
  return true;
};

const convertURLtoLonLat = (argv) => {
  if (argv.url) {
    const url = argv.url;
    delete argv.url;
    return utils.parseURL(url);
  }
};