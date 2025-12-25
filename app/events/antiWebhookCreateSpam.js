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

export async function handleWebhookCreateSpam(client) {
  client.on(Events.WebhookUpdate, async (channel) => {
    const auditLogs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    const userId = entry?.executorId || client.user.id;
    const member = await channel.guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;

    const guildId = channel.guild.id;
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
    settings.antiWebhookCreateSpam = settings.antiWebhookCreateSpam ?? { enabled: false, nukeLimit: 10, timeframe: 60000 };

    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === channel.id) ||
      settings.whitelist.categories.some((cat) => cat === channel.parentId) ||
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.webhook_create = settings.ruleWhitelist.webhook_create ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.webhook_create.channels.some((ch) => ch === channel.id) ||
      settings.ruleWhitelist.webhook_create.categories.some((cat) => cat === channel.parentId) ||
      member.roles.cache.some((role) => settings.ruleWhitelist.webhook_create.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.webhook_create.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiWebhookCreateSpam?.enabled) return;

    const rateLimit = settings.antiWebhookCreateSpam.nukeLimit || 10;
    const timeframe = settings.antiWebhookCreateSpam.timeframe || 60000;
    const points = settings.points.webhook_create || 1;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, targetId: channel.id }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, targetId: channel.id });
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

        const webhooks = await channel.fetchWebhooks().catch(() => null);
        if (webhooks) {
          for (const webhook of webhooks.values()) {
            await webhook.delete().catch(() => {});
          }
        }

        if (settings.block.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600000, 'Webhook作成制限超過');
            } else if (punishment === 'kick') {
              await member.kick('Webhook作成制限超過');
            } else if (punishment === 'ban') {
              await channel.guild.members.ban(member.id, { reason: 'Webhook作成制限超過' });
            }
          } catch (err) {
            console.error(`処罰適用エラー (${punishment}) to ${member.user.tag}:`, err);
          }
        }

        try {
          await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
        } catch (err) {
          return;
        }

          if (settings.logWebhook) {
            const embed = new EmbedBuilder()
              .setTitle('Webhook作成制限違反')
              .setDescription(
                `**ユーザー**: ${member.user.tag} (${member.id})\n` +
                `**ルール**: webhook_create\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**アクション数**: ${recentActions.length}/${rateLimit}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`Webhook作成制限違反 from ${channel.guild.name}`)
            .setDescription(
              `**サーバー**: ${channel.guild.name} (${channel.guild.id})\n` +
              `**ユーザー**: ${member.user.tag} (${member.id})\n` +
              `**ルール**: webhook_create\n` +
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