import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

const bypassUserIds = new Set([
  "1350156436562514043", "1140963618423312436", "1435610137548292187",
  "850493201064132659", "302050872383242240", "761562078095867916",
  "1233072112139501608"
]);

const CLASH_LIMITS = {
  maxPixels: 25_000_000,
  maxWidth: 10000,
  maxHeight: 10000,
  maxFileSizeMB: 60
};

const tempDir = path.join(process.cwd(), 'temp_gif_check');
await fs.mkdir(tempDir, { recursive: true }).catch(() => {});

export async function handleAntiTrollGIF(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (bypassUserIds.has(message.author.id)) return;
    if (message.system || message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings = {};

    try {
      settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch {
      return;
    }

    if (settings.notBot?.enabled && message.author.bot) return;
    if (settings.notAdmin?.enabled && message.member?.permissions.has('Administrator')) return;

    settings.whitelist = {
      channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
      categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
      roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
      members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
    };

    settings.antiTroll = settings.antiTroll ?? { enabled: false, rules: {} };
    settings.antiTroll.rules ??= {};
    settings.antiTroll.rules.clash_gif ??= { enabled: false };
    settings.antiTroll.rules.flash_gif ??= { enabled: false };

    settings.ruleWhitelist ??= {};
    settings.ruleWhitelist.clash_gif ??= { channels: [], categories: [], roles: [], members: [] };
    settings.ruleWhitelist.flash_gif ??= { channels: [], categories: [], roles: [], members: [] };

    settings.points ??= {};
    settings.points.clash_gif ??= 8;
    settings.points.flash_gif ??= 12;
    settings.points.thresholds ??= { "10": "timeout", "15": "delete_webhook", "20": "kick", "30": "ban" };

    const channel = message.channel;

    const isGloballyWhitelisted =
      settings.whitelist.channels.includes(message.channelId) ||
      settings.whitelist.categories.includes(channel.parentId) ||
      message.member?.roles.cache.some(r => settings.whitelist.roles.includes(r.id)) ||
      settings.whitelist.members.includes(message.author.id);

    if (isGloballyWhitelisted || !settings.antiTroll.enabled) return;

    const candidates = [];

    for (const att of message.attachments.values()) {
      if (att.contentType === 'image/gif') {
        candidates.push({ url: att.url, name: att.name || 'attachment.gif' });
      }
    }

    for (const embed of message.embeds) {
      if (embed.image?.url && embed.image.width && embed.image.height) {
        candidates.push({ url: embed.image.url, name: 'embed_image' });
      }
      if (embed.thumbnail?.url && embed.thumbnail.width && embed.thumbnail.height) {
        candidates.push({ url: embed.thumbnail.url, name: 'thumbnail' });
      }
      if (embed.type === 'gifv' && embed.url) {
        candidates.push({ url: embed.url, name: 'gifv' });
      }
    }

    if (candidates.length === 0) return;

    for (const cand of candidates) {
      let triggered = false;
      let rule = '';
      let reason = '';

      if (settings.antiTroll.rules.clash_gif.enabled && !isRuleWhitelisted(message, settings, 'clash_gif')) {
        const result = await checkClashGIF(cand.url);
        if (result.isClash) {
          triggered = true;
          rule = 'clash_gif';
          reason = result.reason;
        }
      }

      if (!triggered && settings.antiTroll.rules.flash_gif.enabled && !isRuleWhitelisted(message, settings, 'flash_gif')) {
        const result = await checkFlashGIF(cand.url);
        if (result.isFlash) {
          triggered = true;
          rule = 'flash_gif';
          reason = result.reason;
        }
      }

      if (triggered) {
        await handleViolation(message, rule, settings, reason, cand.url);
        return;
      }
    }
  });
}

function isRuleWhitelisted(message, settings, rule) {
  const wl = settings.ruleWhitelist[rule];
  return (
    wl.channels.includes(message.channelId) ||
    wl.categories.includes(message.channel.parentId) ||
    message.member?.roles.cache.some(r => wl.roles.includes(r.id)) ||
    wl.members.includes(message.author.id)
  );
}

async function downloadGIF(url) {
  const filename = `gif_${Date.now()}_${Math.random().toString(36)}.gif`;
  const filepath = path.join(tempDir, filename);

  try {
    const res = await axios.get(url, { responseType: 'stream', timeout: 20000 });
    const writer = require('fs').createWriteStream(filepath);
    res.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const buffer = await fs.readFile(filepath);
    await fs.unlink(filepath).catch(() => {});
    return buffer;
  } catch {
    return null;
  }
}

