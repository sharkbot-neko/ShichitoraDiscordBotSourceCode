import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('point')
  .setDescription('ユーザーの違反ポイント関連の設定など')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('ユーザーの違反ポイントを設定します')
      .addUserOption(option =>
        option.setName('user').setDescription('対象ユーザー').setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('points')
          .setDescription('設定するポイント数')
          .setRequired(true)
          .setMinValue(0)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('ユーザーの違反ポイントを追加します')
      .addUserOption(option =>
        option.setName('user').setDescription('対象ユーザー').setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('points')
          .setDescription('追加するポイント数')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('ユーザーの違反ポイントを削除します')
      .addUserOption(option =>
        option.setName('user').setDescription('対象ユーザー').setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('points')
          .setDescription('削除するポイント数')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('check')
      .setDescription('ユーザーの違反ポイントを確認します')
      .addUserOption(option =>
        option.setName('user').setDescription('対象ユーザー').setRequired(true)
      )
  );

async function logToWebhook(interaction, subcommand, details) {
  if (!webhookUrl) {
    console.error('Developer log webhook URL not configured.');
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle(`Point Edit in ${interaction.guild.name}`)
    .setDescription(
      `**Server**: ${interaction.guild.name} (${interaction.guildId})\n` +
      `**User**: ${interaction.user.tag} (${interaction.user.id})\n` +
      `**Subcommand**: ${subcommand}\n` +
      `**Details**: ${details}`
    )
    .setTimestamp();
  try {
    await axios.post(webhookUrl, {
      embeds: [embed.toJSON()]
    });
  } catch (err) {
    console.error('Error sending log to developer webhook:', err.message);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.editReply({
      content: 'このコマンドを使用するにはサーバー管理権限が必要です。',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId;
  const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser('user');
  const points = interaction.options.getInteger('points');

  let pointsData;
  try {
    pointsData = JSON.parse(await readFile(pointsPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      pointsData = {};
      await writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
    } else {
      console.error(`Error reading ${pointsPath}:`, err);
      await interaction.editReply({
        content: 'ポイントデータの読み込みに失敗しました。',
        ephemeral: true,
      });
      return;
    }
  }

  if (!pointsData[guildId]) pointsData[guildId] = {};
  if (!pointsData[guildId][user.id]) pointsData[guildId][user.id] = { points: 0, lastViolation: null };

  let response;
  let logDetails;

  if (subcommand === 'set') {
    pointsData[guildId][user.id].points = points;
    response = `${user.tag} の違反ポイントを ${points} に設定しました。`;
    logDetails = `Set ${user.tag} (${user.id}) points to ${points}`;
  } else if (subcommand === 'add') {
    pointsData[guildId][user.id].points += points;
    response = `${user.tag} に ${points} ポイントを追加しました。現在のポイント: ${pointsData[guildId][user.id].points}`;
    logDetails = `Added ${points} points to ${user.tag} (${user.id}), new total: ${pointsData[guildId][user.id].points}`;
  } else if (subcommand === 'remove') {
    pointsData[guildId][user.id].points = Math.max(0, pointsData[guildId][user.id].points - points);
    response = `${user.tag} から ${points} ポイントを削除しました。現在のポイント: ${pointsData[guildId][user.id].points}`;
    logDetails = `Removed ${points} points from ${user.tag} (${user.id}), new total: ${pointsData[guildId][user.id].points}`;
  } else if (subcommand === 'check') {
    const currentPoints = pointsData[guildId][user.id].points || 0;
    response = `${user.tag} の現在の違反ポイント: ${currentPoints}`;
    logDetails = `Checked points for ${user.tag} (${user.id}): ${currentPoints}`;
  }

  try {
    await writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
    await logToWebhook(interaction, subcommand, logDetails);
    await interaction.editReply({
      content: response,
      ephemeral: true,
    });
  } catch (err) {
    console.error(`Error writing ${pointsPath}:`, err);
    await interaction.editReply({
      content: 'ポイントデータの保存に失敗しました。',
      ephemeral: true,
    });
  }
}