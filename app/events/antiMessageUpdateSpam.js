import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const actionHistory = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function antiMessageUpdateSpam(client) {
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.author || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!newMessage.guild) return;

    const member = await newMessage.guild.members.fetch(newMessage.author.id).catch(() => null);
    if (!member || bypassUserIds.has(member.id)) return;

    const guildId = newMessage.guild.id;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch (err) {
      return;
    }

    if (settings.notAdmin?.enabled && message.member?.permissions.has('Administrator')) return;

    settings.whitelist = {
      channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
      categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
      roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
      members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
    };
    settings.antiMessageUpdateSpam = settings.antiMessageUpdateSpam ?? { enabled: false, messageLimit: 15, timeframe: 10000 };

    const isWhitelisted =
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id) ||
      settings.whitelist.channels.some((c) => c === newMessage.channel.id) ||
      (newMessage.channel.parentId && settings.whitelist.categories.some((cat) => cat === newMessage.channel.parentId));

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.message_update = settings.ruleWhitelist.message_update ?? {
      channels: [], categories: [], roles: [], members: []
    };

    const isRuleWhitelisted =
      member.roles.cache.some((role) => settings.ruleWhitelist.message_update.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.message_update.members.some((m) => m === member.id) ||
      settings.ruleWhitelist.message_update.channels.some((c) => c === newMessage.channel.id) ||
      (newMessage.channel.parentId && settings.ruleWhitelist.message_update.categories.some((cat) => cat === newMessage.channel.parentId));

    if (isWhitelisted || isRuleWhitelisted || !settings.antiMessageUpdateSpam?.enabled) return;

    const rateLimit = settings.antiMessageUpdateSpam.messageLimit || 15;
    const timeframe = settings.antiMessageUpdateSpam.timeframe || 10000;
    const points = settings.points.message_update || 1;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, targetId: newMessage.id }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, targetId: newMessage.id });
      const recentActions = userActions.filter((a) => now - a.timestamp <= timeframe);
      actionHistory.set(member.id, recentActions);

      if (recentActions.length > rateLimit) {
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
        if (!pointsData[guildId][member.id]) pointsData[guildId][member.id] = { points: 0, lastViolation: null };
        pointsData[guildId][member.id].points += points;
        pointsData[guildId][member.id].lastViolation = now;
        const totalPoints = pointsData[guildId][member.id].points;
        const thresholds = settings.points.thresholds || { '10': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' };
        let punishment = null;
        for (const [point, action] of Object.entries(thresholds)) {
          if (totalPoints >= parseInt(point)) punishment = action;
        }

        if (settings.block?.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600000, 'メッセージ編集スパム検知');
            } else if (punishment === 'kick') {
              await member.kick('メッセージ編集スパム検知');
            } else if (punishment === 'ban') {
              await newMessage.guild.members.ban(member.id, { reason: 'メッセージ編集スパム検知' });
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
            console.error(`処罰適用エラー (${punishment}) to ${member.user.tag}:`, err);
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
              .setTitle('メッセージ編集スパム検知')
              .setDescription(
                `**ユーザー**: ${member.user.tag} (${member.id})\n` +
                `**チャンネル**: ${newMessage.channel}\n` +
                `**ルール**: message_update\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**アクション数**: ${recentActions.length}/${rateLimit}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`メッセージ編集スパム検知 from ${newMessage.guild.name}`)
            .setDescription(
              `**サーバー**: ${newMessage.guild.name} (${newMessage.guild.id})\n` +
              `**ユーザー**: ${member.user.tag} (${member.id})\n` +
              `**チャンネル**: ${newMessage.channel}\n` +
              `**ルール**: message_update\n` +
              `**ポイント**: ${totalPoints}\n` +
              `**処罰**: ${punishment || 'なし'}\n` +
              `**アクション数**: ${recentActions.length}/${rateLimit}`
            )
            .setTimestamp();
          try {
            await axios.post(webhookUrl, { embeds: [embed.toJSON()] });
          } catch (err) {
            console.error('開発者Webhook送信エラー:', err.message);
          }
        }
      }
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [userId, actions] of actionHistory) {
      const recentActions = actions.filter((a) => now - a.timestamp <= 10000);
      if (recentActions.length === 0) {
        actionHistory.delete(userId);
      } else {
        actionHistory.set(userId, recentActions);
      }
    }
  }, 10000);
}