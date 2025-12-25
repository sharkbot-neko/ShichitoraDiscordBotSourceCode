import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

const mentionHistory = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleMentionSpam(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.system || message.author.id === message.guild?.ownerId || bypassUserIds.has(message.author.id)) return;

    const guildId = message.guildId;
    if (!guildId) return;

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

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.mention_spam = settings.ruleWhitelist.mention_spam ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const channel = message.channel;
    const isWhitelisted =
      settings.whitelist.channels.includes(message.channelId) ||
      (channel.parentId && settings.whitelist.categories.includes(channel.parentId)) ||
      message.member?.roles.cache.some(role => settings.whitelist.roles.includes(role.id)) ||
      settings.whitelist.members.includes(message.author.id);

    const isRuleWhitelisted =
      settings.ruleWhitelist.mention_spam.channels.includes(message.channelId) ||
      (channel.parentId && settings.ruleWhitelist.mention_spam.categories.includes(channel.parentId)) ||
      message.member?.roles.cache.some(role => settings.ruleWhitelist.mention_spam.roles.includes(role.id)) ||
      settings.ruleWhitelist.mention_spam.members.includes(message.author.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiMentionSpam?.enabled) return;

    const config = {
      mentionLimit: settings.antiMentionSpam.mentionLimit || 5,
      timeframe: settings.antiMentionSpam.timeframe || 5000
    };

    let mentionCount = 0;

    mentionCount += message.mentions.users.size;
    mentionCount += message.mentions.roles.size;

    if (message.mentions.everyone) mentionCount += 1;
    if (message.content.includes('@everyone')) mentionCount += 1;
    if (message.content.includes('@here')) mentionCount += 1;

    const directMentionMatches = message.content.match(/<@!?(\d+)>/g);
    if (directMentionMatches) {
      const directIds = directMentionMatches.map(m => m.replace(/<@!?|>/g, ''));
      const normalIds = [...message.mentions.users.keys()];
      const newMentions = directIds.filter(id => !normalIds.includes(id));
      mentionCount += newMentions.length;
    }

    if (mentionCount === 0) return;

    const key = `${guildId}-${message.author.id}`;
    const now = Date.now();

    if (!mentionHistory.has(key)) {
      mentionHistory.set(key, []);
    }

    const history = mentionHistory.get(key);
    history.push({ timestamp: now, count: mentionCount });

    const cutoff = now - config.timeframe;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }

    const totalInTimeframe = history.reduce((sum, entry) => sum + entry.count, 0);

    if (totalInTimeframe >= config.mentionLimit) {
      await handleViolation(message, 'mention_spam', settings, totalInTimeframe, config.timeframe);
      mentionHistory.set(key, []);
    }
  });

  setInterval(() => {
    const now = Date.now();
    const cleanupThreshold = now - 1800000;

    for (const [key, history] of mentionHistory.entries()) {
      if (history.length === 0) {
        mentionHistory.delete(key);
        continue;
      }

      const latest = history[history.length - 1].timestamp;
      if (latest < cleanupThreshold) {
        mentionHistory.delete(key);
      } else {
        const cutoff = now - 60000;
        while (history.length > 0 && history[0].timestamp < cutoff) {
          history.shift();
        }
        if (history.length === 0) {
          mentionHistory.delete(key);
        }
      }
    }
  }, 300000);
}

async function handleViolation(message, rule, settings, totalMentions, timeframe) {
  const points = settings.points?.[rule] || 1;
  const guildId = message.guildId;
  const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
  let pointsData = {};

  try {
    const data = await fs.readFile(pointsPath, 'utf8');
    pointsData = JSON.parse(data);
  } catch (err) {}

  if (!pointsData[guildId]) pointsData[guildId] = {};
  if (!pointsData[guildId][message.author.id]) {
    pointsData[guildId][message.author.id] = { points: 0, lastViolation: null };
  }

  pointsData[guildId][message.author.id].points += points;
  pointsData[guildId][message.author.id].lastViolation = Date.now();

  const totalPoints = pointsData[guildId][message.author.id].points;

  const thresholds = settings.points?.thresholds || { '10': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' };
  let punishment = null;
  for (const [point, action] of Object.entries(thresholds)) {
    if (totalPoints >= parseInt(point)) punishment = action;
  }

  if (settings.block?.enabled && punishment) {
    try {
      if (punishment === 'timeout') {
        await message.member.timeout(settings.block.timeout || 600000, `違反: ${rule}`);
      } else if (punishment === 'kick') {
        await message.member.kick(`違反: ${rule}`);
      } else if (punishment === 'ban') {
        await message.guild.members.ban(message.author.id, { reason: `違反: ${rule}` });
      } else if (punishment === 'delete_webhook' && message.webhookId) {
        let webhook = null;
        try {
          const channelHooks = await message.channel.fetchWebhooks();
          webhook = channelHooks.find(w => w.id === message.webhookId);
        } catch {}
        if (!webhook) {
          try {
            const guildHooks = await message.guild.fetchWebhooks();
            webhook = guildHooks.find(w => w.id === message.webhookId);
          } catch {}
        }
        if (webhook) {
          await webhook.delete(`Anti-Troll: Webhook violated rule "${rule}" (${totalPoints}pts)`);
        }
      }
    } catch (err) {
      console.error(`処罰適用エラー (${punishment}):`, err);
    }
  }

  try {
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
  } catch (err) {
    console.error(`ポイントファイル書き込みエラー:`, err);
  }

  const embedLog = new EmbedBuilder()
    .setTitle('メンションスパム違反')
    .setDescription(
      `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
      `**ルール**: ${rule}\n` +
      `**ポイント**: ${totalPoints}\n` +
      `**処罰**: ${punishment || 'なし'}\n` +
      `**${timeframe / 1000}秒以内のメンション数**: ${totalMentions}`
    )
    .setTimestamp();

  if (settings.logWebhook) {
    await axios.post(settings.logWebhook, { embeds: [embedLog.toJSON()] }).catch(() => {});
  }

  if (webhookUrl) {
    const embedDev = new EmbedBuilder()
      .setTitle(`メンションスパム違反 from ${message.guild.name}`)
      .setDescription(
        `**サーバー**: ${message.guild.name} (${guildId})\n` +
        `**チャンネル**: ${message.channel.name} (${message.channelId})\n` +
        `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
        `**ルール**: ${rule}\n` +
        `**ポイント**: ${totalPoints}\n` +
        `**処罰**: ${punishment || 'なし'}\n` +
        `**${timeframe / 1000}秒以内のメンション数**: ${totalMentions}\n` +
        `**最新メッセージ**: ${message.content.slice(0, 1000)}`
      )
      .setTimestamp();

    await axios.post(webhookUrl, { embeds: [embedDev.toJSON()] }).catch(console.error);
  }

  await message.delete().catch(() => {});
}