const yargs = require('yargs');
// const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
const wobinich = require('./wobinich');

module.exports = yargs
  .scriptName('!')
  .alias('h', 'help')
  .help('help')
  .showHelpOnFail(false, 'Specify --help for available options')
  .command(
    'start',
    'Startet eine neue Runde "Wo bin ich?" mit dem angehängten Foto. Kann nur ausgeführt werden, falls nicht bereits eine Runde läuft.',
    _yargs => _yargs
      .option('lon', {
        alias: 'e',
        implies: 'lat',
        demandOption: true,
        describe: 'geographische Länge des Aufnahmeortes (E)',
        float: true,
      })
      .option('lat', {
        alias: 'n',
        implies: 'lon',
        demandOption: true,
        describe: 'geographische Breite des Aufnahmeortes (N)',
        float: true,
      })
      .option('radius', {
        alias: 'r',
        demandOption: false,
        describe: 'maximaler Radius um die angegebenen Koordinaten in dem eine Lösung als richtig gilt',
        float: true,
      }),
    wobinich.newGameHandler,
  )
  .command(
    'finish',
    'Beendet eine laufende Runde "Wo bin ich?" und sendet die Lösung in den Channel. Kann nur ausgeführt werden, wenn man der Master der aktuellen Runde ist.',
    _yargs => _yargs,
    wobinich.finishGameHandler,
  )
  .command(
    'guess',
    'Gibt einen Tipp zur derzeitigen Runde ab.',
    _yargs => _yargs
      .option('lon', {
        alias: 'e',
        implies: 'lat',
        describe: 'geographische Länge des Tipps (E)',
        float: true,
      })
      .option('lat', {
        alias: 'n',
        implies: 'lon',
        describe: 'geographische Breite des Tipps (N)',
        float: true,
      })
      .option('url', {
        alias: 'u',
        conflicts: [ 'lat', 'lon' ],
        describe: 'URL von OpenStreetMaps, Google Maps or www.koordinaten-umrechner.de des Tipps.',
        string: true,
      })
      .check(({ lon, lat, url }) => {
        if (!lon && !lat && !url)
          throw new Error('Entweder lon-lat oder url müssen gesetzt sein!');
        return true;
      }),
    wobinich.guessHandler,
  );