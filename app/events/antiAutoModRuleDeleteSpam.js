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

export async function antiAutoModRuleDeleteSpam(client) {
  client.on(Events.AutoModerationRuleDelete, async (rule) => {
    const auditLogs = await rule.guild.fetchAuditLogs({ type: AuditLogEvent.AutoModerationRuleDelete, limit: 1 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    const userId = entry?.executorId || client.user.id;
    const member = await rule.guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;

    const guildId = rule.guild.id;
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
    settings.antiAutoModRuleDeleteSpam = settings.antiAutoModRuleDeleteSpam ?? { enabled: false, nukeLimit: 3, timeframe: 60000 };

    const isWhitelisted =
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.automod_delete = settings.ruleWhitelist.automod_delete ?? {
      channels: [], categories: [], roles: [], members: []
    };

    const isRuleWhitelisted =
      member.roles.cache.some((role) => settings.ruleWhitelist.automod_delete.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.automod_delete.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiAutoModRuleDeleteSpam?.enabled) return;

    const rateLimit = settings.antiAutoModRuleDeleteSpam.nukeLimit || 3;
    const timeframe = settings.antiAutoModRuleDeleteSpam.timeframe || 60000;
    const points = settings.points.automod_delete || 8;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, targetId: rule.id }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, targetId: rule.id });
      const recentActions = userActions.filter((a) => now - a.timestamp <= timeframe);
      actionHistory.set(member.id, recentActions);

      if (recentActions.length > rateLimit) {
        const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
        let pointsData;
        try {
          pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
        } catch (err) {
          pointsData = {};
          await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2)).catch(() => {});
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

        if (settings.block?.enabled && punishment) {
          try {
            if (punishment === 'timeout') await member.timeout(settings.block.timeout || 600000, 'AutoModルール削除制限超過');
            else if (punishment === 'kick') await member.kick('AutoModルール削除制限超過');
            else if (punishment === 'ban') await rule.guild.members.ban(member.id, { reason: 'AutoModルール削除制限超過' });
          } catch {}
        }

        await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2)).catch(() => {});

        if (settings.logWebhook) {
          const embed = new EmbedBuilder()
            .setTitle('AutoModルール削除制限違反')
            .setDescription(`**ユーザー**: ${member.user.tag} (${member.id})\n**ルール**: automod_delete\n**ポイント**: ${totalPoints}\n**処罰**: ${punishment || 'なし'}\n**アクション数**: ${recentActions.length}/${rateLimit}`)
            .setTimestamp();
          await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
        }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`AutoModルール削除制限違反 from ${rule.guild.name}`)
            .setDescription(`**サーバー**: ${rule.guild.name} (${rule.guild.id})\n**ユーザー**: ${member.user.tag} (${member.id})\n**ルール**: automod_delete\n**ポイント**: ${totalPoints}\n**処罰**: ${punishment || 'なし'}\n**アクション数**: ${recentActions.length}/${rateLimit}`)
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
    for (const [userId, actions] of actionHistory) {
      const recentActions = actions.filter((a) => Date.now() - a.timestamp < 60000);
      if (recentActions.length === 0) actionHistory.delete(userId);
      else actionHistory.set(userId, recentActions);
    }
  }, 60000);
}