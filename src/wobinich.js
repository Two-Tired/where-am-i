const { MessageAttachment, MessageEmbed } = require('discord.js');
const geocode = require('../services/geocode');
const mapImage = require('../services/staticMap');

let currentQuiz = undefined;

const newGameHandler = async (argv) => {
	const msg = argv.msg;
	const client = argv.client;
	const lon = argv.lon;
	const lat = argv.lat;
	if (msg.attachments.size != 1)
		return msg.reply('Kein Bild (oder zu viele Bilder) angehangen. Bitte hänge ein Bild, das gesucht werden soll an diese Nachricht an.');
	if (currentQuiz)
		return msg.reply('Es läuft bereits eine Runde von ' + currentQuiz.master.username + '. Bitte warte bis dise abgeschlossen ist bevor du eine neue Runde startest.');

	try {
		currentQuiz = 'lock';
		const channel = await client.channels.fetch(process.env.WOBINICH_CHANNEL_ID);
		const attachment = msg.attachments.values().next().value;

		const { place_name } = await geocode.reverse(lon, lat);

		const imageBuffer = await mapImage(lon, lat);

		const correctionMessage = await msg.reply({
			content: 'Dies ist das Ergebnis `' + place_name + '` das du angegeben hast. Ist dies korrekt?',
			files: [new MessageAttachment(imageBuffer, 'solution.png')],
		});
		const solutionMap = correctionMessage.attachments.values().next().value;

		const startMessage = await channel.send({
			content: 'Eine neue Runde wurde von ' + msg.author.username + ' gestartet. Sendet eine Nachricht an den Bot, falls ihr denkt die Lösung zu kennen.',
			files: [attachment.url],
		});

		currentQuiz = {
			master: msg.author, // user that started the picture game
			location: {
				lon, // longitude of the location
				lat, // latitude of the location
			},
			starttime: new Date(),
			picture: attachment.url, // url of the picture,
			startMessage,
			solutionMap,
			place_name, // name of the location
		};
	} catch (error) {
		console.log(error);
	}
};

const finishGameHandler = async (argv) => {
	const msg = argv.msg;
	const client = argv.client;
	if (!currentQuiz)
		return msg.reply('Es läuft zur Zeit keine Runde. Du kannst eine neue Runde mit "start" starten.');
	if (!currentQuiz.master.id === msg.author.id)
		return msg.reply('Du bist nicht der Master der derzeitigen Runde. Nur ' + currentQuiz.master.username + ' kann die Runde auflösen.');

	const channel = await client.channels.fetch(process.env.WOBINICH_CHANNEL_ID);

	const resultEmbed = new MessageEmbed()
		.setTitle('Auflösung!')
		.setURL(`https://www.openstreetmap.org/search?whereami=1&query=${currentQuiz.location.lat}%2C${currentQuiz.location.lon}#map=15/${currentQuiz.location.lat}/${currentQuiz.location.lon}`)
		.setImage(currentQuiz.solutionMap.url)
		.addField('Ort', currentQuiz.place_name)
		.setAuthor(currentQuiz.master.username)
		.setTimestamp()
		.setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Openstreetmap_logo.svg/256px-Openstreetmap_logo.svg.png');

	await channel.send({ embeds: [resultEmbed] });

	// reset currentQuiz to allow a new quiz to be started
	currentQuiz = undefined;
};

module.exports = {
	newGameHandler,
	finishGameHandler,
};