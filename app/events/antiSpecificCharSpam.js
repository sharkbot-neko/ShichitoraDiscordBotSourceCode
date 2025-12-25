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

export async function handleSpecificCharSpam(client) {
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

    const channel = message.channel;
    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === message.channelId) ||
      settings.whitelist.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === message.author.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.specific_char_spam = settings.ruleWhitelist.specific_char_spam ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.specific_char_spam.channels.some((ch) => ch === message.channelId) ||
      settings.ruleWhitelist.specific_char_spam.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => settings.ruleWhitelist.specific_char_spam.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.specific_char_spam.members.some((m) => m === message.author.id);

    if (isWhitelisted || isRuleWhitelisted) return;

    settings.antiSpecificCharSpam = settings.antiSpecificCharSpam ?? { enabled: false, targets: [] };
    if (!settings.antiSpecificCharSpam.enabled) return;

    const content = message.content;
    const targets = settings.antiSpecificCharSpam.targets || [];

    if (!Array.isArray(targets) || targets.length === 0) return;

    for (const target of targets) {
      const char = target.char?.toString() || '';
      const limit = parseInt(target.limit) || 5;

      if (char.length === 0) continue;

      const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedChar, 'g');
      const matches = content.match(regex);
      const count = matches ? matches.length : 0;

      if (count >= limit) {
        await handleViolation(message, 'specific_char_spam', settings, { char, count, limit });
        return;
      }
    }
  });
}

async function handleViolation(message, rule, settings, details) {
  const points = settings.points?.[rule] || 1;
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
      .setTitle('特定文字スパム違反')
      .setDescription(
        `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
        `**ルール**: ${rule}\n` +
        `**ポイント**: ${totalPoints}\n` +
        `**処罰**: ${punishment || 'なし'}\n` +
        `**対象文字**: "${details.char}" (${details.count}/${details.limit})\n` +
        `**メッセージ**: ${message.content.slice(0, 1000)}`
      )
      .setTimestamp();
    await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
  }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`特定文字スパム違反 from ${message.guild.name}`)
      .setDescription(
        `**サーバー**: ${message.guild.name} (${guildId})\n` +
        `**チャンネル**: ${message.channel.name} (${message.channelId})\n` +
        `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
        `**ルール**: ${rule}\n` +
        `**ポイント**: ${totalPoints}\n` +
        `**処罰**: ${punishment || 'なし'}\n` +
        `**対象文字**: "${details.char}" (${details.count}/${details.limit})\n` +
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