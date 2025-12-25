import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const eventUpdate = new Map();
const bypassUserIds = new Set(["1350156436562514043","1140963618423312436","1435610137548292187"]);

export async function handleEventUpdateSpam(client) {
  client.on(Events.GuildScheduledEventUpdate, async (oldEvent, newEvent) => {
    if (!newEvent?.creatorId) return;
    const member = await newEvent.guild.members.fetch(newEvent.creatorId).catch(() => null);
    if (!member || bypassUserIds.has(member.id)) return;

    const guildId = newEvent.guild.id;
    const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
    let settings;
    try { settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')); } catch { return; }

    if (!settings.antiEventUpdateSpam?.enabled) return;

    if (settings.notBot?.enabled && member.bot) return;
    if (settings.notAdmin?.enabled && member.permissions.has('Administrator')) return;

    const wl = settings.whitelist || {};
    const rwl = settings.ruleWhitelist?.event_update || { channels:[], categories:[], roles:[], members:[] };

    const isWhitelisted = 
      wl.channels?.includes(newEvent.channelId) ||
      wl.categories?.includes(newEvent.channelId) ||
      member.roles.cache.some(r => wl.roles?.includes(r.id)) ||
      wl.members?.includes(member.id) ||
      rwl.channels.includes(newEvent.channelId) ||
      rwl.categories.includes(newEvent.channelId) ||
      member.roles.cache.some(r => rwl.roles.includes(r.id)) ||
      rwl.members.includes(member.id);

    if (isWhitelisted) return;

    const limit = settings.antiEventUpdateSpam.eventLimit || 2;
    const time = settings.antiEventUpdateSpam.timeframe || 5000;
    const points = settings.points?.event_update || 1;
    const now = Date.now();

    let arr = eventUpdate.get(member.id) || [];
    arr.push(now);
    const recent = arr.filter(t => now - t <= time);
    eventUpdate.set(member.id, recent);

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
          if (punish === 'timeout') await member.timeout(settings.block.timeout || 600000, 'Event update spam');
          if (punish === 'kick') await member.kick('Event update spam');
          if (punish === 'ban') await newEvent.guild.members.ban(member.id, { reason: 'Event update spam' });
        } catch {}
      }

      await fs.writeFile(pointsPath, JSON.stringify(data, null, 2)).catch(() => {});

        if (settings.logWebhook) { axios.post(settings.logWebhook, { embeds: [new EmbedBuilder().setTitle('イベント編集スパム').addFields({name:'ユーザー',value:`${member.user.tag} (${member.id})`},{name:'ポイント',value:`${total}`},{name:'処罰',value:punish||'なし'}).setTimestamp().toJSON()] }).catch(() => {}); }

      if (webhookUrl) axios.post(webhookUrl, { embeds: [new EmbedBuilder().setTitle(`イベント編集スパム - ${newEvent.guild.name}`).setDescription(`ユーザー: ${member.user.tag}\nポイント: ${total}\n処罰: ${punish||'なし'}`).setTimestamp().toJSON()] }).catch(() => {});
    }
  });

  setInterval(() => {
    for (const [id, arr] of eventUpdate) {
      const f = arr.filter(t => Date.now() - t < 10000);
      if (f.length === 0) eventUpdate.delete(id); else eventUpdate.set(id, f);
    }
  }, 60000);
}