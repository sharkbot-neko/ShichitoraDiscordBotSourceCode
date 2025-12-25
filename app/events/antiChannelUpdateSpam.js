import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
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

export async function handleChannelUpdateSpam(client) {
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    const auditLogs = await newChannel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    const userId = entry?.executorId || client.user.id;
    const member = await newChannel.guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;

    const guildId = newChannel.guild.id;
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
    settings.antiChannelUpdateSpam = settings.antiChannelUpdateSpam ?? { enabled: false, nukeLimit: 10, timeframe: 60000 };

    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === newChannel.id) ||
      settings.whitelist.categories.some((cat) => cat === newChannel.parentId) ||
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.channel_update = settings.ruleWhitelist.channel_update ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.channel_update.channels.some((ch) => ch === newChannel.id) ||
      settings.ruleWhitelist.channel_update.categories.some((cat) => cat === newChannel.parentId) ||
      member.roles.cache.some((role) => settings.ruleWhitelist.channel_update.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.channel_update.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiChannelUpdateSpam?.enabled) return;

    const rateLimit = settings.antiChannelUpdateSpam.nukeLimit || 10;
    const timeframe = settings.antiChannelUpdateSpam.timeframe || 60000;
    const points = settings.points.channel_update || 1;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, targetId: newChannel.id }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, targetId: newChannel.id });
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
        const thresholds = settings.points.thresholds || { '10': 'timeout', '20': 'kick', '30': 'ban' };
        let punishment = null;
        for (const [point, action] of Object.entries(thresholds)) {
          if (totalPoints >= parseInt(point)) punishment = action;
        }

        if (settings.block.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600000, 'チャンネル更新制限超過');
            } else if (punishment === 'kick') {
              await member.kick('チャンネル更新制限超過');
            } else if (punishment === 'ban') {
              await newChannel.guild.members.ban(member.id, { reason: 'チャンネル更新制限超過' });
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
              .setTitle('チャンネル更新制限違反')
              .setDescription(
                `**ユーザー**: ${member.user.tag} (${member.id})\n` +
                `**ルール**: channel_update\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**アクション数**: ${recentActions.length}/${rateLimit}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`チャンネル更新制限違反 from ${newChannel.guild.name}`)
            .setDescription(
              `**サーバー**: ${newChannel.guild.name} (${newChannel.guild.id})\n` +
              `**ユーザー**: ${member.user.tag} (${member.id})\n` +
              `**ルール**: channel_update\n` +
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
        } else {
          console.error('開発者ログWebhook URLが設定されていません。');
        }
      }
    }
  });

  setInterval(() => {
    for (const [userId, actions] of actionHistory) {
      const recentActions = actions.filter((a) => Date.now() - a.timestamp < 60000);
      if (recentActions.length === 0) {
        actionHistory.delete(userId);
      } else {
        actionHistory.set(userId, recentActions);
      }
    }
  }, 60000);
}