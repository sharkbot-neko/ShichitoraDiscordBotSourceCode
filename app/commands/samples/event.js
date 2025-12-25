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
  .setName('event')
  .setDescription('イベント管理およびその他のコマンド')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
    .setName('create-event')
    .setDescription('新しいイベントを作成します')
    .addStringOption(option => option.setName('name').setDescription('イベント名').setRequired(true))
    .addStringOption(option => option.setName('start').setDescription('開始時間（ISO形式）').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('イベント説明').setRequired(false))
    .addStringOption(option => option.setName('end').setDescription('終了時間（ISO形式）').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('delete-event')
    .setDescription('イベントをIDで削除します')
    .addStringOption(option => option.setName('event-id').setDescription('イベントID').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('edit-event')
    .setDescription('イベントを編集します')
    .addStringOption(option => option.setName('event-id').setDescription('イベントID').setRequired(true))
    .addStringOption(option => option.setName('name').setDescription('新しいイベント名').setRequired(false))
    .addStringOption(option => option.setName('description').setDescription('新しい説明').setRequired(false))
    .addStringOption(option => option.setName('start').setDescription('新しい開始時間（ISO形式）').setRequired(false))
    .addStringOption(option => option.setName('end').setDescription('新しい終了時間（ISO形式）').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('create-emoji')
    .setDescription('絵文字を作成します')
    .addStringOption(option => option.setName('name').setDescription('絵文字名').setRequired(true))
    .addStringOption(option => option.setName('image').setDescription('画像URL').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('delete-emoji')
    .setDescription('絵文字をIDで削除します')
    .addStringOption(option => option.setName('emoji-id').setDescription('絵文字ID').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('create-automod-rule')
    .setDescription('AutoModルールを作成します')
    .addStringOption(option => option.setName('name').setDescription('ルール名').setRequired(true))
    .addStringOption(option => option.setName('regex').setDescription('正規表現パターン').setRequired(false))
    .addStringOption(option => option.setName('keywords').setDescription('キーワード（カンマ区切り）').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('delete-automod-rule')
    .setDescription('AutoModルールをIDで削除します')
    .addStringOption(option => option.setName('rule-id').setDescription('AutoModルールID').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('delete-invite')
    .setDescription('招待リンクを削除します')
    .addStringOption(option => option.setName('invite-code').setDescription('招待コード').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('create-webhook')
    .setDescription('Webhookを作成します')
    .addStringOption(option => option.setName('name').setDescription('Webhook名').setRequired(false))
    .addStringOption(option => option.setName('avatar').setDescription('WebhookアバターURL').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
    .setName('delete-webhook')
    .setDescription('WebhookをIDまたはURLで削除します')
    .addStringOption(option => option.setName('webhook').setDescription('Webhook IDまたはURL').setRequired(true))
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const user = interaction.user;

  await interaction.deferReply({
    ephemeral: true
  });

  const logEmbed = new EmbedBuilder()
    .setTitle('イベント管理アクション')
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
      case 'create-event': {
        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description') || '';
        const startTime = new Date(interaction.options.getString('start'));
        const endTime = interaction.options.getString('end') ? new Date(interaction.options.getString('end')) : null;
        const event = await guild.scheduledEvents.create({
          name,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          privacyLevel: 'GUILD_ONLY',
          entityType: 'EXTERNAL',
          description,
          entityMetadata: {
            location: 'TBD'
          }
        });
        logEmbed.addFields({
          name: '作成したイベント',
          value: name,
          inline: true
        });
        await interaction.editReply(`イベント ${name} を作成しました`);
        break;
      }
      case 'delete-event': {
        const eventId = interaction.options.getString('event-id');
        const event = await guild.scheduledEvents.fetch(eventId);
        await event.delete();
        logEmbed.addFields({
          name: '削除したイベント',
          value: eventId,
          inline: true
        });
        await interaction.editReply(`イベント ${eventId} を削除しました`);
        break;
      }
      case 'edit-event': {
        const eventId = interaction.options.getString('event-id');
        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description');
        const startTime = interaction.options.getString('start') ? new Date(interaction.options.getString('start')) : null;
        const endTime = interaction.options.getString('end') ? new Date(interaction.options.getString('end')) : null;
        const event = await guild.scheduledEvents.fetch(eventId);
        await event.edit({
          name,
          description,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime
        });
        logEmbed.addFields({
          name: '編集したイベント',
          value: eventId,
          inline: true
        });
        await interaction.editReply(`イベント ${eventId} を編集しました`);
        break;
      }
      case 'create-emoji': {
        const name = interaction.options.getString('name');
        const image = interaction.options.getString('image');
        const emoji = await guild.emojis.create({
          name,
          attachment: image
        });
        logEmbed.addFields({
          name: '作成した絵文字',
          value: name,
          inline: true
        });
        await interaction.editReply(`絵文字 ${name} を作成しました`);
        break;
      }
      case 'delete-emoji': {
        const emojiId = interaction.options.getString('emoji-id');
        const emoji = guild.emojis.cache.get(emojiId);
        await emoji.delete();
        logEmbed.addFields({
          name: '削除した絵文字',
          value: emojiId,
          inline: true
        });
        await interaction.editReply(`絵文字 ${emojiId} を削除しました`);
        break;
      }
      case 'create-automod-rule': {
        const name = interaction.options.getString('name');
        const regex = interaction.options.getString('regex');
        const keywords = interaction.options.getString('keywords') ? .split(',').map(k => k.trim()) || [];
        const rule = await guild.autoModerationRules.create({
          name,
          eventType: 1,
          triggerType: 1,
          triggerMetadata: {
            regexPatterns: regex ? [regex] : [],
            keywordFilter: keywords
          },
          actions: [{
            type: 1
          }]
        });
        logEmbed.addFields({
          name: '作成したAutoModルール',
          value: name,
          inline: true
        });
        await interaction.editReply(`AutoModルール ${name} を作成しました`);
        break;
      }
      case 'delete-automod-rule': {
        const ruleId = interaction.options.getString('rule-id');
        const rule = await guild.autoModerationRules.fetch(ruleId);
        await rule.delete();
        logEmbed.addFields({
          name: '削除したAutoModルール',
          value: ruleId,
          inline: true
        });
        await interaction.editReply(`AutoModルール ${ruleId} を削除しました`);
        break;
      }
      case 'delete-invite': {
        const inviteCode = interaction.options.getString('invite-code');
        const invite = await guild.invites.fetch(inviteCode);
        await invite.delete();
        logEmbed.addFields({
          name: '削除した招待',
          value: inviteCode,
          inline: true
        });
        await interaction.editReply(`招待 ${inviteCode} を削除しました`);
        break;
      }
      case 'create-webhook': {
        const name = interaction.options.getString('name') || 'Webhook';
        const avatar = interaction.options.getString('avatar');
        const webhook = await interaction.channel.createWebhook({
          name,
          avatar
        });
        logEmbed.addFields({
          name: '作成したWebhook',
          value: name,
          inline: true
        });
        await interaction.editReply(`Webhook ${name} を作成しました`);
        break;
      }
      case 'delete-webhook': {
        const webhookId = interaction.options.getString('webhook');
        const webhook = await guild.fetchWebhook(webhookId).catch(() => null);
        if (webhook) {
          await webhook.delete();
          logEmbed.addFields({
            name: '削除したWebhook',
            value: webhookId,
            inline: true
          });
          await interaction.editReply(`Webhook ${webhookId} を削除しました`);
        } else {
          await interaction.editReply('Webhookが見つかりませんでした');
        }
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
