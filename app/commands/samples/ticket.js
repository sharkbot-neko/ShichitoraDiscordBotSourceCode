import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ApplicationIntegrationType,
  InteractionContextType
} from 'discord.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('チケットパネルを作成します。')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('チケットパネルの設定')
      .addChannelOption(option =>
        option
          .setName('parent')
          .setDescription('チケットスレッドを作成する親テキストチャンネル')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addRoleOption(option =>
        option
          .setName('support_role')
          .setDescription('チケットを見れるサポートスタッフロール')
          .setRequired(true)
      )
  );

async function logToWebhook(interaction, subcommand, details) {
  if (!webhookUrl) return;
  const embed = new EmbedBuilder()
    .setTitle(`Ticket Panel Setup - ${interaction.guild.name}`)
    .setDescription(
      `**サーバー**: ${interaction.guild.name} (${interaction.guildId})\n` +
      `**実行者**: ${interaction.user.tag} (${interaction.user.id})\n` +
      `**サブコマンド**: ${subcommand}\n` +
      `**詳細**: ${details}`
    )
    .setTimestamp()
    .setColor('#00ff00');
  try {
    await axios.post(webhookUrl, { embeds: [embed.toJSON()] });
  } catch (err) {
    console.error('Webhook送信エラー:', err.message);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild.members.me.permissions.has([
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.SendMessagesInThreads,
    PermissionFlagsBits.ManageMessages
  ])) {
    return interaction.editReply({
      content: 'ボットに必要な権限が不足しています！\n`スレッドの管理` `スレッド内での送信` `メッセージの管理` が必要です。',
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'setup') {
    const parentChannel = interaction.options.getChannel('parent');
    const supportRole = interaction.options.getRole('support_role');
    const description = 'Press the button to create a ticket.';

    if (parentChannel.type !== ChannelType.GuildText) {
      return interaction.editReply({ content: '親チャンネルはテキストチャンネルを選択してください。', ephemeral: true });
    }

    if (!supportRole) {
      return interaction.editReply({ content: 'サポートロールが正しく取得できませんでした。', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Ticket Panel')
      .setDescription(description)
      .setColor('#00ff00')
      .setFooter({ text: 'You can delete it yourself after 5 minutes have passed since creation.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_${supportRole.id}_${parentChannel.id}`)
        .setLabel('Create')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      await logToWebhook(
        interaction,
        'ticket setup',
        `親チャンネル: ${parentChannel.name} (${parentChannel.id})\n` +
        `サポートロール: ${supportRole.name} (${supportRole.id})`
      );

      await interaction.editReply({
        content: `チケットパネルを作成しました！\n` +
                 `スレッド作成先: ${parentChannel}\n` +
                 `対応スタッフ: ${supportRole}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('パネル作成エラー:', error);
      await interaction.editReply({
        content: 'パネルの送信に失敗しました。権限を確認してください。',
        ephemeral: true
      });
    }
  }
}