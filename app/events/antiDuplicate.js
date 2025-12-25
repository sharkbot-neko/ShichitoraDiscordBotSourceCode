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

export async function handleAntiDuplicate(client) {
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

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.duplicate = settings.ruleWhitelist.duplicate ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };
    const isRuleWhitelisted =
      (settings.ruleWhitelist.duplicate.channels ?? []).some((ch) => ch === message.channelId) ||
      (settings.ruleWhitelist.duplicate.categories ?? []).some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => (settings.ruleWhitelist.duplicate.roles ?? []).some((r) => r === role.id)) ||
      (settings.ruleWhitelist.duplicate.members ?? []).some((m) => m === message.author.id);

    settings.whitelist = {
      channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
      categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
      roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
      members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
    };

    const channel = message.channel;
    const isWhitelisted =
      (settings.whitelist.channels ?? []).some((ch) => ch === message.channelId) ||
      (settings.whitelist.categories ?? []).some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => (settings.whitelist.roles ?? []).some((r) => r === role.id)) ||
      (settings.whitelist.members ?? []).some((m) => m === message.author.id);

    const userMessages = messageHistory.get(message.author.id) || [];
    const timeframe = settings.antiDuplicate.timeframe || 10000;
    const similarityThreshold = settings.antiDuplicate.similarity || 0.85;

    if (isWhitelisted || isRuleWhitelisted || !settings.antiDuplicate.enabled) return;

    for (const prev of userMessages) {
      if (
        message.content.length >= 5 &&
        prev.content &&
        prev.content.length >= 5 &&
        Date.now() - prev.time < timeframe &&
        similarity(message.content, prev.content) > similarityThreshold
      ) {
        await handleViolation(message, 'duplicate', settings);
        break;
      }
    }

    userMessages.push({ content: message.content, time: Date.now() });
    messageHistory.set(message.author.id, userMessages.filter((m) => Date.now() - m.time < timeframe));
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

function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1, s2) {
  const costs = new Array(s2.length + 1).fill(0);
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1[i - 1] !== s2[j - 1])
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
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
      } else if (punishment === 'delete_webhook' && message.webhookId) {
        const webhookId = message.webhookId;
        let webhook = null;

        try {
          const channelHooks = await message.channel.fetchWebhooks();
          webhook = channelHooks.find(w => w.id === webhookId);
        } catch { }

        if (!webhook) {
          try {
            const guildHooks = await message.guild.fetchWebhooks();
            webhook = guildHooks.find(w => w.id === webhookId);
          } catch { }
        }

        if (webhook) {
          await webhook.delete(`Anti-Troll: Webhook violated rule "${rule}" (${totalPoints}pts)`);
        }
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
        .setTitle('Anti-Duplicate Violation')
        .setDescription(
          `**User**: ${message.author.tag}\n**Rule**: ${rule}\n**Points**: ${totalPoints}\n**Punishment**: ${punishment || 'None'}`
        )
        .setTimestamp();
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
    }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`Anti-Duplicate Violation from ${message.guild.name}`)
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
  } else {
    console.error('Developer log webhook URL not configured.');
  }
  try {
    await message.delete();
  } catch (err) {
    console.error('Error deleting message:', err);
  }
}