import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ApplicationIntegrationType
} from 'discord.js';
import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('ロール管理コマンド')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
    .setName('create')
    .setDescription('新しいロールを作成します')
    .addStringOption(option => option.setName('name').setDescription('ロール名').setRequired(true))
    .addStringOption(option => option.setName('color').setDescription('カラー（例: #FF0000）').setRequired(false))
    .addBooleanOption(option => option.setName('mentionable').setDescription('メンション可能').setRequired(false))
    .addBooleanOption(option => option.setName('hoist').setDescription('メンバー一覧に表示').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('delete')
    .setDescription('ロールを削除します')
    .addRoleOption(option => option.setName('role').setDescription('削除するロール').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('edit')
    .setDescription('ロールを編集します')
    .addRoleOption(option => option.setName('role').setDescription('編集するロール').setRequired(true))
    .addStringOption(option => option.setName('name').setDescription('新しいロール名').setRequired(false))
    .addStringOption(option => option.setName('color').setDescription('新しいカラー').setRequired(false))
    .addBooleanOption(option => option.setName('mentionable').setDescription('メンション可能').setRequired(false))
    .addBooleanOption(option => option.setName('hoist').setDescription('メンバー一覧に表示').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('add')
    .setDescription('ユーザーにロールを追加します')
    .addUserOption(option => option.setName('user').setDescription('ロールを追加するユーザー').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('追加するロール').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('remove')
    .setDescription('ユーザーからロールを削除します')
    .addUserOption(option => option.setName('user').setDescription('ロールを削除するユーザー').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('削除するロール').setRequired(true))
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const user = interaction.user;

  await interaction.deferReply({
    ephemeral: true
  });

  const logEmbed = new EmbedBuilder()
    .setTitle('ロール管理アクション')
    .setTimestamp()
    .addFields({
      name: 'サーバー',
      value: guild.name,
      inline: true
    }, {
      name: 'モデレーター',
      value: user.tag,
      inline: true
    }, {
      name: 'アクション',
      value: subcommand,
      inline: true
    });

  try {
    switch (subcommand) {
      case 'create': {
        const name = interaction.options.getString('name');
        const color = interaction.options.getString('color');
        const mentionable = interaction.options.getBoolean('mentionable') || false;
        const hoist = interaction.options.getBoolean('hoist') || false;
        const role = await guild.roles.create({
          name,
          color,
          mentionable,
          hoist
        });
        logEmbed.addFields({
          name: '作成したロール',
          value: role.name,
          inline: true
        });
        await interaction.editReply(`ロール ${role.name} を作成しました`);
        break;
      }
      case 'delete': {
        const role = interaction.options.getRole('role');
        await role.delete();
        logEmbed.addFields({
          name: '削除したロール',
          value: role.name,
          inline: true
        });
        await interaction.editReply(`ロール ${role.name} を削除しました`);
        break;
      }
      case 'edit': {
        const role = interaction.options.getRole('role');
        const name = interaction.options.getString('name');
        const color = interaction.options.getString('color');
        const mentionable = interaction.options.getBoolean('mentionable');
        const hoist = interaction.options.getBoolean('hoist');
        await role.edit({
          name,
          color,
          mentionable,
          hoist
        });
        logEmbed.addFields({
          name: '編集したロール',
          value: role.name,
          inline: true
        });
        await interaction.editReply(`ロール ${role.name} を編集しました`);
        break;
      }
      case 'add': {
        const target = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = await guild.members.fetch(target.id);
        const restrictedPermissions = [
          PermissionFlagsBits.Administrator,
          PermissionFlagsBits.ManageGuild,
          PermissionFlagsBits.ManageRoles,
          PermissionFlagsBits.ManageChannels
        ];
        const hasRestrictedPermissions = restrictedPermissions.some(permission =>
          role.permissions.has(permission)
        );
        if (hasRestrictedPermissions) {
          await interaction.editReply({
            content: `エラー: ロール ${role.name} には管理者、サーバー管理、ロール管理、またはチャンネル管理の権限が含まれています。このロールは荒らし対策のため付与できません。`,
            ephemeral: true
          });
          return;
        }
        await member.roles.add(role);
        logEmbed.addFields({
          name: '対象',
          value: target.tag,
          inline: true
        }, {
          name: '追加したロール',
          value: role.name,
          inline: true
        });
        await interaction.editReply(`${target.tag} にロール ${role.name} を追加しました`);
        break;
      }
      case 'remove': {
        const target = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = await guild.members.fetch(target.id);
        await member.roles.remove(role);
        logEmbed.addFields({
          name: '対象',
          value: target.tag,
          inline: true
        }, {
          name: '削除したロール',
          value: role.name,
          inline: true
        });
        await interaction.editReply(`${target.tag} からロール ${role.name} を削除しました`);
        break;
      }
    }

    try {
      await axios.post(webhookUrl, {
        embeds: [logEmbed.toJSON()]
      });
    } catch (webhookError) {
      console.error('Webhook送信エラー:', webhookError.message);
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply(`コマンド ${subcommand} の実行中にエラーが発生しました: ${error.message}`);
  }
}
