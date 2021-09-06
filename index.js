require('dotenv').config();

// npm modules
const { Client, Intents } = require('discord.js');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
// own modules
const parser = require('./src/parser');

const client = new Client({
  intents: [ Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES ],
  partials: ['MESSAGE', 'REACTION', 'CHANNEL'],
});

client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', msg => {
  // ####################### DEFAULT PARSING FOR A MESSAGE #######################

  // if message sender was a bot --> do nothing
  if (msg.author.bot) return;
  if (!msg.content.startsWith(process.env.PREFIX)) return;

  const isBotOwner = msg.author.id == process.env.BOT_OWNER;
  const commandBody = msg.content.slice(process.env.PREFIX.length);
  const args = commandBody.split(process.env.ARG_SEPERATOR);

  parser.parse(args, { msg, isBotOwner, client }, (err, argv, output) => {
    if (output) msg.reply('```' + output + '```');
  });
});

client.on('messageReactionAdd', async (reaction) => {
  // When we receive a reaction we check if the reaction is partial or not
  if (reaction.partial)
  // If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error('Something went wrong when fetching the message: ', error);
      return;
    }

  const msg = reaction.message;

  if (!msg.channel.name === 'geoguessr')
    return;

  if (!reaction.emoji.name === '🗺️')
    return;
});

client.login(process.env.BOT_TOKEN);