import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

const channelJoinBurst = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleVoiceChatJoinRaid(client) {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (!newState.channelId || oldState.channelId) return;

    const member = newState.member;
    if (!member || bypassUserIds.has(member.id)) return;

    const guild = newState.guild;
    const channel = newState.channel;
    const guildId = guild.id;
    const channelId = channel.id;

    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch {
      return;
    }

    if (settings.notBot?.enabled && member.bot) return;
    if (settings.notAdmin?.enabled && member.permissions.has('Administrator')) return;

    if (!settings.antiVoiceChatJoinRaid?.enabled) return;

    settings.whitelist = settings.whitelist || { channels: [], categories: [], roles: [], members: [] };
    const inGlobalWhitelist =
      settings.whitelist.channels.includes(channelId) ||
      settings.whitelist.categories.includes(channel.parentId) ||
      member.roles.cache.some(r => settings.whitelist.roles.includes(r.id)) ||
      settings.whitelist.members.includes(member.id);

    settings.ruleWhitelist = settings.ruleWhitelist || {};
    settings.ruleWhitelist.vc_raid = settings.ruleWhitelist.vc_raid || {
      channels: [], categories: [], roles: [], members: []
    };

    const inRuleWhitelist =
      settings.ruleWhitelist.vc_raid.channels.includes(channelId) ||
      settings.ruleWhitelist.vc_raid.categories.includes(channel.parentId) ||
      member.roles.cache.some(r => settings.ruleWhitelist.vc_raid.roles.includes(r.id)) ||
      settings.ruleWhitelist.vc_raid.members.includes(member.id);

    if (inGlobalWhitelist || inRuleWhitelist) return;

    const limit = settings.antiVoiceChatJoinRaid.memberLimit || 12;
    const timeframe = settings.antiVoiceChatJoinRaid.timeframe || 12000;
    const pointsPerTrigger = settings.points.vc_raid || 6;
    const now = Date.now();

    if (!channelJoinBurst.has(channelId)) {
      channelJoinBurst.set(channelId, []);
    }

    const history = channelJoinBurst.get(channelId);
    history.push({ userId: member.id, timestamp: now });

    const recentJoins = history.filter(h => now - h.timestamp <= timeframe);
    channelJoinBurst.set(channelId, recentJoins);

    if (recentJoins.length >= limit) {
      const uniqueUsers = [...new Set(recentJoins.map(h => h.userId))];
      
      if (uniqueUsers.length < Math.floor(limit * 0.7)) return;

      const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
      let pointsData = {};
      try {
        pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
      } catch {}

      if (!pointsData[guildId]) pointsData[guildId] = {};

      const punishedMembers = [];

      for (const userId of uniqueUsers) {
        const targetMember = await guild.members.fetch(userId).catch(() => null);
        if (!targetMember || bypassUserIds.has(userId)) continue;

        if (!pointsData[guildId][userId]) {
          pointsData[guildId][userId] = { points: 0, lastViolation: null };
        }

        pointsData[guildId][userId].points += pointsPerTrigger;
        pointsData[guildId][userId].lastViolation = now;

        const totalPoints = pointsData[guildId][userId].points;

        const thresholds = settings.points.thresholds || { '10': 'timeout', '20': 'kick', '30': 'ban' };
        let punishment = null;
        for (const [pt, action] of Object.entries(thresholds)) {
          if (totalPoints >= parseInt(pt)) punishment = action;
        }

        if (settings.block?.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await targetMember.timeout(settings.block.timeout || 600000, 'ボイスチャンネルレイド参加');
            } else if (punishment === 'kick') {
              await targetMember.kick('ボイスチャンネルレイド参加');
            } else if (punishment === 'ban') {
              await guild.members.ban(userId, { reason: 'ボイスチャンネルレイド参加' });
            }
          } catch (err) {
            console.error(`処罰失敗 (${punishment}) → ${targetMember.user.tag}:`, err);
          }
        }

        punishedMembers.push(`<@${userId}> (${totalPoints}pt → ${punishment || 'なし'})`);
      }

      try {
        await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
      } catch (err) {
        console.error('ポイント保存エラー:', err);
      }

        if (settings.logWebhook) {
          await axios.post(settings.logWebhook, {
            embeds: [new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('ボイスチャンネルレイド検知')
              .setDescription(
                `**チャンネル**: ${channel.name}\n` +
                `**参加人数**: ${recentJoins.length}人 (${uniqueUsers.length}人ユニーク)\n` +
                `**制限**: ${limit}人/${timeframe/1000}秒\n` +
                `**処罰対象**:\n${punishedMembers.join('\n') || 'なし'}`
              )
              .setTimestamp()
              .toJSON()
            ]
          }).catch(() => {});
        }

      if (webhookUrl) {
        axios.post(webhookUrl, {
          embeds: [new EmbedBuilder()
            .setTitle(`VCレイド発動 - ${guild.name}`)
            .setDescription(
              `サーバー: ${guild.name} (${guild.id})\n` +
              `チャンネル: ${channel.name} (${channelId})\n` +
              `爆撃人数: ${recentJoins.length}人 (${uniqueUsers.length}人ユニーク)\n` +
              `制限: ${limit}人/${timeframe/1000}秒\n` +
              `処罰: ${punishedMembers.length}人`
            )
            .setColor('#FF0000')
            .setTimestamp()
            .toJSON()]
        }).catch(() => {});
      }

      channelJoinBurst.set(channelId, []);
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [channelId, entries] of channelJoinBurst) {
      const fresh = entries.filter(e => now - e.timestamp < 300000);
      if (fresh.length === 0) {
        channelJoinBurst.delete(channelId);
      } else {
        channelJoinBurst.set(channelId, fresh);
      }
    }
  }, 60000);
}