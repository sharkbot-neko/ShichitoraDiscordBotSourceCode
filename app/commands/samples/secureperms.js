import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('secureperms')
  .setDescription('荒らし対策のためのロールおよびチャンネルの権限を更新')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return await interaction.editReply({ content: 'このコマンドは管理者のみ使用可能です。' });
  }

  const guild = interaction.guild;
  let response = '権限更新結果:\n';
  let roleCount = 0;
  let channelCount = 0;
  const MAX_UPDATES = 300;

  const permissionsToDeny = new PermissionsBitField([
    PermissionsBitField.Flags.UseApplicationCommands,
    PermissionsBitField.Flags.MentionEveryone,
    PermissionsBitField.Flags.UseExternalApps,
    PermissionsBitField.Flags.ManageWebhooks,
    PermissionsBitField.Flags.CreatePublicThreads,
    PermissionsBitField.Flags.CreatePrivateThreads,
  ]);

  for (const role of guild.roles.cache.values()) {
    if (roleCount >= MAX_UPDATES) {
      response += `- ロールの更新が上限(${MAX_UPDATES}件)に達しました\n`;
      break;
    }
    if (role.managed || role.id === guild.id || role.position >= guild.members.me.roles.highest.position) continue;
    try {
      const current = new PermissionsBitField(role.permissions);
      const updated = current.remove(permissionsToDeny);
      if (!current.equals(updated)) {
        await role.setPermissions(updated, '荒らし対策コマンドによる権限変更');
        roleCount++;
        response += `- ロール ${role.name} の権限を更新\n`;
      }
    } catch (error) {
      response += `- ロール ${role.name} の権限変更に失敗\n`;
    }
  }

  for (const channel of guild.channels.cache.values()) {
    if (channelCount >= MAX_UPDATES) {
      response += `- チャンネルの更新が上限(${MAX_UPDATES}件)に達しました\n`;
      break;
    }
    if (!channel.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.ManageChannels)) continue;
    try {
      await channel.permissionOverwrites.edit(guild.id, {
        UseApplicationCommands: false,
        MentionEveryone: false,
        UseExternalApps: false,
        ManageWebhooks: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
      }, { reason: '荒らし対策コマンドによる権限変更' });
      channelCount++;
      response += `- チャンネル ${channel.name} の権限を更新\n`;
    } catch (error) {
      response += `- チャンネル ${channel.name} の権限変更に失敗\n`;
    }
  }

  response += `\n合計: ${roleCount}個のロール、${channelCount}個のチャンネルの権限を更新`;

  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`Configuration Change in ${interaction.guild.name}`)
      .setDescription(`**Server**: ${interaction.guild.name} (${interaction.guildId})\n**User**: ${interaction.user.tag} (${interaction.user.id})\n**Command**: secureperms\n**Details**: Updated ${roleCount} roles and ${channelCount} channels`)
      .setTimestamp();
    try { await axios.post(webhookUrl, { embeds: [embed.toJSON()] }); } catch {}
  }

  await interaction.editReply(response);
}