import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const eventDelete = new Map();
const bypassUserIds = new Set(["1350156436562514043","1140963618423312436","1435610137548292187"]);

export async function handleEventDeleteSpam(client) {
  client.on(Events.GuildScheduledEventDelete, async (event) => {
    const logs = await event.guild.fetchAuditLogs({ type: 102, limit: 1 }).catch(() => null);
    const entry = logs?.entries.first();
    if (!entry || entry.target.id !== event.id) return;
    const member = await event.guild.members.fetch(entry.executor.id).catch(() => null);
    if (!member || bypassUserIds.has(member.id)) return;

    const guildId = event.guild.id;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try { settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')); } catch { return; }

    if (!settings.antiEventDeleteSpam?.enabled) return;

    if (settings.notBot?.enabled && member.bot) return;
    if (settings.notAdmin?.enabled && member.permissions.has('Administrator')) return;

    const wl = settings.whitelist || {};
    const rwl = settings.ruleWhitelist?.event_delete || { channels:[], categories:[], roles:[], members:[] };

    const isWhitelisted = 
      member.roles.cache.some(r => wl.roles?.includes(r.id)) ||
      wl.members?.includes(member.id) ||
      member.roles.cache.some(r => rwl.roles.includes(r.id)) ||
      rwl.members.includes(member.id);

    if (isWhitelisted) return;

    const limit = settings.antiEventDeleteSpam.eventLimit || 2;
    const time = settings.antiEventDeleteSpam.timeframe || 5000;
    const points = settings.points?.event_delete || 1;
    const now = Date.now();

    let arr = eventDelete.get(member.id) || [];
    arr.push(now);
    const recent = arr.filter(t => now - t <= time);
    eventDelete.set(member.id, recent);

    if (recent.length > limit) {
      const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
      let data = {};
      try { data = JSON.parse(await fs.readFile(pointsPath, 'utf8')); } catch {}
      if (!data[guildId]) data[guildId] = {};
      if (!data[guildId][member.id]) data[guildId][member.id] = { points: 0 };
      data[guildId][member.id].points += points;
      const total = data[guildId][member.id].points;

      const thresh = settings.points?.thresholds || { '10': 'timeout', '20': 'kick', '30': 'ban' };
      let punish = null;
      for (const [p, a] of Object.entries(thresh)) if (total >= +p) punish = a;

      if (settings.block?.enabled && punish) {
        try {
          if (punish === 'timeout') await member.timeout(settings.block.timeout || 600000, 'Event delete spam');
          if (punish === 'kick') await member.kick('Event delete spam');
          if (punish === 'ban') await event.guild.members.ban(member.id, { reason: 'Event delete spam' });
        } catch {}
      }

      await fs.writeFile(pointsPath, JSON.stringify(data, null, 2)).catch(() => {});

        if (settings.logWebhook) { axios.post(settings.logWebhook, { embeds: [new EmbedBuilder().setTitle('イベント削除スパム').addFields({name:'ユーザー',value:`${member.user.tag} (${member.id})`},{name:'ポイント',value:`${total}`},{name:'処罰',value:punish||'なし'}).setTimestamp().toJSON()] }).catch(() => {}); }

      if (webhookUrl) axios.post(webhookUrl, { embeds: [new EmbedBuilder().setTitle(`イベント削除スパム - ${event.guild.name}`).setDescription(`ユーザー: ${member.user.tag}\nポイント: ${total}\n処罰: ${punish||'なし'}`).setTimestamp().toJSON()] }).catch(() => {});
    }
  });

  setInterval(() => {
    for (const [id, arr] of eventDelete) {
      const f = arr.filter(t => Date.now() - t < 10000);
      if (f.length === 0) eventDelete.delete(id); else eventDelete.set(id, f);
    }
  }, 60000);
}