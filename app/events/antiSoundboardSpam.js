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

export async function handleSoundboardSpam(client) {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (!newState.guild || !newState.soundboardSoundId || oldState.soundboardSoundId) return;

    const member = newState.member;
    if (!member || bypassUserIds.has(member.id)) return;

    const guildId = newState.guild.id;
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

    settings.antiSoundboardSpam = settings.antiSoundboardSpam ?? { enabled: false, soundLimit: 5, timeframe: 10000 };

    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === newState.channelId) ||
      settings.whitelist.categories.some((cat) => cat === newState.channel?.parentId) ||
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.soundboard_spam = settings.ruleWhitelist.soundboard_spam ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.soundboard_spam.channels.some((ch) => ch === newState.channelId) ||
      settings.ruleWhitelist.soundboard_spam.categories.some((cat) => cat === newState.channel?.parentId) ||
      member.roles.cache.some((role) => settings.ruleWhitelist.soundboard_spam.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.soundboard_spam.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiSoundboardSpam?.enabled) return;

    const rateLimit = settings.antiSoundboardSpam.soundLimit || 5;
    const timeframe = settings.antiSoundboardSpam.timeframe || 10000;
    const points = settings.points.soundboard_spam || 2;
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now, soundId: newState.soundboardSoundId }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now, soundId: newState.soundboardSoundId });
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
              await member.timeout(settings.block.timeout || 600000, 'サウンドボード連打制限超過');
            } else if (punishment === 'kick') {
              await member.kick('サウンドボード連打制限超過');
            } else if (punishment === 'ban') {
              await newState.guild.members.ban(member.id, { reason: 'サウンドボード連打制限超過' });
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
              .setTitle('サウンドボード連打制限違反')
              .setDescription(
                `**ユーザー**: ${member.user.tag} (${member.id})\n` +
                `**ルール**: soundboard_spam\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**アクション数**: ${recentActions.length}/${rateLimit}\n` +
                `**チャンネル**: ${newState.channel?.name || '不明'}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`サウンドボード連打違反 from ${newState.guild.name}`)
            .setDescription(
              `**サーバー**: ${newState.guild.name} (${newState.guild.id})\n` +
              `**ユーザー**: ${member.user.tag} (${member.id})\n` +
              `**ルール**: soundboard_spam\n` +
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
    const now = Date.now();
    for (const [userId, actions] of actionHistory) {
      const recentActions = actions.filter((a) => now - a.timestamp < 60000);
      if (recentActions.length === 0) {
        actionHistory.delete(userId);
      } else {
        actionHistory.set(userId, recentActions);
      }
    }
  }, 60000);
}