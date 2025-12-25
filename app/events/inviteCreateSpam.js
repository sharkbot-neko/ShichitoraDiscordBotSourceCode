import { Events, AuditLogEvent, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const inviteCreation = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleInviteCreateSpam(client) {
  client.on(Events.InviteCreate, async (invite) => {
    const member = await invite.guild.members.fetch(invite.inviterId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;

    const guildId = invite.guild.id;
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
    settings.antiInviteCreateSpam = settings.antiInviteCreateSpam ?? { enabled: false, inviteLimit: 2, timeframe: 5000 };

    const isWhitelisted =
    (settings.whitelist.members ?? []).some((m) => m === member.id) ||
    member.roles.cache.some((role) => (settings.whitelist.roles ?? []).some((r) => r === role.id));

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.invite_create_spam = settings.ruleWhitelist.invite_create_spam ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.invite_create_spam.members.some((m) => m === member.id) ||
      member.roles.cache.some((role) => settings.ruleWhitelist.invite_create_spam.roles.some((r) => r === role.id));

    if (isWhitelisted || isRuleWhitelisted || !settings.antiInviteCreateSpam?.enabled) return;

    const rateLimit = settings.antiInviteCreateSpam.inviteLimit || 2;
    const timeframe = settings.antiInviteCreateSpam.timeframe || 5000;
    const points = settings.points.invite_create_spam || 1;
    const now = Date.now();

    if (!inviteCreation.has(member.id)) {
      inviteCreation.set(member.id, [{ timestamp: now, inviteCode: invite.code }]);
    } else {
      const userInvites = inviteCreation.get(member.id);
      userInvites.push({ timestamp: now, inviteCode: invite.code });
      const recentInvites = userInvites.filter((i) => now - i.timestamp <= timeframe);
      inviteCreation.set(member.id, recentInvites);

      if (recentInvites.length > rateLimit) {
        const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
        let pointsData;
        try {
          pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
        } catch (err) {
          pointsData = {};
          try {
          await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
          } catch (writeErr) {
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

        for (const i of recentInvites) {
          try {
            await invite.guild.invites.delete(i.inviteCode);
          } catch (err) {
            console.error(`Error deleting invite ${i.inviteCode}:`, err);
          }
        }

        if (settings.block.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600000, 'Rate limit exceeded for invite creation');
            } else if (punishment === 'kick') {
              await member.kick('Rate limit exceeded for invite creation');
            } else if (punishment === 'ban') {
              await invite.guild.members.ban(member.id, { reason: 'Rate limit exceeded for invite creation' });
            }
          } catch (err) {
            console.error(`Error applying punishment (${punishment}) to ${member.user.tag}:`, err);
          }
        }

        try {
          await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
        } catch (err) {
          console.error(`Error writing ${pointsPath}:`, err);
          return;
        }

          if (settings.logWebhook) {
            const embed = new EmbedBuilder()
              .setTitle('招待リンク作成制限違反')
              .setDescription(
                `**ユーザー**: ${member.user.tag} (${member.id})\n` +
                `**ルール**: invite_create_spam\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**招待リンク数**: ${recentInvites.length}/${rateLimit}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`招待リンク作成制限違反 from ${invite.guild.name}`)
            .setDescription(
              `**サーバー**: ${invite.guild.name} (${invite.guild.id})\n` +
              `**ユーザー**: ${member.user.tag} (${member.id})\n` +
              `**ルール**: invite_create_spam\n` +
              `**ポイント**: ${totalPoints}\n` +
              `**処罰**: ${punishment || 'なし'}\n` +
              `**招待リンク数**: ${recentInvites.length}/${rateLimit}`
            )
            .setTimestamp();
          try {
            await axios.post(webhookUrl, {
              embeds: [embed.toJSON()]
            });
          } catch (err) {
            console.error('Error sending log to developer webhook:', err.message);
          }
        } else {
          console.error('Developer log webhook URL not configured.');
        }
      }
    }
  });

  setInterval(() => { 
    for (const [userId, invites] of inviteCreation) {
      const recentInvites = invites.filter((i) => Date.now() - i.timestamp < 10000);
      if (recentInvites.length === 0) {
        inviteCreation.delete(userId);
      } else {
        inviteCreation.set(userId, recentInvites);
      }
    }
  }, 60000);
}