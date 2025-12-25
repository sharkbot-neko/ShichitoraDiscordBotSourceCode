import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  EmbedBuilder,
  InteractionContextType,
  ApplicationIntegrationType
} from 'discord.js';
import { saveVerifyData, loadVerifyData } from '../../utils/verifyData.js';

const types = ['web-verify'];
const OAUTH_URL = `https://discord.com/oauth2/authorize?client_id=1350156436562514043&response_type=code&redirect_uri=https%3A%2F%2Fverify.discordd.me&integration_type=1&scope=identify+guilds+email+guilds.members.read+guilds.join+applications.commands+sdk.social_layer+sdk.social_layer_presence+messages.read+rpc.notifications.read+rpc.video.read+rpc.screenshare.write+openid+applications.store.update+applications.builds.read+applications.entitlements+applications.commands.permissions.update`;

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('認証パネルを作成')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addRoleOption(opt =>
    opt.setName('role')
      .setDescription('付与するロール')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const role = interaction.options.getRole('role');
  const guildId = interaction.guild.id;

  const restrictedPerms = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
  ];

  if (restrictedPerms.some(p => role.permissions.has(p))) {
    return interaction.editReply({ content: 'エラー：危険な権限を含むロールは指定できません。' });
  }

  await saveVerifyData(guildId, { roleId: role.id });

  const button = new ButtonBuilder()
    .setLabel('Start')
    .setStyle(ButtonStyle.Link)
    .setURL(OAUTH_URL);

  const row = new ActionRowBuilder().addComponents(button);

  const embed = new EmbedBuilder()
    .setTitle('Verify Panel')
    .setColor(0x00ff00)
    .setDescription('Click the button below to complete authentication on the external site. After authentication, the role will be automatically assigned. Permissions obtained through OAuth2 will be used under appropriate management and in accordance with the [Terms of Service](https://bot.discordd.me/terms) and [Privacy Policy](https://bot.discordd.me/privacy).')
    .setFooter({ text: 'Verify System v5' });

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: '認証パネルを作成しました！' });
}