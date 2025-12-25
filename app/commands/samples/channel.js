import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, PermissionsBitField, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('channel')
  .setDescription('チャンネル管理コマンド')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('新しいチャンネルを作成します')
      .addStringOption(option => 
        option.setName('type')
          .setDescription('チャンネルタイプ（text/voice）')
          .setRequired(true)
          .addChoices({ name: 'テキスト', value: 'text' }, { name: 'ボイス', value: 'voice' }))
      .addStringOption(option => 
        option.setName('name')
          .setDescription('チャンネル名')
          .setRequired(true))
      .addStringOption(option => 
        option.setName('topic')
          .setDescription('チャンネルトピック')
          .setRequired(false))
      .addBooleanOption(option => 
        option.setName('nsfw')
          .setDescription('NSFWとしてマーク')
          .setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('チャンネルを削除します')
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('削除するチャンネル')
          .setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('チャンネルを編集します')
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('編集するチャンネル')
          .setRequired(true))
      .addStringOption(option => 
        option.setName('name')
          .setDescription('新しいチャンネル名')
          .setRequired(false))
      .addStringOption(option => 
        option.setName('topic')
          .setDescription('新しいトピック')
          .setRequired(false))
      .addBooleanOption(option => 
        option.setName('nsfw')
          .setDescription('NSFW設定')
          .setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('recreate')
      .setDescription('チャンネルを同じ設定で再作成します')
      .addChannelOption(option => 
        option.setName('channel')
          .setDescription('再作成するチャンネル')
          .setRequired(true))
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const user = interaction.user;

  // 権限チェック
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'このコマンドを使用するには管理者権限が必要です。', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const logEmbed = new EmbedBuilder()
    .setTitle('チャンネル管理アクション')
    .setTimestamp()
    .addFields(
      { name: 'サーバー', value: guild.name, inline: true },
      { name: 'モデレーター', value: user.tag, inline: true },
      { name: 'アクション', value: subcommand, inline: true }
    );

  try {
    switch (subcommand) {
      case 'create': {
        const type = interaction.options.getString('type') === 'text' ? 'GUILD_TEXT' : 'GUILD_VOICE';
        const name = interaction.options.getString('name');
        const topic = interaction.options.getString('topic');
        const nsfw = interaction.options.getBoolean('nsfw') ?? false;

        // バリデーション
        if (!name.match(/^[a-z0-9_-]{2,100}$/)) {
          return interaction.editReply('チャンネル名は2～100文字で、英小文字、数字、ハイフン、アンダースコアのみ使用可能です。');
        }

        const channel = await guild.channels.create({ name, type, topic, nsfw });
        logEmbed.addFields(
          { name: '作成したチャンネル', value: `${channel.name} (${channel.id})`, inline: true }
        );
        await interaction.editReply(`チャンネル ${channel.name} を作成しました`);
        break;
      }
      case 'delete': {
        const channel = interaction.options.getChannel('channel');
        logEmbed.addFields(
          { name: '削除したチャンネル', value: `${channel.name} (${channel.id})`, inline: true }
        );
        await channel.delete();
        await interaction.editReply(`チャンネル ${channel.name} を削除しました`);
        break;
      }
      case 'edit': {
        const channel = interaction.options.getChannel('channel');
        const name = interaction.options.getString('name') ?? channel.name;
        const topic = interaction.options.getString('topic') ?? channel.topic;
        const nsfw = interaction.options.getBoolean('nsfw') ?? channel.nsfw;

        // バリデーション
        if (name && !name.match(/^[a-z0-9_-]{2,100}$/)) {
          return interaction.editReply('チャンネル名は2～100文字で、英小文字、数字、ハイフン、アンダースコアのみ使用可能です。');
        }

        await channel.edit({ name, topic, nsfw });
        logEmbed.addFields(
          { name: '編集したチャンネル', value: `${channel.name} (${channel.id})`, inline: true }
        );
        await interaction.editReply(`チャンネル ${channel.name} を編集しました`);
        break;
      }
      case 'recreate': {
        const channel = interaction.options.getChannel('channel');
        const { name, type, topic, nsfw, permissionOverwrites, parentId, rateLimitPerUser, position } = channel;

        // バリデーション
        if (!channel.deletable) {
          return interaction.editReply('このチャンネルは削除できません。');
        }

        await channel.delete();
        const newChannel = await guild.channels.create({
          name,
          type,
          topic,
          nsfw,
          permissionOverwrites: permissionOverwrites.cache.map(perm => ({
            id: perm.id,
            allow: perm.allow,
            deny: perm.deny
          })),
          parent: parentId,
          rateLimitPerUser,
          position
        });
        logEmbed.addFields(
          { name: '再作成したチャンネル', value: `${newChannel.name} (${newChannel.id})`, inline: true },
          { name: '位置', value: `${position}`, inline: true }
        );
        await interaction.editReply(`チャンネル ${newChannel.name} を再作成しました`);
        break;
      }
    }

    // Webhookログ送信
    try {
      await axios.post(webhookUrl, {
        embeds: [logEmbed.toJSON()]
      });
    } catch (webhookError) {
      console.error('Webhook送信エラー:', webhookError.message);
    }
  } catch (error) {
    console.error(`コマンド ${subcommand} の実行中にエラー:`, error);
    await interaction.editReply(`コマンド ${subcommand} の実行中にエラーが発生しました: ${error.message}`);
  }
}