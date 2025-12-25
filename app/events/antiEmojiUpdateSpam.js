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

export async function antiEmojiUpdateSpam(client) {
  client.on(Events.GuildEmojiUpdate, async (oldEmoji, newEmoji) => {
    const auditLogs = await newEmoji.guild.fetchAuditLogs({ type: AuditLogEvent.EmojiUpdate, limit: 1 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    const userId = entry?.executorId || client.user.id;
    const member = await newEmoji.guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;
    if (settings.notBot?.enabled && member.bot) return;
    if (settings.notAdmin?.enabled && member.permissions.has('Administrator')) return;

    const guildId = newEmoji.guild.id;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch (err) {
      return;
    }

    if (settings.notBot?.enabled && member.bot) return;

    settings.whitelist = {
      channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
      categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
      roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
      members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
    };
    settings.antiEmojiUpdateSpam = settings.antiEmojiUpdateSpam ?? { enabled: false, nukeLimit: 10, timeframe: 60000 };

    const isWhitelisted =
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.emoji_update = settings.ruleWhitelist.emoji_update ?? {
      channels: [], categories: [], roles: [], members: []
    };

    const isRuleWhitelisted =
      member.roles.cache.some((role) => settings.ruleWhitelist.emoji_update.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.emoji_update.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiEmojiUpdateSpam?.enabled) return;

    const rateLimit = settings.antiEmojiUpdateSpam.nukeLimit || 10;
    const timeframe = settings.antiEmojiUpdateSpam.timeframe || 60000;
    const points = settings.points.emoji_update || 1;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, targetId: newEmoji.id }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, targetId: newEmoji.id });
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
            if (punishment === 'timeout') await member.timeout(settings.block.timeout || 600000, '絵文字更新制限超過');
            else if (punishment === 'kick') await member.kick('絵文字更新制限超過');
            else if (punishment === 'ban') await newEmoji.guild.members.ban(member.id, { reason: '絵文字更新制限超過' });
          } catch (err) {
            console.error(`処罰適用エラー (${punishment}) to ${member.user.tag}:`, err);
          }
        }

        await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2)).catch(() => {});

          if (settings.logWebhook) {
            const embed = new EmbedBuilder()
              .setTitle('絵文字更新制限違反')
              .setDescription(`**ユーザー**: ${member.user.tag} (${member.id})\n**ルール**: emoji_update\n**ポイント**: ${totalPoints}\n**処罰**: ${punishment || 'なし'}\n**アクション数**: ${recentActions.length}/${rateLimit}`)
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`絵文字更新制限違反 from ${newEmoji.guild.name}`)
            .setDescription(`**サーバー**: ${newEmoji.guild.name} (${newEmoji.guild.id})\n**ユーザー**: ${member.user.tag} (${member.id})\n**ルール**: emoji_update\n**ポイント**: ${totalPoints}\n**処罰**: ${punishment || 'なし'}\n**アクション数**: ${recentActions.length}/${rateLimit}`)
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