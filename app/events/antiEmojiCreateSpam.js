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

export async function antiEmojiCreateSpam(client) {
  client.on(Events.GuildEmojiCreate, async (emoji) => {
    const auditLogs = await emoji.guild.fetchAuditLogs({ type: AuditLogEvent.EmojiCreate, limit: 1 }).catch(() => null);
    const entry = auditLogs?.entries.first();
    const userId = entry?.executorId || client.user.id;
    const member = await emoji.guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;

    const guildId = emoji.guild.id;
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
    settings.antiEmojiCreateSpam = settings.antiEmojiCreateSpam ?? { enabled: false, nukeLimit: 8, timeframe: 60000 };

    const isWhitelisted =
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.emoji_create = settings.ruleWhitelist.emoji_create ?? {
      channels: [], categories: [], roles: [], members: []
    };

    const isRuleWhitelisted =
      member.roles.cache.some((role) => settings.ruleWhitelist.emoji_create.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.emoji_create.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiEmojiCreateSpam?.enabled) return;

    const rateLimit = settings.antiEmojiCreateSpam.nukeLimit || 8;
    const timeframe = settings.antiEmojiCreateSpam.timeframe || 60000;
    const points = settings.points.emoji_create || 2;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, targetId: emoji.id }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, targetId: emoji.id });
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

        for (const action of recentActions) {
          const emojiToDelete = await emoji.guild.emojis.fetch(action.targetId).catch(() => null);
          if (emojiToDelete) await emojiToDelete.delete('絵文字作成スパム検知').catch(() => {});
        }

        if (settings.block?.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600000, '絵文字作成制限超過');
            } else if (punishment === 'kick') {
              await member.kick('絵文字作成制限超過');
            } else if (punishment === 'ban') {
              await emoji.guild.members.ban(member.id, { reason: '絵文字作成制限超過' });
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
              .setTitle('絵文字作成制限違反')
              .setDescription(`**ユーザー**: ${member.user.tag} (${member.id})\n**ルール**: emoji_create\n**ポイント**: ${totalPoints}\n**処罰**: ${punishment || 'なし'}\n**アクション数**: ${recentActions.length}/${rateLimit}`)
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`絵文字作成制限違反 from ${emoji.guild.name}`)
            .setDescription(`**サーバー**: ${emoji.guild.name} (${emoji.guild.id})\n**ユーザー**: ${member.user.tag} (${member.id})\n**ルール**: emoji_create\n**ポイント**: ${totalPoints}\n**処罰**: ${punishment || 'なし'}\n**アクション数**: ${recentActions.length}/${rateLimit}`)
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
      if (recentActions.length === 0) {
        actionHistory.delete(userId);
      } else {
        actionHistory.set(userId, recentActions);
      }
    }
  }, 60000);
}