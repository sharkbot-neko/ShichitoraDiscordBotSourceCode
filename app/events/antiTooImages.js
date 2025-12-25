import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const messageHistory = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleTooImages(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.system || message.author.id === message.guild?.ownerId || bypassUserIds.has(message.author.id)) return;

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
    settings.antiTooImages = settings.antiTooImages ?? { enabled: false, imageLimit: 3, timeframe: 5000 };

    const channel = message.channel;
    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === message.channelId) ||
      settings.whitelist.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === message.author.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.too_many_images = settings.ruleWhitelist.too_many_images ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.too_many_images.channels.some((ch) => ch === message.channelId) ||
      settings.ruleWhitelist.too_many_images.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => settings.ruleWhitelist.too_many_images.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.too_many_images.members.some((m) => m === message.author.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiTooImages?.enabled) return;

    let totalImages = 0;

    totalImages += message.attachments.filter(att => att.contentType?.startsWith('image/')).size;

    for (const embed of message.embeds) {
      if (embed.image?.url) totalImages++;
      if (embed.thumbnail?.url) totalImages++;
    }

    if (message.messageSnapshots?.size) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        totalImages += refMsg.attachments.filter(att => att.contentType?.startsWith('image/')).size;
        for (const embed of refMsg.embeds) {
          if (embed.image?.url) totalImages++;
          if (embed.thumbnail?.url) totalImages++;
        }
      } catch (_) { }
    }

    if (totalImages >= (settings.antiTooImages.imageLimit || 3)) {
      await handleViolation(message, 'too_many_images', settings, totalImages);
    }
  });
}

async function handleViolation(message, rule, settings, totalImages) {
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
      console.error('ポイントファイル書き込みエラー:', writeErr);
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
        await message.member.timeout(settings.block.timeout || 600000, `違反: ${rule}`);
      } else if (punishment === 'kick') {
        await message.member.kick(`違反: ${rule}`);
      } else if (punishment === 'ban') {
        await message.guild.members.ban(message.author.id, { reason: `違反: ${rule}` });
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
      console.error(`処罰適用エラー (${punishment}):`, err);
    }
  }

  try {
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
  } catch (err) {
    console.error(`ポイントファイル書き込みエラー ${pointsPath}:`, err);
    return;
  }

    if (settings.logWebhook) {
      const embed = new EmbedBuilder()
        .setTitle('画像数超過違反')
        .setDescription(
          `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
          `**ルール**: ${rule}\n` +
          `**ポイント**: ${totalPoints}\n` +
          `**処罰**: ${punishment || 'なし'}\n` +
          `**画像数**: ${totalImages}`
        )
        .setTimestamp();
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
    }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`画像数超過違反 from ${message.guild.name}`)
      .setDescription(
        `**サーバー**: ${message.guild.name} (${guildId})\n` +
        `**チャンネル**: ${message.channel.name} (${message.channelId})\n` +
        `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
        `**ルール**: ${rule}\n` +
        `**ポイント**: ${totalPoints}\n` +
        `**処罰**: ${punishment || 'なし'}\n` +
        `**画像数**: ${totalImages}\n` +
        `**メッセージ**: ${message.content.slice(0, 1000)}`
      )
      .setTimestamp();
    try {
      await axios.post(webhookUrl, { embeds: [embed.toJSON()] });
    } catch (err) {
      console.error('開発者Webhook送信エラー:', err.message);
    }
  } else {
    console.error('開発者ログWebhook URLが設定されていません。');
  }

  try {
    await message.delete();
  } catch (err) {
    console.error('メッセージ削除エラー:', err);
  }
}