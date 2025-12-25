import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const messageHistory = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187",
  "850493201064132659",
  "302050872383242240",
  "761562078095867916",
  "1233072112139501608",
  "903541413298450462",
  "935855687400054814"
]);

export async function handleAntiSpam(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (bypassUserIds.has(message.author.id)) return;
    if (message.system || message.author.id === message.guild.ownerId) return;

    const guildId = message.guildId;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch (err) {
      return;
    }

    if (settings.notBot?.enabled && message.author.bot) return;
    if (settings.notAdmin?.enabled && message.member?.permissions.has('Administrator')) return;

    settings.whitelist = {
    channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
    categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
    roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
    members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
    };
    settings.antiSpam = settings.antiSpam ?? { enabled: false, timeframe: 5000, messageLimit: 5 };

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.duplicate = settings.ruleWhitelist.spam ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const channel = message.channel;
    const isWhitelisted =
      settings.whitelist?.channels.some((ch) => ch === message.channelId) ||
      settings.whitelist?.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => settings.whitelist?.roles.some((r) => r === role.id)) ||
      settings.whitelist?.members.some((m) => m === message.author.id);

    const isRuleWhitelisted =
      settings.ruleWhitelist.duplicate.channels.some((ch) => ch === message.channelId) ||
      settings.ruleWhitelist.duplicate.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => settings.ruleWhitelist.duplicate.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.duplicate.members.some((m) => m === message.author.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiSpam?.enabled) return;

    const userMessages = messageHistory.get(message.author.id) || [];
    userMessages.push({ content: message.content, time: Date.now() });
    const timeframe = settings.antiSpam.timeframe || 5000;
    const messageLimit = settings.antiSpam.messageLimit || 5;
    const recentMessages = userMessages.filter((m) => Date.now() - m.time < timeframe);
    messageHistory.set(message.author.id, recentMessages);

    if (recentMessages.length >= messageLimit) {
      await handleViolation(message, 'spam', settings);
      messageHistory.set(message.author.id, []);
    }
  });

  setInterval(() => {
    for (const [userId, messages] of messageHistory) {
      const recentMessages = messages.filter((m) => Date.now() - m.time < 10000);
      if (recentMessages.length === 0) {
        messageHistory.delete(userId);
      } else {
        messageHistory.set(userId, recentMessages);
      }
    }
  }, 60000);
}

async function handleViolation(message, rule, settings) {
  const points = settings.points[rule] || 1;
  const guildId = message.guildId;
  const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
  let pointsData;
  try {
    pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
  } catch (err) {
    pointsData = {};
    try {
      await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
    } catch (writeErr) {
      return;
    }
  }
  if (!pointsData[guildId]) pointsData[guildId] = {};
  if (!pointsData[guildId][message.author.id]) pointsData[guildId][message.author.id] = { points: 0, lastViolation: null };
  pointsData[guildId][message.author.id].points += points;
  pointsData[guildId][message.author.id].lastViolation = Date.now();
  const totalPoints = pointsData[guildId][message.author.id].points;
  const thresholds = settings.points.thresholds || { '10': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' };
  let punishment = null;
  for (const [point, action] of Object.entries(thresholds)) {
    if (totalPoints >= parseInt(point)) punishment = action;
  }
  if (settings.block.enabled && punishment) {
    try {
      if (punishment === 'timeout') {
        await message.member.timeout(settings.block.timeout || 600000, `Violation: ${rule}`);
      } else if (punishment === 'kick') {
        await message.member.kick(`Violation: ${rule}`);
      } else if (punishment === 'ban') {
        await message.guild.members.ban(message.author.id, { reason: `Violation: ${rule}` });
      }
    } catch (err) {
      console.error(`Error applying punishment (${punishment}):`, err);
    }
  }
  try {
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
  } catch (err) {
    console.error(`Error writing ${pointsPath}:`, err);
    return;
  }

    if (settings.logWebhook) {
      const embed = new EmbedBuilder()
        .setTitle('Anti-Spam Violation')
        .setDescription(
          `**User**: ${message.author.tag}\n**Rule**: ${rule}\n**Points**: ${totalPoints}\n**Punishment**: ${punishment || 'None'}`
        )
        .setTimestamp();
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
    }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`Anti-Spam Violation from ${message.guild.name}`)
      .setDescription(
        `**Server**: ${message.guild.name} (${guildId})\n` +
        `**Channel**: ${message.channel.name} (${message.channelId})\n` +
        `**User**: ${message.author.tag} (${message.author.id})\n` +
        `**Rule**: ${rule}\n` +
        `**Points**: ${totalPoints}\n` +
        `**Punishment**: ${punishment || 'None'}\n` +
        `**Message**: ${message.content}`
      )
      .setTimestamp();
    try {
      await axios.post(webhookUrl, {
        embeds: [embed.toJSON()]
      });
    } catch (err) {
      console.error('Error sending log to developer webhook:', err.message);
    }
  } else {}
  try {
    await message.delete();
  } catch (err) {
    console.error('Error deleting message:', err);
  }
}