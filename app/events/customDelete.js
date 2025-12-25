import { Events, AuditLogEvent } from 'discord.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187"
]);

async function logToWebhookCustom(message, subcommand, details) {
  const embed = {
    title: `Custom Delete Action in ${message?.guild?.name || 'Unknown Guild'}`,
    description: `**Server**: ${message?.guild?.name || 'N/A'} (${message?.guildId || 'N/A'})\n` +
                 `**User**: ${message?.author?.tag || 'N/A'} (${message?.author?.id || 'N/A'})\n` +
                 `**Subcommand**: ${subcommand}\n` +
                 `**Details**: ${details}`,
    timestamp: new Date().toISOString(),
  };
  try {
    await axios.post(webhookUrl, { embeds: [embed] });
  } catch (err) {
    console.error('Error sending custom-delete log to webhook:', err.message);
  }
}

export function handleCustomDelete(client) {
  client.on(Events.MessageCreate, async message => {
    if (bypassUserIds.has(message.author.id)) return;
    if (message.system || message.author.id === message.guild.ownerId) return;
    const guildId = message.guild.id;
    const customDeletePath = path.join(process.cwd(), 'custom-delete', `${guildId}.json`);
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);

    let customSettings, settings;

    try {
      const data = await readFile(customDeletePath, 'utf8');
      customSettings = JSON.parse(data);
    } catch (err) {
      return;
    }

    try {
      const data = await readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        settings = {
          whitelist: { channels: [], categories: [], roles: [], members: [] },
          block: { enabled: true, timeout: 600000 },
          points: { thresholds: { '10': 'timeout', '20': 'kick', '30': 'ban' }, userPoints: {} },
        };
        try {
          await mkdir(path.dirname(settingsPath), { recursive: true });
          await writeFile(settingsPath, JSON.stringify(settings, null, 2));
          console.log(`Created default settings for guild ${guildId}`);
        } catch (writeErr) {
          console.error(`Failed to create settings file for guild ${guildId}:`, writeErr);
          return;
        }
      } else {
        console.error(`Failed to read settings for guild ${guildId}:`, err);
        return;
      }
    }

    if (settings.notBot?.enabled && message.author.bot) return;
    if (settings.notAdmin?.enabled && message.member?.permissions.has('Administrator')) return;

    const whitelist = settings.whitelist || {};
    const members = Array.isArray(whitelist.members) ? whitelist.members : [];
    const roles = Array.isArray(whitelist.roles) ? whitelist.roles : [];
    const channels = Array.isArray(whitelist.channels) ? whitelist.channels : [];
    const categories = Array.isArray(whitelist.categories) ? whitelist.categories : [];

    let isWhitelisted = false;
    for (let i = 0; i < members.length; i++) {
      if (members[i] === message.author.id) {
        isWhitelisted = true;
        break;
      }
    }
    if (!isWhitelisted && message.member) {
      for (let i = 0; i < roles.length; i++) {
        if (message.member.roles.cache.has(roles[i])) {
          isWhitelisted = true;
          break;
        }
      }
    }
    if (!isWhitelisted) {
      for (let i = 0; i < channels.length; i++) {
        if (channels[i] === message.channel.id) {
          isWhitelisted = true;
          break;
        }
      }
    }
    if (!isWhitelisted && message.channel.parentId) {
      for (let i = 0; i < categories.length; i++) {
        if (categories[i] === message.channel.parentId) {
          isWhitelisted = true;
          break;
        }
      }
    }
    if (isWhitelisted) return;

    settings.ruleWhitelist = settings.ruleWhitelist ?? {};
    settings.ruleWhitelist.custom = settings.ruleWhitelist.custom ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };
    const isRuleWhitelisted =
      (settings.ruleWhitelist.custom.channels ?? []).some((ch) => ch === message.channelId) ||
      (settings.ruleWhitelist.custom.categories ?? []).some((cat) => cat === message.channel.parentId) ||
      (message.member && message.member.roles.cache.some((role) => (settings.ruleWhitelist.custom.roles ?? []).some((r) => r === role.id))) ||
      (settings.ruleWhitelist.custom.members ?? []).some((m) => m === message.author.id);
    if (isRuleWhitelisted) return;

    for (const [ruleName, rule] of Object.entries(customSettings.rules || {})) {
      try {
        const regex = new RegExp(rule.regex);
        if (regex.test(message.content)) {
          await message.delete();

          if (rule.addPoint && rule.addPoint > 0) {
            settings.points = settings.points || { userPoints: {}, thresholds: { '10': 'timeout', '20': 'kick', '30': 'ban' } };
            settings.points.userPoints = settings.points.userPoints || {};
            settings.points.userPoints[message.author.id] = (settings.points.userPoints[message.author.id] || 0) + rule.addPoint;

            const userPoints = settings.points.userPoints[message.author.id];
            const thresholds = settings.points.thresholds || {};
            for (const [threshold, action] of Object.entries(thresholds)) {
              if (userPoints >= parseInt(threshold)) {
                try {
                  if (action === 'timeout' && message.member) {
                    await message.member.timeout(settings.block?.timeout || 600000, `Reached ${threshold} points for custom rule ${ruleName}`);
                  } else if (action === 'kick' && message.member) {
                    await message.member.kick(`Reached ${threshold} points for custom rule ${ruleName}`);
                  } else if (action === 'ban') {
                    await message.guild.members.ban(message.author, { reason: `Reached ${threshold} points for custom rule ${ruleName}` });
                  }
                  await logToWebhookCustom(
                    message,
                    'custom-delete-action',
                    `Applied ${action} to ${message.author.tag} (${message.author.id}) for reaching ${threshold} points`
                  );
                } catch (actionErr) {}
              }
            }

            try {
              await writeFile(settingsPath, JSON.stringify(settings, null, 2));
            } catch (writeErr) {
              console.error(`Failed to save settings for guild ${guildId}:`, writeErr);
            }
          }

          await logToWebhookCustom(
            message,
            'custom-delete',
            `Deleted message from ${message.author.tag} (${message.author.id}) due to custom rule ${ruleName} (regex: ${rule.regex}, points added: ${rule.addPoint || 0})`
          );

          break;
        }
      } catch (err) {
        console.error(`Error processing custom rule ${ruleName} in guild ${guildId}:`, err);
      }
    }
  });
}