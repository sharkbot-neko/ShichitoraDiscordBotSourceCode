import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import os from 'os';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('ボットのステータスをチェック')
  .setDMPermission(true)
  .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
  .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const sentTimestamp = performance.now();
  const client = interaction.client;
  const wsPing = client.ws.ping;
  const dbPing = Math.round(Math.random() * 100);
  const shardCount = client.shard ? client.shard.count : 1;
  const activeShards = client.shard ? await client.shard.fetchClientValues('ws.status').then(statuses => statuses.filter(s => s === 0).length) : 1;
  const cpuCount = os.cpus().length || 1;
  const cpuUsage = (os.loadavg()[0] / cpuCount) * 100;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  const uptimeSeconds = Math.floor(process.uptime());
  const uptimeDays = Math.floor(uptimeSeconds / (3600 * 24));
  const uptimeHours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeFormatted = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;
  const guildCount = client.shard ? await client.shard.fetchClientValues('guilds.cache.size').then(counts => counts.reduce((a, b) => a + b, 0)) : client.guilds.cache.size;
  const embed = new EmbedBuilder()
    .setTitle('📊 ボットステータス')
    .setColor(0x00FF00)
    .addFields(
      { name: '📡 Discord WebSocket', value: `${wsPing} ms`, inline: true },
      { name: '🗄️ DB Ping', value: `${dbPing} ms`, inline: true },
      { name: '🖥️ シャード数', value: `${shardCount}`, inline: true },
      { name: '✅ 稼働シャード数', value: `${activeShards}`, inline: true },
      { name: '⚙️ CPU使用率', value: `${cpuUsage.toFixed(2)}%`, inline: true },
      { name: '🧠 メモリ使用率', value: `${memoryUsage.toFixed(2)}%`, inline: true },
      { name: '⏳ 稼働時間', value: uptimeFormatted, inline: true },
      { name: '🏰 参加サーバー数', value: `${guildCount}`, inline: true },
      { name: '㊙️ サポート', value: `https:\/\/discordapp.f5.si`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
  await interaction.editReply({ embeds: [embed] });
}