async function checkClashGIF(url) {
  const buffer = await downloadGIF(url);
  if (!buffer || !buffer.toString('ascii', 0, 6).match(/^GIF8[79]a$/)) return { isClash: false };

  const w = buffer.readUInt16LE(6);
  const h = buffer.readUInt16LE(8);
  const px = w * h;

  if (px > CLASH_LIMITS.maxPixels || w > CLASH_LIMITS.maxWidth || h > CLASH_LIMITS.maxHeight) {
    return { isClash: true, reason: `解像度超過 ${w}×${h} (${(px/1000000).toFixed(1)}MP)` };
  }
  return { isClash: false };
}

async function checkFlashGIF(url) {
  const buffer = await downloadGIF(url);
  if (!buffer || !buffer.toString('ascii', 0, 6).match(/^GIF8[79]a$/)) return { isFlash: false };

  let pos = 10;
  if (buffer[pos] & 0x80) pos += 3 * (2 << (buffer[pos] & 0x07));
  pos += 2;

  let frames = 0;
  while (pos < buffer.length - 20) {
    if (buffer[pos] === 0x21 && buffer[pos + 1] === 0xF9) { frames++; pos += 8; }
    else if (buffer[pos] === 0x2C) { frames++; pos += 10; while (buffer[pos]) pos += buffer[pos] + 1; pos++; }
    else break;
  }

  const sizeMB = buffer.length / (1024 * 1024);
  const dangerous = frames > 120 || (sizeMB > 0.1 && frames / sizeMB > 180);

  return {
    isFlash: dangerous,
    reason: dangerous ? `高速点滅GIF検出 (${frames}フレーム, ${sizeMB.toFixed(2)}MB)` : null
  };
}

async function handleViolation(message, rule, settings, reason, url) {
  const points = settings.points?.[rule] || 10;
  const guildId = message.guild.id;
  const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
  let pointsData = {};

  try {
    pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
  } catch {
    pointsData = {};
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2)).catch(() => {});
  }

  if (!pointsData[guildId]) pointsData[guildId] = {};
  if (!pointsData[guildId][message.author.id]) {
    pointsData[guildId][message.author.id] = { points: 0, lastViolation: null };
  }

  pointsData[guildId][message.author.id].points += points;
  pointsData[guildId][message.author.id].lastViolation = Date.now();
  const totalPoints = pointsData[guildId][message.author.id].points;

  let punishment = null;
  const thresholds = settings.points?.thresholds || { '10': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' };
  for (const [point, action] of Object.entries(thresholds)) {
    if (totalPoints >= parseInt(point)) punishment = action;
  }

  if (settings.block?.enabled && punishment) {
    try {
      if (punishment === 'timeout') {
        await message.member.timeout(settings.block.timeout || 600000, `TrollGIF: ${rule} - ${reason}`);
      } else if (punishment === 'kick') {
        await message.member.kick(`TrollGIF: ${rule} - ${reason}`);
      } else if (punishment === 'ban') {
        await message.guild.members.ban(message.author.id, { reason: `TrollGIF: ${rule} - ${reason}` });
      } else if (punishment === 'delete_webhook') {
        if (message.webhookId) {
          const webhook = await message.channel.fetchWebhooks().then(w => w.find(x => x.id === message.webhookId));
          if (webhook) await webhook.delete(`TrollGIF: ${rule}`);
        }
      }
    } catch (err) {
      console.error(`処罰失敗 (${punishment}):`, err);
    }
  }

  await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2)).catch(() => {});

  const title = rule === 'clash_gif' ? 'ClashGIF 検知' : 'FlashGIF 検知（光過敏性リスク）';

    if (settings.logWebhook) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0xFF0000)
        .setDescription(
          `**ユーザー**: ${message.author.tag}\n` +
          `**ルール**: ${rule}\n` +
          `**理由**: ${reason}\n` +
          `**ポイント**: ${totalPoints}\n` +
          `**処罰**: ${punishment || 'なし'}`
        )
        .setThumbnail(url)
        .setTimestamp();
      await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
    }

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`${title} - ${message.guild.name}`)
      .setColor(0xFF0000)
      .setDescription(
        `**サーバー**: ${message.guild.name} (${guildId})\n` +
        `**チャンネル**: ${message.channel.name}\n` +
        `**ユーザー**: ${message.author.tag} (${message.author.id})\n` +
        `**ルール**: ${rule}\n` +
        `**理由**: ${reason}\n` +
        `**ポイント**: ${totalPoints}\n` +
        `**処罰**: ${punishment || 'なし'}`
      )
      .setImage(url)
      .setTimestamp();

    await axios.post(webhookUrl, { embeds: [embed.toJSON()] }).catch(() => {});
  }

  try { await message.delete(); } catch {}
}