const { MessageAttachment, MessageEmbed } = require('discord.js');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
const utils = require('../src/utils');
const geocode = require('../services/geocode');
const mapImage = require('../services/staticMap');

let currentQuiz = undefined;

const newGameHandler = async (argv) => {
  const { msg, client, lon, lat, radius, url } = argv;
  if (msg.attachments.size != 1)
    return msg.reply('Kein Bild (oder zu viele Bilder) angehangen. Bitte hänge ein Bild, das gesucht werden soll an diese Nachricht an.');
  if (currentQuiz)
    return msg.reply('Es läuft bereits eine Runde von ' + currentQuiz.master.username + '. Bitte warte bis dise abgeschlossen ist bevor du eine neue Runde startest.');

  let solution = { lon, lat };
  if (url)
    solution = utils.parseURL(url);

  solution.radius = radius ?? 50;

  try {
    currentQuiz = 'lock';
    const channel = await client.channels.fetch(process.env.WOBINICH_CHANNEL_ID);
    const attachment = msg.attachments.values().next().value;

    const { place_name } = await geocode.reverse(lon, lat);
    solution.place_name = place_name;

    const imageBuffer = await mapImage(lon, lat, radius);

    const correctionMessage = await msg.reply({
      content: 'Dies ist das Ergebnis `' + place_name + '` das du angegeben hast. Ist dies korrekt?',
      files: [new MessageAttachment(imageBuffer, 'solution.png')],
    });
    solution.map = correctionMessage.attachments.values().next().value;
    
    const starttime = new Date();
    const startEmbed = new MessageEmbed()
      .setTitle('Eine neue Runde beginnt!')
      .setImage(attachment.url)
      .setAuthor(msg.author.username)
      .addField('Startzeit', utils.dateString(starttime))
      .setTimestamp();

    const startMessage = await channel.send({ embeds: [ startEmbed ] });

    currentQuiz = {
      master: msg.author, // user that started the picture game
      solution,
      solves: [],
      starttime,
      picture: attachment.url, // url of the picture,
      startMessage,
    };
  } catch (error) {
    logger.error(error);
    currentQuiz = undefined;
  }
};

const finishGameHandler = async (argv) => {
  const { msg, client } = argv;
  if (!currentQuiz)
    return msg.reply('Es läuft zur Zeit keine Runde. Du kannst eine neue Runde mit "start" starten.');
  if (currentQuiz.master.id !== msg.author.id)
    return msg.reply('Du bist nicht der Master der derzeitigen Runde. Nur ' + currentQuiz.master.username + ' kann die Runde auflösen.');

  const channel = await client.channels.fetch(process.env.WOBINICH_CHANNEL_ID);

  const resultEmbed = new MessageEmbed()
    .setTitle('Auflösung!')
    .setURL(`https://www.openstreetmap.org/search?whereami=1&query=${currentQuiz.solution.lat}%2C${currentQuiz.solution.lon}#map=15/${currentQuiz.solution.lat}/${currentQuiz.solution.lon}`)
    .setImage(currentQuiz.solution.map.url)
    .addField('Ort', currentQuiz.solution.place_name)
    .addField('Anzahl erfolgreicher Lösungen', currentQuiz.solves.length.toString())
    .setAuthor(currentQuiz.master.username)
    .setTimestamp()
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Openstreetmap_logo.svg/256px-Openstreetmap_logo.svg.png');

  await channel.send({ embeds: [resultEmbed] });

  // reset currentQuiz to allow a new quiz to be started
  currentQuiz = undefined;
};

const guessHandler = async (argv) => {
  const { msg, lon, lat, url } = argv;
  // if (!currentQuiz)
  //   return msg.reply('Es läuft zur Zeit keine Runde. Du kannst eine neue Runde mit "start" starten.')
  //     .then(r => logger.info(msg, `Sent reply '${r.content}'.`));

  let guess = { lon, lat };
  if (url)
    guess = utils.parseURL(url);
    // const parsed = url.match(coordFromURLregex);
    // logger.info(parsed);
    // longitude = parseFloat(parsed[2]);
    // latitude = parseFloat(parsed[1]);
    // logger.info(longitude);
    // logger.info(latitude);

  const solution = { lon: currentQuiz.solution.lon, lat: currentQuiz.solution.lat };
  const distanceFromSolution = utils.getDistance(solution, guess);

  logger.info({ guess, solution, distanceFromSolution }, 'New guess received.');

  if (distanceFromSolution <= currentQuiz.solution.radius) {
    msg.reply(`Herzlichen Glückwunsch, die Lösung ist richtig! Du liegt ${distanceFromSolution} Meter neben den angegebenen Koordinaten.`)
      .then(r => logger.info(`Sent reply '${r.content}''.`))
      .catch(logger.error);

    currentQuiz.solves.push({
      user: msg.author,
      time: new Date(),
    });
    const numSolves = currentQuiz.solves.length;
    const fieldName = `Lösung ${numSolves} um ${utils.dateString(currentQuiz.solves[numSolves - 1].time)}`;

    const updatedStartEmbed = new MessageEmbed(currentQuiz.startMessage.embeds[0])
      .setTimestamp()
      .addField(fieldName, msg.author.username, numSolves != 1);

    try {
      currentQuiz.startMessage = await currentQuiz.startMessage.edit({ embeds: [updatedStartEmbed] });
      logger.info('Updated start message with solver.');
    } catch (e) {
      logger.error(e);
    }

  } else if (distanceFromSolution <= 2 * currentQuiz.solution.radius) {
    msg.reply(`Deine Lösung ist leider nicht ganz richtig, du bist aber nah dran! Deine Lösung ist maximal ${2 * currentQuiz.solution.radius} Meter neben den angegebenen Koordinaten.`)
      .then(r => logger.info(`Sent reply '${r.content}'. Distance to target: ${distanceFromSolution}.`))
      .catch(logger.error);
  } else {
    msg.reply('Deine Lösung ist leider falsch. Probiere es aber gerne noch einmal.')
      .then(r => logger.info(`Sent reply '${r.content}'. Distance to target: ${distanceFromSolution}.`))
      .catch(logger.error);
  }
};

module.exports = {
  newGameHandler,
  finishGameHandler,
  guessHandler,
};