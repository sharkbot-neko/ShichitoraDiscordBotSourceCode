import fs from "fs";
import path from "path";
import { join } from 'path';
import { readdirSync } from 'fs';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import express from "express";
import fetch from "node-fetch";
import { Client, Collection, Events, GatewayIntentBits, ChannelType, ActivityType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, IntentsBitField, AuditLogEvent, PermissionsBitField, PermissionFlagsBits, ContextMenuCommandBuilder, ApplicationCommandType, Routes, Partials, WebhookClient, SimpleShardingStrategy, ShardingManager } from "discord.js";
import 'dotenv/config';
import { fileURLToPath } from 'url';
import axios from 'axios';
import process from 'process';
import CommandsRegister from "./regist-commands.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Client
const client = new Client({
  intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildScheduledEvents, GatewayIntentBits.AutoModerationConfiguration, GatewayIntentBits.AutoModerationExecution, GatewayIntentBits.GuildInvites ],
  partials: [ Partials.Message, Partials.Channel, Partials.Reaction ],
   ws: {
      buildStrategy: (manager) =>
         new (class MobileSimpleShardingStrategy extends SimpleShardingStrategy {
            constructor(manager) {
               manager.options.identifyProperties = {
                  os: 'ios',
                  device: 'device',
                  browser: 'Discord iOS'
               };
               super(manager);
            }
         })(manager)
   }
});

// Login
client.login(process.env.TOKEN);

// Error
process.on('uncaughtException', (error) => {
  console.error(error);
  return;
});

// ShardMaxListeners
client.once('ready', async () => {
  client.ws.shards.forEach(shard => {
    shard.setMaxListeners(50);
  });
});

// ModLog
import { handleModLog } from './events/modLog.js';
handleModLog(client);

// BumpUpNotify
import { handleBumpUpNotify } from './events/bumpUpNotify.js';
handleBumpUpNotify(client);

// MuteRole
import { handleMuteRole } from './events/muteRole.js';
handleMuteRole(client);

// CustomDelete
import { handleCustomDelete } from './events/customDelete.js';
handleCustomDelete(client);

// AntiTrollFiles
import { handleAntiSpam } from './events/antiSpam.js';
handleAntiSpam(client);
import { handleAntiRaid } from './events/antiRaid.js';
handleAntiRaid(client);
import { handleJoinRaid } from './events/antiJoinRaid.js';
handleJoinRaid(client);
import { handleAntiDuplicate } from './events/antiDuplicate.js';
handleAntiDuplicate(client);
import { handleReactionSpam } from './events/reactionSpam.js';
handleReactionSpam(client);
import { handleThreadSpam } from './events/threadSpam.js';
handleThreadSpam(client);
import { handleInviteCreateSpam } from './events/inviteCreateSpam.js';
handleInviteCreateSpam(client);
import { handleEventCreateSpam } from './events/eventCreateSpam.js';
handleEventCreateSpam(client);
import { handleEventUpdateSpam } from './events/eventUpdateSpam.js';
handleEventUpdateSpam(client);
import { handleEventDeleteSpam } from './events/eventDeleteSpam.js';
handleEventDeleteSpam(client);
import { handleChannelCreateSpam } from './events/antiChannelCreateSpam.js';
handleChannelCreateSpam(client);
import { handleChannelUpdateSpam } from './events/antiChannelUpdateSpam.js';
handleChannelUpdateSpam(client);
import { handleChannelDeleteSpam } from './events/antiChannelDeleteSpam.js';
handleChannelDeleteSpam(client);
import { handleRoleCreateSpam } from './events/antiRoleCreateSpam.js';
handleRoleCreateSpam(client);
import { handleRoleUpdateSpam } from './events/antiRoleUpdateSpam.js';
handleRoleUpdateSpam(client);
import { handleRoleDeleteSpam } from './events/antiRoleDeleteSpam.js';
handleRoleDeleteSpam(client);
import { handleWebhookCreateSpam } from './events/antiWebhookCreateSpam.js';
handleWebhookCreateSpam(client);
import { handleWebhookUpdateSpam } from './events/antiWebhookUpdateSpam.js';
handleWebhookUpdateSpam(client);
import { handleWebhookDeleteSpam } from './events/antiWebhookDeleteSpam.js';
handleWebhookDeleteSpam(client);
import { handleBanAddSpam } from './events/antiBanAddSpam.js';
handleBanAddSpam(client);
import { handleKickSpam } from './events/antiKickSpam.js';
handleKickSpam(client);
import { handleTimeoutSpam } from './events/antiTimeoutSpam.js';
handleTimeoutSpam(client);
import { antiAutoModRuleDeleteSpam } from './events/antiAutoModRuleDeleteSpam.js';
antiAutoModRuleDeleteSpam(client);
import { antiAutoModRuleUpdateSpam } from './events/antiAutoModRuleUpdateSpam.js';
antiAutoModRuleUpdateSpam(client);
import { antiEmojiCreateSpam } from './events/antiEmojiCreateSpam.js';
antiEmojiCreateSpam(client);
import { antiEmojiDeleteSpam } from './events/antiEmojiDeleteSpam.js';
antiEmojiDeleteSpam(client);
import { antiEmojiUpdateSpam } from './events/antiEmojiUpdateSpam.js';
antiEmojiUpdateSpam(client);
import { antiStickerCreateSpam } from './events/antiStickerCreateSpam.js';
antiStickerCreateSpam(client);
import { antiStickerDeleteSpam } from './events/antiStickerDeleteSpam.js';
antiStickerDeleteSpam(client);
import { antiStickerUpdateSpam } from './events/antiStickerUpdateSpam.js';
antiStickerUpdateSpam(client);
import { antiSoundboardCreateSpam } from './events/antiSoundBoardCreateSpam.js';
antiSoundboardCreateSpam(client);
import { antiSoundboardUpdateSpam } from './events/antiSoundBoardUpdateSpam.js';
antiSoundboardUpdateSpam(client);
import { antiSoundboardDeleteSpam } from './events/antiSoundBoardDeleteSpam.js';
antiSoundboardDeleteSpam(client);
import { handleVoiceChatJoinRaid } from './events/antiVoiceChatJoinRaid.js';
handleVoiceChatJoinRaid(client);
import { handleMentionSpam } from './events/antiMentionSpam.js';
handleMentionSpam(client);
import { handleTooManyLine } from './events/antiTooManyLine.js';
handleTooManyLine(client);
import { handleCharacterRepeats } from './events/antiCharacterRepeats.js';
handleCharacterRepeats(client);
import { handleTooImages } from './events/antiTooImages.js';
handleTooImages(client);
import { handleTooEmoji } from './events/antiTooEmoji.js';
handleTooEmoji(client);
import { handleTooLink } from './events/antiTooLink.js';
handleTooLink(client);
import { handleTooEmbed } from './events/antiTooEmbed.js';
handleTooEmbed(client);
import { handleSoundboardSpam } from './events/antiSoundboardSpam.js';
handleSoundboardSpam(client);
import { antiMessageUpdateSpam } from './events/antiMessageUpdateSpam.js';
antiMessageUpdateSpam(client);
import { handleAntiTrollGIF } from './events/antiTrollGIF.js';
handleAntiTrollGIF(client);
import { handleMarkdownSpam } from './events/antiMarkdownSpam.js';
handleMarkdownSpam(client);
import { handleSpecificCharSpam } from './events/antiSpecificCharSpam.js';
handleSpecificCharSpam(client);
import { execute, executeUpdate } from './events/messageHandler.js';
client.on('messageCreate', execute);
client.on('messageUpdate', executeUpdate);

