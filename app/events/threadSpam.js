import { Events, AuditLogEvent, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const threadCreation = new Map();

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

export async function handleThreadSpam(client) {
  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    const member = await thread.guild.members.fetch(thread.ownerId).catch(() => null);
    if (!member) return;
    if (bypassUserIds.has(member.id)) return;

    const guildId = thread.guild.id;
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
    settings.antiThreadSpam = settings.antiThreadSpam ?? { enabled: false, threadLimit: 2, timeframe: 5000 };

    const isWhitelisted =
      settings.whitelist.channels.some((ch) => ch === thread.parentId) ||
      settings.whitelist.categories.some((cat) => cat === thread.parentId) ||
      member.roles.cache.some((role) => settings.whitelist.roles.some((r) => r === role.id)) ||
      settings.whitelist.members.some((m) => m === member.id);

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.thread_limit = settings.ruleWhitelist.thread_limit ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };

    const isRuleWhitelisted =
      settings.ruleWhitelist.thread_limit.channels.some((ch) => ch === thread.parentId) ||
      settings.ruleWhitelist.thread_limit.categories.some((cat) => cat === thread.parentId) ||
      member.roles.cache.some((role) => settings.ruleWhitelist.thread_limit.roles.some((r) => r === role.id)) ||
      settings.ruleWhitelist.thread_limit.members.some((m) => m === member.id);

    if (isWhitelisted || isRuleWhitelisted || !settings.antiThreadSpam?.enabled) return;

    const rateLimit = settings.antiThreadSpam.threadLimit || 2;
    const timeframe = settings.antiThreadSpam.timeframe || 5000;
    const points = settings.points.thread_limit || 1;
    const now = Date.now();

    if (!threadCreation.has(member.id)) {
      threadCreation.set(member.id, [{ timestamp: now, threadId: thread.id }]);
    } else {
      const userThreads = threadCreation.get(member.id);
      userThreads.push({ timestamp: now, threadId: thread.id });
      const recentThreads = userThreads.filter((t) => now - t.timestamp <= timeframe);
      threadCreation.set(member.id, recentThreads);

      if (recentThreads.length > rateLimit) {
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

        for (const t of recentThreads) {
          const threadToDelete = await thread.guild.channels.fetch(t.threadId).catch(() => null);
          if (threadToDelete) await threadToDelete.delete();
        }

        if (settings.block.enabled && punishment) {
          try {
            if (punishment === 'timeout') {
              await member.timeout(settings.block.timeout || 600000, 'Rate limit exceeded for thread creation');
            } else if (punishment === 'kick') {
              await member.kick('Rate limit exceeded for thread creation');
            } else if (punishment === 'ban') {
              await thread.guild.members.ban(member.id, { reason: 'Rate limit exceeded for thread creation' });
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
              .setTitle('スレッド作成制限違反')
              .setDescription(
                `**ユーザー**: ${member.user.tag} (${member.id})\n` +
                `**ルール**: thread_limit\n` +
                `**ポイント**: ${totalPoints}\n` +
                `**処罰**: ${punishment || 'なし'}\n` +
                `**スレッド数**: ${recentThreads.length}/${rateLimit}`
              )
              .setTimestamp();
            await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
          }

        if (webhookUrl) {
          const embed = new EmbedBuilder()
            .setTitle(`スレッド作成制限違反 from ${thread.guild.name}`)
            .setDescription(
              `**サーバー**: ${thread.guild.name} (${thread.guild.id})\n` +
              `**チャンネル**: ${thread.parent?.name || '不明'} (${thread.parentId || '不明'})\n` +
              `**ユーザー**: ${member.user.tag} (${member.id})\n` +
              `**ルール**: thread_limit\n` +
              `**ポイント**: ${totalPoints}\n` +
              `**処罰**: ${punishment || 'なし'}\n` +
              `**スレッド数**: ${recentThreads.length}/${rateLimit}`
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
    for (const [userId, threads] of threadCreation) {
      const recentThreads = threads.filter((t) => Date.now() - t.timestamp < 10000);
      if (recentThreads.length === 0) {
        threadCreation.delete(userId);
      } else {
        threadCreation.set(userId, recentThreads);
      }
    }
  }, 60000);
}