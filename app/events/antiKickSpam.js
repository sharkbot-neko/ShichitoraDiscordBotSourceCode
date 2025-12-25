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

export async function handleKickSpam(client) {
  client.on(Events.GuildMemberRemove, async (member) => {
    const auditLogs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    if (!entry || entry.targetId !== member.id) return;
    const userId = entry.executorId || client.user.id;
    const executor = await member.guild.members.fetch(userId).catch(() => null);
    if (!executor) return;
    if (bypassUserIds.has(executor.id)) return;

    const guildId = member.guild.id;
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
    settings.antiKickSpam = settings.antiKickSpam ?? { enabled: false, nukeLimit: 10, timeframe: 60000 };

    const isWhitelisted =
      executor.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === executor.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.member_kick = settings.ruleWhitelist.member_kick ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      executor.roles.cache.some((role) => settings.ruleWhitelist.member_kick.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.member_kick.members.some((m) => m === executor.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiKickSpam?.enabled) return;

    const rateLimit = settings.antiKickSpam.nukeLimit || 10;
    const timeframe = settings.antiKickSpam.timeframe || 60000;
    const points = settings.points.member_kick || 1;
    const now = Date.now();

    if (!actionHistory.has(executor.id)) {
      actionHistory.set(executor.id, [{ timestamp: now, targetId: member.id }]);
    } else {
      const userActions = actionHistory.get(executor.id);
      userActions.push({ timestamp: now, targetId: member.id });
      const recentActions = userActions.filter((a) => now - a.timestamp <= timeframe);
      actionHistory.set(executor.id, recentActions);

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
        if (!pointsData[guildId][executor.id]) pointsData[guildId][executor.id] = { points: 0, lastViolation: null };
        pointsData[guildId][executor.id].points += points;
        pointsData[guildId][executor.id].lastViolation = now;
        const totalPoints = pointsData[guildId][executor.id].points;
        const thresholds = settings.points.thresholds || { '10': 'timeout', '20': 'kick', '30': 'ban' };
        let punishment = null;
        for (const [point, action] of Object.entries(thresholds)) {
          if (totalPoints >= parseInt(point)) punishment = action;
        }

        for (const action of recentActions) {
          const invite = await member.guild.invites.create(member.guild.channels.cache.find(c => c.isTextBased()), {
            maxUses: 1,
            reason: 'キック制限超過による再招待'
          }).catch(() => null);
          if (invite) {
            const targetUser = await client.users.fetch(action.targetId).catch(() => null);
            if (targetUser) {
              await targetUser.send(`あなたは ${member.guild.name} からキックされましたが、制限超過により再招待されました: ${invite.url}`).catch(() => {});
            }
          }
        }

        if (settings.block.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await executor.timeout(settings.block.timeout || 600000, 'キック制限超過');
            } else if (punishment === 'kick') {
              await executor.kick('キック制限超過');
            } else if (punishment === 'ban') {
              await member.guild.members.ban(executor.id, { reason: 'キック制限超過' });
            }
          } catch (err) {
            console.error(`処罰適用エラー (${punishment}) to ${executor.user.tag}:`, err);
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
              .setTitle('キック制限違反')
              .setDescription(
                `**ユーザー**: ${executor.user.tag} (${executor.id})\n` +
                `**ルール**: member_kick\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**アクション数**: ${recentActions.length}/${rateLimit}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`キック制限違反 from ${member.guild.name}`)
            .setDescription(
              `**サーバー**: ${member.guild.name} (${member.guild.id})\n` +
              `**ユーザー**: ${executor.user.tag} (${executor.id})\n` +
              `**ルール**: member_kick\n` +
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