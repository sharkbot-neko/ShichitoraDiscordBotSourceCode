import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleTooEmoji(client) {
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
    settings.antiTooEmoji = settings.antiTooEmoji ?? { enabled: false, emojiLimit: 5 };

    const channel = message.channel;

    const isWhitelisted =
      settings.whitelist.channels.some(ch => ch === message.channelId) ||
      settings.whitelist.categories.some(cat => cat === channel.parentId) ||
      message.member?.roles.cache.some(role => settings.whitelist.roles.some(r => r === role.id)) ||
      settings.whitelist.members.some(m => m === message.author.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.too_emoji = settings.ruleWhitelist.too_emoji ?? { channels: [], categories: [], roles: [], members: [] };

    const isRuleWhitelisted =
      settings.ruleWhitelist.too_emoji.channels.some(ch => ch === message.channelId) ||
      settings.ruleWhitelist.too_emoji.categories.some(cat => cat === channel.parentId) ||
      message.member?.roles.cache.some(role => settings.ruleWhitelist.too_emoji.roles.some(r => r === role.id)) ||
      settings.ruleWhitelist.too_emoji.members.some(m => m === message.author.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiTooEmoji?.enabled) return;

    let totalEmojis = 0;

    totalEmojis += (message.content.match(/<a?:\w+:\d+>/g) || []).length;
    totalEmojis += (message.content.match(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;

    if (message.messageSnapshots?.size) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        totalEmojis += (refMsg.content.match(/<a?:\w+:\d+>/g) || []).length;
        totalEmojis += (refMsg.content.match(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
      } catch (_) { }
    }

    for (const embed of message.embeds) {
      const text = [
        embed.title, embed.description, embed.footer?.text,
        ...(embed.fields?.map(f => f.name + ' ' + f.value) || [])
      ].filter(Boolean).join(' ');
      totalEmojis += (text.match(/<a?:\w+:\d+>/g) || []).length;
      totalEmojis += (text.match(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
    }

    if (totalEmojis >= (settings.antiTooEmoji.emojiLimit || 5)) {
      await handleViolation(message, 'too_emoji', settings, totalEmojis);
    }
  });
}

async function handleViolation(message, rule, settings, totalEmojis) {
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
        .setTitle('絵文字数超過違反')
        .setDescription(
          `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
          `**ルール**: ${rule}\n` +
          `**ポイント**: ${totalPoints}\n` +
          `**処罰**: ${punishment || 'なし'}\n` +
          `**絵文字数**: ${totalEmojis}`
        )
        .setTimestamp();
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
    }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`絵文字数超過違反 from ${message.guild.name}`)
      .setDescription(
        `**サーバー**: ${message.guild.name} (${guildId})\n` +
        `**チャンネル**: ${message.channel.name} (${message.channelId})\n` +
        `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
        `**ルール**: ${rule}\n` +
        `**ポイント**: ${totalPoints}\n` +
        `**処罰**: ${punishment || 'なし'}\n` +
        `**絵文字数**: ${totalEmojis}\n` +
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