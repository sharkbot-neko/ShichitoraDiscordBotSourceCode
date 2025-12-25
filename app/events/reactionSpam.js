import { Events, PermissionsBitField, EmbedBuilder, AuditLogEvent } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const reactionHistory = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleReactionSpam(client) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (bypassUserIds.has(user.id)) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('リアクションの取得に失敗:', error);
        return;
      }
    }
    const guildId = reaction.message.guildId;
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch (err) {
      return;
    }

    if (settings.notBot?.enabled && member.bot) return;
    if (settings.notAdmin?.enabled && member.permissions.has('Administrator')) return;

    settings.whitelist = {
      channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
      categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
      roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
      members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
    };
    settings.antiReactionSpam = settings.antiReactionSpam ?? { enabled: false, reactionLimit: 5, timeframe: 5000 };

    const channel = reaction.message.channel;
    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === reaction.message.channelId) ||
      settings.whitelist.categories.some((cat) => cat === channel.parentId) ||
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === user.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.reaction_spam = settings.ruleWhitelist.reaction_spam ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.reaction_spam.channels.some((ch) => ch === reaction.message.channelId) ||
      settings.ruleWhitelist.reaction_spam.categories.some((cat) => cat === channel.parentId) ||
      member.roles.cache.some((role) => settings.ruleWhitelist.reaction_spam.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.reaction_spam.members.some((m) => m === user.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiReactionSpam?.enabled) return;

    const reactionLimit = settings.antiReactionSpam.reactionLimit || 5;
    const timeframe = settings.antiReactionSpam.timeframe || 5000;
    const userReactions = reactionHistory.get(user.id) || [];
    userReactions.push({ time: Date.now() });
    const recentReactions = userReactions.filter((r) => Date.now() - r.time < timeframe);
    reactionHistory.set(user.id, recentReactions);

    if (recentReactions.length >= reactionLimit) {
      await handleViolation(reaction, user, 'reaction_spam', settings);
      reactionHistory.set(user.id, []);
    }
  });

  setInterval(() => {
    for (const [userId, reactions] of reactionHistory) {
      const recentReactions = reactions.filter((r) => Date.now() - r.time < 10000);
      if (recentReactions.length === 0) {
        reactionHistory.delete(userId);
      } else {
        reactionHistory.set(userId, recentReactions);
      }
    }
  }, 60000);
}

async function handleViolation(reaction, user, rule, settings) {
  const guildId = reaction.message.guildId;
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  const points = settings.points[rule] || 1;
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
  if (!pointsData[guildId][user.id]) pointsData[guildId][user.id] = { points: 0, lastViolation: null };
  pointsData[guildId][user.id].points += points;
  pointsData[guildId][user.id].lastViolation = Date.now();
  try {
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
  } catch (err) {
    console.error(`Error writing ${pointsPath}:`, err);
    return;
  }
  const totalPoints = pointsData[guildId][user.id].points;
  const thresholds = settings.points.thresholds || { '10': 'timeout', '20': 'kick', '30': 'ban' };
  let punishment = null;
  for (const [point, action] of Object.entries(thresholds)) {
    if (totalPoints >= parseInt(point)) punishment = action;
  }
  if (settings.block.enabled && punishment) {
    try {
      if (punishment === 'timeout') {
        await member.timeout(settings.block.timeout || 600000, `Violation: ${rule}`);
      } else if (punishment === 'kick') {
        await member.kick(`Violation: ${rule}`);
      } else if (punishment === 'ban') {
        await guild.members.ban(user.id, { reason: `Violation: ${rule}` });
      }
    } catch (err) {
      console.error(`Error applying punishment (${punishment}):`, err);
    }
  }
    if (settings.logWebhook) {
      const embed = new EmbedBuilder()
        .setTitle('Anti-Reaction-Spam Violation')
        .setDescription(
          `**User**: ${user.tag}\n**Rule**: ${rule}\n**Points**: ${totalPoints}\n**Punishment**: ${punishment || 'None'}\n**Message**: ${reaction.message.url}`
        )
        .setTimestamp();
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
    }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`Anti-Reaction-Spam Violation from ${guild.name}`)
      .setDescription(
        `**Server**: ${guild.name} (${guildId})\n` +
        `**Channel**: ${reaction.message.channel.name} (${reaction.message.channelId})\n` +
        `**User**: ${user.tag} (${user.id})\n` +
        `**Rule**: ${rule}\n` +
        `**Points**: ${totalPoints}\n` +
        `**Punishment**: ${punishment || 'None'}\n` +
        `**Message**: ${reaction.message.url}`
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
}