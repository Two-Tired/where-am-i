const { MessageAttachment, MessageEmbed, Message } = require('discord.js');
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

    const correctionMessage = await msg.reply({
      content: 'Dies ist das Ergebnis `' + place_name + '` das du angegeben hast. Ist dies korrekt? Dann reagiere mit 👍 auf diese Nachricht.',
      files: [new MessageAttachment(imageBuffer, 'solution.png')],
    });

    await correctionMessage.react('👍');
    await correctionMessage.react('👎');

    try {
      const filter = (reaction, user) => {
        return ['👍', '👎'].includes(reaction.emoji.name) && user.id === msg.author.id;
      };
      const collected = await correctionMessage.awaitReactions({ filter, max: 1, time: 300000, errors: ['time'] });

      const reaction = collected.first();
      if (reaction.emoji.name === '👍') {
        await msg.reply('Die Runde wird jetzt gestartet!');
      } else {
        await msg.reply('Abbruch, bitte sende mir einen korrigierten Start-Befehl.');
        throw new Error('Abbruch, bitte sende mir einen korrigierten Start-Befehl.');
      }
    } catch (e) {
      logger.info(e.toString());
    }

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
    logger.error(error);
    currentQuiz = undefined;
  }
};

/**
 * Gets the attached image from the given message or queries for the image in a new message.
 *
 * @param {Message} msg message to search for image attachment
 * @param {object} options options for the query
 * @returns {MessageAttachment} attached image
 */
// const getPicture = async (msg, options = { time: 300000 }) => {
//   if (msg.attachments.size == 0) {
//     await msg.reply('Bitte sende das Bild, das gesucht werden soll, als Anhang in einer nächsten Nachricht.');
//     const filter = (message) => {
//       return message.attachments.size == 1;
//     };
//     const pictureMessage = await msg.author.dmChannel.awaitMessages({ filter, time: options.time, max: 1 });
//     return pictureMessage.first().attachments.values().next().value;
//   }
//   return msg.attachments.values().next().value;
// };

/**
 * Gets the attached image from the given message or queries for the image in a new message.
 *
 * @param {Message} msg message to search for image attachment
 * @param {object} options options for the query
 * @returns {Promise<MessageAttachment>} attached image
 */
const getPicture = async (msg, options = { time: 300000 }) => {
  return new Promise((resolve, reject) => {
    if (msg.attachments.size == 0)
      msg.reply('Bitte sende das Bild, das gesucht werden soll, als Anhang in einer nächsten Nachricht.')
        .then(() => {
          const filter = (message) => {
            return message.attachments.size == 1;
          };
          msg.author.dmChannel.awaitMessages({ filter, time: options.time, max: 1 })
            .then(pictureMessage => {
              if (pictureMessage.first().attachments.values().next().value)
                resolve(pictureMessage.first().attachments.values().next().value);
              else
                reject('no attachment found');
            })
            .catch(reject);
        })
        .catch(reject);
    else
      resolve(msg.attachments.values().next().value);
  });
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