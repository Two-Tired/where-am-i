const { MessageAttachment, MessageEmbed, MessagePayload } = require('discord.js');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
const utils = require('../src/utils');
const geocode = require('../services/geocode');
const mapImage = require('../services/staticMap');

let currentQuiz = undefined;

const newGameHandler = async (argv) => {
  const { msg, client, lon, lat, radius } = argv;

  if (msg.attachments.size > 1)
    return msg.reply('Zu viele Bilder angehangen. Bitte hänge maximal ein Bild an diese Nachricht an.');
  if (currentQuiz)
    return msg.reply('Es läuft bereits eine Runde von ' + currentQuiz.master.username + '. Bitte warte bis dise abgeschlossen ist bevor du eine neue Runde startest.');

  try {
    currentQuiz = 'lock';
    const channel = await client.channels.fetch(process.env.WOBINICH_CHANNEL_ID);
    
    const attachment = await getPicture(msg);
    
    const { place_name } = await geocode.reverse(lon, lat);

    const imageBuffer = await mapImage(lon, lat, radius);

    await confirmationMessage(msg, {
      content: 'Dies ist das Ergebnis `' + place_name + '` das du angegeben hast. Ist dies korrekt? Dann reagiere mit 👍 auf diese Nachricht.',
      files: [new MessageAttachment(imageBuffer, 'solution.png')],
    });
    await msg.reply('Die Runde wird jetzt gestartet!');

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
      solution: {
        lon,
        lat,
        map: correctionMessage.attachments.values().next().value,
        place_name,
        radius: radius ?? 50,
      },
      solves: [],
      starttime,
      picture: attachment.url, // url of the picture,
      startMessage,
    };
  } catch (error) {
    logger.info('newGameHandler stopped with message: ' + error);
    currentQuiz = undefined;
  }
};

/**
 * Gets the attached image from the given message or queries for the image in a new message.
 *
 * @param {import('discord.js').Message} msg message to search for image attachment
 * @param {object} options options for the query
 * @returns {Promise<MessageAttachment>} attached image
 */
const getPicture = async (msg, options = { time: 300000 }) => {
  if (msg.attachments.size == 0) {
    const queryMsg = await msg.reply('Bitte sende das Bild, das gesucht werden soll, als Anhang in einer nächsten Nachricht.')
    logger.info('Queried user for the image');

    const filter = (message) => {
      return message.attachments.size == 1;
    };

    return msg.author.dmChannel.awaitMessages({ filter, time: options.time, max: 1 })
      .then(pictureMessage => {
        if (!pictureMessage.first()) {
          logger.info('No message received');
          queryMsg.reply('Keine Nachricht mit genau einem Bild im Anhang erhalten. Abbruch.')
          return Promise.reject('No message with exactly one attachment received')
        }
        logger.info('Reveiced image', pictureMessage.first().attachments.values().next().value)
        return pictureMessage.first().attachments.values().next().value;
      });
  }  
  logger.info('Image in original message', msg.attachments.values().next().value)
  return new Promise().resolve(msg.attachments.values().next().value);
}

/**
 * Asks for a confirmation of the provided data.
 * 
 * @param {import('discord.js').Message} msg message that should be confirmed
 * @param {string|import('discord.js').MessageOptions|MessagePayload} messageContent content of the confirmation message
 * @param {object} options options for the query
 * @returns {Promise<void>} whether message got confirmed
 */
const confirmationMessage = async (msg, messageContent, options = { time: 300000 }) => {
  const confirmationMessage = await msg.reply(messageContent);
  await confirmationMessage.react('👍');
  await confirmationMessage.react('👎');

  try {
    const filter = (reaction, user) => {
      return ['👍', '👎'].includes(reaction.emoji.name) && user.id === msg.author.id;
    };
    const collected = await confirmationMessage.awaitReactions({ filter, max: 1, time: options.time, errors: ['time'] });

    const reaction = collected.first();
    if (reaction.emoji.name === '👍') {
      return Promise.resolve();
    } else {
      return Promise.reject('Negative reaction');
    }
  } catch (e) {
    return Promise.reject('No reaction received')
  }
}

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
  const { msg, lon, lat } = argv;
  if (!currentQuiz)
    return msg.reply('Es läuft zur Zeit keine Runde. Du kannst eine neue Runde mit "start" starten.')
      .then(r => logger.info(msg, `Sent reply '${r.content}'.`));

  const { solution } = currentQuiz;
  const distanceFromSolution = utils.getDistance(solution, guess);

  logger.info({ guess, solution, distanceFromSolution }, 'New guess received.');

  if (distanceFromSolution <= solution.radius) {
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

    currentQuiz.startMessage = await currentQuiz.startMessage.edit({ embeds: [updatedStartEmbed] });
    logger.info('Updated start message with solver.');
  } else if (distanceFromSolution <= 2 * currentQuiz.solution.radius) {
    return msg.reply(`Deine Lösung ist leider nicht ganz richtig, du bist aber nah dran! Deine Lösung ist maximal ${2 * currentQuiz.solution.radius} Meter neben den angegebenen Koordinaten.`)
      .then(r => logger.info(`Sent reply '${r.content}'. Distance to target: ${distanceFromSolution}.`));
  } else {
    return msg.reply('Deine Lösung ist leider falsch. Probiere es aber gerne noch einmal.')
      .then(r => logger.info(`Sent reply '${r.content}'. Distance to target: ${distanceFromSolution}.`));
  }
};

module.exports = {
  newGameHandler,
  finishGameHandler,
  guessHandler,
};