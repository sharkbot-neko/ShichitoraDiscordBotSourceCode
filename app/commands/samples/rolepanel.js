import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ApplicationIntegrationType
} from 'discord.js';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('rolepanel')
  .setDescription('ロールパネルの設定を行います')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('新しいロールパネルを作成します')
      .addRoleOption(option =>
        option
          .setName('role1')
          .setDescription('ロール1')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role2')
          .setDescription('ロール2')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role3')
          .setDescription('ロール3')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role4')
          .setDescription('ロール4')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role5')
          .setDescription('ロール5')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role6')
          .setDescription('ロール6')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role7')
          .setDescription('ロール7')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role8')
          .setDescription('ロール8')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role9')
          .setDescription('ロール9')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role10')
          .setDescription('ロール10')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role11')
          .setDescription('ロール11')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role12')
          .setDescription('ロール12')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role13')
          .setDescription('ロール13')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role14')
          .setDescription('ロール14')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role15')
          .setDescription('ロール15')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role16')
          .setDescription('ロール16')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role17')
          .setDescription('ロール17')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role18')
          .setDescription('ロール18')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role19')
          .setDescription('ロール19')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('role20')
          .setDescription('ロール20')
          .setRequired(false)
      )
  );

async function logToWebhook(interaction, subcommand, details) {
  if (!webhookUrl) {
    console.error('Developer log webhook URL not configured.');
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle(`RolePanel Change in ${interaction.guild.name}`)
    .setDescription(
      `**Server**: ${interaction.guild.name} (${interaction.guildId})\n` +
      `**User**: ${interaction.user.tag} (${interaction.user.id})\n` +
      `**Subcommand**: ${subcommand}\n` +
      `**Details**: ${details}`
    )
    .setTimestamp();
  try {
    await axios.post(webhookUrl, {
      embeds: [embed.toJSON()],
    });
  } catch (err) {
    console.error('Error sending log to developer webhook:', err.message);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild.members.me.permissions.has(['SendMessages', 'ManageRoles'])) {
    await interaction.editReply({
      content: 'ボットに必要な権限（メッセージ送信、ロール管理）がありません！',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create') {
    const description = interaction.options.getString('description');

    const roles = [];
    for (let i = 1; i <= 20; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) {
        if (!interaction.guild.roles.cache.has(role.id)) {
          await interaction.editReply({
            content: `ロール ${role.name} が見つかりません。`,
            ephemeral: true,
          });
          return;
        }
        roles.push(role);
      }
    }

    if (roles.length === 0) {
      await interaction.editReply({
        content: '少なくとも1つのロールを指定してください。',
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('rolepanel_select')
      .setPlaceholder('ロールを選択してください')
      .addOptions(
        roles.map(role =>
          new StringSelectMenuOptionBuilder()
            .setLabel(role.name)
            .setValue(`rolepanel_${role.id}_${interaction.id}`)
            .setDescription(`ロール: ${role.name}`)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('Role Panel')
      .setDescription('Select Roles')
      .setColor('#00ff00')
      .addFields({
        name: 'ロール',
        value: roles.map(role => `<@&${role.id}>`).join(', '),
      });

    try {
      const message = await interaction.channel.send({
        embeds: [embed],
        components: [row],
      });

      await logToWebhook(
        interaction,
        subcommand,
        `Created role panel with roles: ${roles
          .map(role => role.name)
          .join(', ')}, messageId: ${message.id}`
      );

      await interaction.editReply({
        content: `ロールパネルを作成しました（ロール数: ${roles.length}）`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error creating role panel:', error);
      await interaction.editReply({
        content: 'ロールパネルの作成に失敗しました。',
        ephemeral: true,
      });
    }
  }
}
