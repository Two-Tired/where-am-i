const yargs = require('yargs');
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
				describe: 'geographische Länge des Fotos (E)',
				float: true,
			})
			.option('lat', {
				alias: 'n',
				implies: 'lon',
				demandOption: true,
				describe: 'geographische Breite des Aufnahmeortes (N)',
				float: true,
			}),
		wobinich.newGameHandler,
	)
	.command(
		'finish',
		'Beendet eine laufende Runde "Wo bin ich?" und sendet die Lösung in den Channel. Kann nur ausgeführt werden, wenn man der Master der aktuellen Runde ist.',
		_yargs => _yargs,
		wobinich.finishGameHandler,
	);