import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('モデレーションコマンド')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('ban')
      .setDescription('ユーザーをIDまたは選択でBANします')
      .addStringOption(option => option.setName('user').setDescription('ユーザーIDまたは選択').setRequired(true))
      .addBooleanOption(option => option.setName('delete-messages').setDescription('メッセージを削除しますか？').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('softban')
      .setDescription('ユーザーをBANして即座に解除')
      .addStringOption(option => option.setName('user').setDescription('ユーザーIDまたは選択').setRequired(true))
      .addBooleanOption(option => option.setName('delete-messages').setDescription('メッセージを削除しますか？').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unban')
      .setDescription('ユーザーのBANを解除します')
      .addStringOption(option => option.setName('user').setDescription('ユーザーIDまたは選択').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('kick')
      .setDescription('ユーザーをキックします')
      .addUserOption(option => option.setName('user').setDescription('キックするユーザー').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('timeout')
      .setDescription('ユーザーを指定時間タイムアウトします')
      .addUserOption(option => option.setName('user').setDescription('タイムアウトするユーザー').setRequired(true))
      .addIntegerOption(option => option.setName('duration').setDescription('タイムアウト時間（分）').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('untimeout')
      .setDescription('ユーザーのタイムアウトを解除します')
      .addUserOption(option => option.setName('user').setDescription('タイムアウトを解除するユーザー').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('message-clear')
      .setDescription('チャンネルのメッセージを削除します')
      .addIntegerOption(option => option.setName('amount').setDescription('削除するメッセージ数').setRequired(true))
      .addStringOption(option => option.setName('regex').setDescription('メッセージをマッチする正規表現').setRequired(false))
      .addUserOption(option => option.setName('user').setDescription('このユーザーのメッセージを削除').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('slowmode')
      .setDescription('チャンネルのスローモードを設定します')
      .addIntegerOption(option => option.setName('seconds').setDescription('スローモードの秒数').setRequired(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lock')
      .setDescription('チャンネルを全ロールに対してロックします')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unlock')
      .setDescription('チャンネルのロックを解除します')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setnick')
      .setDescription('ユーザーのニックネームを設定します')
      .addUserOption(option => option.setName('user').setDescription('ニックネームを設定するユーザー').setRequired(true))
      .addStringOption(option => option.setName('nickname').setDescription('新しいニックネーム').setRequired(false))
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const user = interaction.user;

  const logEmbed = new EmbedBuilder()
    .setTitle('モデレーションアクション')
    .setTimestamp()
    .addFields(
      { name: 'サーバー', value: guild.name, inline: true },
      { name: 'モデレーター', value: user.tag, inline: true },
      { name: 'アクション', value: subcommand, inline: true }
    );

  try {
    switch (subcommand) {
      case 'ban': {
        const userId = interaction.options.getString('user');
        const deleteMessages = interaction.options.getBoolean('delete-messages') || false;
        const days = deleteMessages ? 7 : 0;
        await guild.members.ban(userId, { days });
        logEmbed.addFields({ name: '対象', value: userId, inline: true });
        await interaction.editReply(`ユーザー ${userId} をBANしました`);
        break;
      }
      case 'softban': {
        const userId = interaction.options.getString('user');
        const deleteMessages = interaction.options.getBoolean('delete-messages') || false;
        const days = deleteMessages ? 7 : 0;
        await guild.members.ban(userId, { days });
        await guild.members.unban(userId);
        logEmbed.addFields({ name: '対象', value: userId, inline: true });
        await interaction.editReply(`ユーザー ${userId} をソフトBANしました`);
        break;
      }
      case 'unban': {
        const userId = interaction.options.getString('user');
        await guild.members.unban(userId);
        logEmbed.addFields({ name: '対象', value: userId, inline: true });
        await interaction.editReply(`ユーザー ${userId} のBANを解除しました`);
        break;
      }
      case 'kick': {
        const target = interaction.options.getUser('user');
        const member = await guild.members.fetch(target.id);
        await member.kick();
        logEmbed.addFields({ name: '対象', value: target.tag, inline: true });
        await interaction.editReply(`${target.tag} をキックしました`);
        break;
      }
      case 'timeout': {
        const target = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const member = await guild.members.fetch(target.id);
        await member.timeout(duration * 60 * 1000);
        logEmbed.addFields(
          { name: '対象', value: target.tag, inline: true },
          { name: '時間', value: `${duration}分`, inline: true }
        );
        await interaction.editReply(`${target.tag} を${duration}分間タイムアウトしました`);
        break;
      }
      case 'untimeout': {
        const target = interaction.options.getUser('user');
        const member = await guild.members.fetch(target.id);
        await member.timeout(null);
        logEmbed.addFields({ name: '対象', value: target.tag, inline: true });
        await interaction.editReply(`${target.tag} のタイムアウトを解除しました`);
        break;
      }
      case 'message-clear': {
        const amount = interaction.options.getInteger('amount');
        const regex = interaction.options.getString('regex');
        const targetUser = interaction.options.getUser('user');
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        let filteredMessages = messages;
        if (targetUser) {
          filteredMessages = messages.filter(msg => msg.author.id === targetUser.id);
        }
        if (regex) {
          const regexPattern = new RegExp(regex);
          filteredMessages = filteredMessages.filter(msg => regexPattern.test(msg.content));
        }
        await interaction.channel.bulkDelete(filteredMessages, true);
        logEmbed.addFields({ name: '削除したメッセージ数', value: `${filteredMessages.size}`, inline: true });
        await interaction.editReply(`${filteredMessages.size}件のメッセージを削除しました`);
        break;
      }
      case 'slowmode': {
        const seconds = interaction.options.getInteger('seconds');
        await interaction.channel.setRateLimitPerUser(seconds);
        logEmbed.addFields({ name: 'スローモード', value: `${seconds}秒`, inline: true });
        await interaction.editReply(`スローモードを${seconds}秒に設定しました`);
        break;
      }
      case 'lock': {
        const everyone = guild.roles.everyone;
        await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: false });
        logEmbed.addFields({ name: 'チャンネルロック', value: interaction.channel.name, inline: true });
        await interaction.editReply(`チャンネル ${interaction.channel.name} をロックしました`);
        break;
      }
      case 'unlock': {
        const everyone = guild.roles.everyone;
        await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: true });
        logEmbed.addFields({ name: 'チャンネルアンロック', value: interaction.channel.name, inline: true });
        await interaction.editReply(`チャンネル ${interaction.channel.name} のロックを解除しました`);
        break;
      }
      case 'setnick': {
        const target = interaction.options.getUser('user');
        const nickname = interaction.options.getString('nickname') || null;
        const member = await guild.members.fetch(target.id);
        await member.setNickname(nickname);
        logEmbed.addFields(
          { name: '対象', value: target.tag, inline: true },
          { name: 'ニックネーム', value: nickname || 'リセット', inline: true }
        );
        await interaction.editReply(`${target.tag} のニックネームを ${nickname || 'デフォルト'} に設定しました`);
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