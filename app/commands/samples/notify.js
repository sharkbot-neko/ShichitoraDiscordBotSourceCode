import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { writeFile } from 'fs/promises';
import { bumpNotifySettings, getServerSettingsPath } from '../../events/bumpUpNotify.js';
import { join } from 'path';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('notify')
  .setDescription('Bump/Up/Vote通知機能を設定します。')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('通知機能をオンまたはオフにします。')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('role')
      .setDescription('通知時にメンションするロールを設定します。')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('メンションするロール（未指定でメンションなし）')
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();
  let settings = bumpNotifySettings.get(guildId) || { enabled: false, mentionRoleId: null, schedules: [] };

  if (subcommand === 'toggle') {
    settings.enabled = !settings.enabled;
    bumpNotifySettings.set(guildId, settings);
    try {
      await writeFile(getServerSettingsPath(guildId), JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Error saving bump settings:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('エラー')
            .setDescription('設定の保存に失敗しました。管理者に連絡してください。')
            .setColor('#ff0000'),
        ],
        ephemeral: true,
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle('Bump/Up/Vote通知設定')
      .setDescription(
        settings.enabled
          ? 'Bump/Up/Vote通知が有効になりました！'
          : 'Bump/Up/Vote通知が無効になりました。'
      )
      .setColor(settings.enabled ? '#00ff00' : '#ff0000');
    await interaction.editReply({ embeds: [embed] });
  } else if (subcommand === 'role') {
    const role = interaction.options.getRole('role');
    settings.mentionRoleId = role ? role.id : null;
    bumpNotifySettings.set(guildId, settings);
    try {
      await writeFile(getServerSettingsPath(guildId), JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Error saving bump settings:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('エラー')
            .setDescription('設定の保存に失敗しました。管理者に連絡してください。')
            .setColor('#ff0000'),
        ],
        ephemeral: true,
      });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle('Bump/Up/Vote通知ロール設定')
      .setDescription(
        role
          ? `通知時に<@&${role.id}>をメンションします。`
          : '通知時のメンションが無効になりました。'
      )
      .setColor('#00ff00');
    await interaction.editReply({ embeds: [embed] });
  }
}