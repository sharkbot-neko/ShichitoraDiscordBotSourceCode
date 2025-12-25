import { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('ヘルプ | Help')
  .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
  .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
  .setDMPermission(true);

export async function execute(interaction) {
  await interaction.reply({ content: `\#\# ヘルプはこちら\nhttps\:\/\/bot\.discordd\.me\/help`, ephemeral: true });
}