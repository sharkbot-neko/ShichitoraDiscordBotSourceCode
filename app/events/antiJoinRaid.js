import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

const joinHistory = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleJoinRaid(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;

    const guild = member.guild;
    const now = Date.now();
    const guildId = guild.id;

    try {
      const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
      let settings;
      try {
        settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
      } catch (err) {
        return;
      }

      settings.antiJoinRaid = settings.antiJoinRaid ?? {
        enabled: false,
        joinLimit: 10,
        timeframe: 10000
      };

      if (!settings.antiJoinRaid.enabled) return;

      const joinLimit = settings.antiJoinRaid.joinLimit || 10;
      const timeframe = settings.antiJoinRaid.timeframe || 10000;
      const timeoutDuration = 86400000;

      settings.whitelist = settings.whitelist ?? { roles: [], members: [] };
      settings.whitelist.roles = Array.isArray(settings.whitelist.roles) ? settings.whitelist.roles : [];
      settings.whitelist.members = Array.isArray(settings.whitelist.members) ? settings.whitelist.members : [];

      settings.ruleWhitelist = settings.ruleWhitelist ?? {};
      settings.ruleWhitelist.member_join = settings.ruleWhitelist.member_join ?? { roles: [], members: [] };
      settings.ruleWhitelist.member_join.roles = Array.isArray(settings.ruleWhitelist.member_join.roles) ? settings.ruleWhitelist.member_join.roles : [];
      settings.ruleWhitelist.member_join.members = Array.isArray(settings.ruleWhitelist.member_join.members) ? settings.ruleWhitelist.member_join.members : [];

      if (!joinHistory.has(guildId)) joinHistory.set(guildId, []);
      const joins = joinHistory.get(guildId);
      joins.push({ timestamp: now, userId: member.id });

      const recentJoins = joins.filter(j => now - j.timestamp <= timeframe);
      joinHistory.set(guildId, recentJoins);

      if (recentJoins.length > joinLimit) {
        const punishedUsers = [];

        for (const join of recentJoins) {
          const target = await guild.members.fetch(join.userId).catch(() => null);
          if (!target || target.user.bot) continue;

          const isWhitelisted =
            target.roles.cache.some(r => settings.whitelist.roles.includes(r.id)) ||
            settings.whitelist.members.includes(target.id);

          const isRuleWhitelisted =
            target.roles.cache.some(r => settings.ruleWhitelist.member_join.roles.includes(r.id)) ||
            settings.ruleWhitelist.member_join.members.includes(target.id);

          if (isWhitelisted || isRuleWhitelisted) continue;

          await target.timeout(timeoutDuration, '加入レイド検知: 短時間大量加入')
            .then(() => punishedUsers.push(`<@${target.id}> (${target.user.tag})`))
            .catch(() => {});
        }

        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('加入レイド検知')
          .setDescription(
            `**サーバー**: ${guild.name} (${guild.id})\n` +
            `**検知人数**: ${recentJoins.length}人 / 制限 ${joinLimit}人\n` +
            `**時間枠**: ${timeframe / 1000}秒\n` +
            `**処罰**: 該当ユーザー全員を **1日（24時間）タイムアウト**\n` +
            `**対象ユーザー**:\n${punishedUsers.length > 0 ? punishedUsers.join('\n') : '（全員ホワイトリストまたは取得失敗）'}`
          )
          .setTimestamp();

          if (settings.logWebhook) {
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          try {
            await axios.post(webhookUrl, {
              embeds: [embed.setTitle(`加入レイド検知 from ${guild.name}`).toJSON()]
            });
          } catch (err) {
            console.error('開発者Webhook送信エラー:', err.message);
          }
        }
      }
    } catch (err) {
      console.error('antiJoinRaid エラー:', err);
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [guildId, joins] of joinHistory.entries()) {
      const recent = joins.filter(j => now - j.timestamp < 60000);
      if (recent.length === 0) {
        joinHistory.delete(guildId);
      } else {
        joinHistory.set(guildId, recent);
      }
    }
  }, 60000);
}