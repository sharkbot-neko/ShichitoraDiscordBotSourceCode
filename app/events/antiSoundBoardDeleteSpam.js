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

export async function antiSoundboardDeleteSpam(client) {
  client.on(Events.GuildAuditLogEntryDelete, async (auditLog) => {
    if (auditLog.action !== AuditLogEvent.SoundboardSoundDelete) return;

    const executorId = auditLog.executorId;
    if (!executorId) return;

    const member = await auditLog.guild.members.fetch(executorId).catch(() => null);
    if (!member || bypassUserIds.has(member.id)) return;

    const guildId = auditLog.guild.id;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try {
      const data = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
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

    const isWhitelisted =
      member.roles.cache.some(role => settings.whitelist.roles.includes(role.id)) ||
      settings.whitelist.members.includes(member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.soundboard_delete = settings.ruleWhitelist.soundboard_delete ?? {
      channels: [], categories: [], roles: [], members: []
    };

    const isRuleWhitelisted =
      member.roles.cache.some(role => settings.ruleWhitelist.soundboard_delete.roles.includes(role.id)) ||
      settings.ruleWhitelist.soundboard_delete.members.includes(member.id);

    settings.antiSoundboardDeleteSpam = settings.antiSoundboardDeleteSpam ?? { enabled: false, nukeLimit: 5, timeframe: 60000 };
    if (!settings.antiSoundboardDeleteSpam.enabled || isWhitelisted || isRuleWhitelisted) return;

    const rateLimit = settings.antiSoundboardDeleteSpam.nukeLimit || 5;
    const timeframe = settings.antiSoundboardDeleteSpam.timeframe || 60000;
    const points = settings.points?.soundboard_delete || 4; 
    const now = Date.now();

    if (!actionHistory.has(member.id)) {
      actionHistory.set(member.id, [{ timestamp: now }]);
    } else {
      const userActions = actionHistory.get(member.id);
      userActions.push({ timestamp: now });

      const recentActions = userActions.filter(a => now - a.timestamp <= timeframe);
      actionHistory.set(member.id, recentActions);

      if (recentActions.length > rateLimit) {
        const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
        let pointsData = {};
        try {
          pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
        } catch { /* ファイル無しでも続行 */ }

        if (!pointsData[guildId]) pointsData[guildId] = {};
        if (!pointsData[guildId][member.id]) pointsData[guildId][member.id] = { points: 0, lastViolation: null };

        pointsData[guildId][member.id].points += points;
        pointsData[guildId][member.id].lastViolation = now;

        const totalPoints = pointsData[guildId][member.id].points;
        const thresholds = settings.points?.thresholds || { '10': 'timeout', '20': 'kick', '30': 'ban' };
        let punishment = null;
        for (const [thresh, act] of Object.entries(thresholds)) {
          if (totalPoints >= parseInt(thresh)) punishment = act;
        }

        if (settings.block?.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600_000, 'サウンドボード音声削除制限超過');
            } else if (punishment === 'kick') {
              await member.kick('サウンドボード音声削除制限超過');
            } else if (punishment === 'ban') {
              await auditLog.guild.members.ban(member.id, { reason: 'サウンドボード音声削除制限超過' });
            }
          } catch (err) {
            console.error(`処罰失敗 (${punishment}) → ${member.user.tag}:`, err);
          }
        }

        await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2)).catch(() => {});

          if (settings.logWebhook) {
            const embed = new EmbedBuilder()
              .setTitle('サウンドボード音声削除制限違反')
              .addFields(
                { name: 'ユーザー', value: `${member.user.tag} (${member.id})`, inline: true },
                { name: 'ルール', value: 'soundboard_delete', inline: true },
                { name: 'ポイント', value: totalPoints.toString(), inline: true },
                { name: '処罰', value: punishment || 'なし', inline: true },
                { name: '削除回数', value: `${recentActions.length}/${rateLimit}（${timeframe / 1000}秒内）`, inline: false }
              )
              .setColor('#FF0000')
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`サウンドボード削除スパム検知 - ${auditLog.guild.name}`)
            .addFields(
              { name: 'サーバー', value: `${auditLog.guild.name} (${auditLog.guild.id})` },
              { name: 'ユーザー', value: `${member.user.tag} (${member.id})` },
              { name: 'ルール', value: 'soundboard_delete' },
              { name: 'ポイント', value: totalPoints.toString() },
              { name: '処罰', value: punishment || 'なし' },
              { name: '削除回数', value: `${recentActions.length}/${rateLimit}` }
            )
            .setColor('#FF0000')
            .setTimestamp();

          await axios.post(webhookUrl, { embeds: [embed.toJSON()] }).catch(err =>
            console.error('開発者Webhook送信エラー:', err.message)
          );
        }
      }
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [userId, actions] of actionHistory.entries()) {
      const recent = actions.filter(a => now - a.timestamp <= 60000);
      if (recent.length === 0) actionHistory.delete(userId);
      else actionHistory.set(userId, recent);
    }
  }, 60000);
}