// Interactions
import { handleInteractions } from './events/interactions.js';
handleInteractions(client);

// VerifySystem
const eventsPath = join(process.cwd(), './verify');
for (const file of readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = await import(`./verify/${file}`);
  client.on(event.name, (...args) => event.execute(...args, client));
}

// Commands
const handlers = new Map();
const handlersPath = path.join(process.cwd(), "handlers");
const handlerFiles = fs
  .readdirSync(handlersPath)
  .filter((file) => file.endsWith(".mjs"));
for (const file of handlerFiles) {
  const filePath = path.join(handlersPath, file);
  import(filePath).then((module) => {
    handlers.set(file.slice(0, -4), module);
  });
}
CommandsRegister();
client.commands = new Collection();
const categoryFoldersPath = path.join(process.cwd(), "commands");
const commandFolders = fs.readdirSync(categoryFoldersPath);
for (const folder of commandFolders) {
  const commandsPath = path.join(categoryFoldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    import(filePath).then((module) => {
      client.commands.set(module.data.name, module);
    });
  }
}
client.on("interactionCreate", async (interaction) => {
  await handlers.get("interactionCreate").default(interaction);
});

// botBAN
client.on('guildCreate', async guild => {
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  const botban = config.botban || { users: {}, servers: {} };
  if (botban.servers[guild.id] || botban.users[guild.ownerId]) {
    await guild.leave();
  }
});

// ActivitySetting
client.on("ready", async () => {
  const activities = [
    { name: "/help | ヘルプ", type: ActivityType.Watching },
    { name: "高度な荒らし対策/管理機能", type: ActivityType.Listening },
    { name: "通貨機能・ミニゲーム", type: ActivityType.Playing },
    { name: `Shard ID : ${client.shard.ids}`, type: ActivityType.Streaming },
    { name: "サポート｜.gg/CNuAEaJPx5", type: ActivityType.Competing },
  ];
  let activityIndex = 0;
  await client.user.setActivity(activities[activityIndex]);
  setInterval(() => {
    activityIndex = (activityIndex + 1) % activities.length;
    client.user.setActivity(activities[activityIndex]);
  }, 7500);
});