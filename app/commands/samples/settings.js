import {
  SlashCommandBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  ApplicationIntegrationType,
  InteractionContextType
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_DIR = path.join(__dirname, '..', '..', 'settings');

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('設定ファイル')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(sub => sub
    .setName('get')
    .setDescription('現在の設定JSONをダウンロード')
  );

export async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'サーバー内限定です。', ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();
  const filePath = path.join(SETTINGS_DIR, `${interaction.guild.id}.json`);

  if (sub === 'get') {
    await interaction.deferReply({ ephemeral: true });

    if (!fs.existsSync(filePath)) {
      return interaction.editReply('このサーバーに設定ファイルはありません。');
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const attachment = new AttachmentBuilder(Buffer.from(content), { name: 'settings.json' });

    return interaction.editReply({
      content: '現在の設定ファイルです',
      files: [attachment]
    });
  }
}