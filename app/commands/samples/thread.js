import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('thread')
  .setDescription('スレッド管理コマンド')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('新しいスレッドを作成')
      .addStringOption(option =>
        option.setName('name').setDescription('スレッド名').setRequired(true)
      )
      .addStringOption(option =>
        option.setName('message').setDescription('スレッドの最初のメッセージ').setRequired(false)
      )
      .addStringOption(option =>
        option.setName('channel_id').setDescription('スレッドを作成するチャンネルID（指定しない場合は現在のチャンネル）').setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName('private').setDescription('非公開スレッドにするか（テキストチャンネルのみ）').setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('指定したスレッドを削除')
      .addStringOption(option =>
        option.setName('thread_id').setDescription('スレッドID').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('all-delete').setDescription('チャンネルの全スレッドを削除')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('search')
      .setDescription('サーバー内のスレッドを検索')
      .addStringOption(option =>
        option.setName('query').setDescription('検索キーワード').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('invite')
      .setDescription('プライベートスレッドにユーザー/ロールを招待')
      .addStringOption(option =>
        option.setName('target').setDescription('ユーザー/ロールのID').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('lock').setDescription('スレッドをロック').addStringOption(option =>
      option.setName('thread_id').setDescription('スレッドID').setRequired(true)
    )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('unlock').setDescription('スレッドをアンロック').addStringOption(option =>
      option.setName('thread_id').setDescription('スレッドID').setRequired(true)
    )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads);

export async function execute(interaction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  const embed = new EmbedBuilder().setColor('#0099ff');

  try {
    switch (subcommand) {
      case 'create': {
        const name = interaction.options.getString('name');
        const message = interaction.options.getString('message') ?? 'スレッドが作成されました！';
        const channelId = interaction.options.getString('channel_id');
        const isPrivate = interaction.options.getBoolean('private') ?? false;

        // チャンネルを取得（指定がない場合は現在のチャンネル）
        let targetChannel = interaction.channel;
        if (channelId) {
          targetChannel = await interaction.guild.channels.fetch(channelId);
          if (!targetChannel) {
            throw new Error('指定されたチャンネルが見つかりません。');
          }
        }

        // チャンネルがスレッド対応かチェック
        const isForum = targetChannel.type === ChannelType.GuildForum;
        const isText = targetChannel.isTextBased() && !targetChannel.isThread();

        if (!isForum && !isText) {
          throw new Error('このチャンネルではスレッドを作成できません。');
        }

        let thread;
        if (isForum) {
          // フォーラムチャンネル用のスレッド作成
          thread = await targetChannel.threads.create({
            name,
            message: { content: message },
            autoArchiveDuration: 1440,
          });
        } else {
          // テキストチャンネル用のスレッド作成
          const parentChannel = targetChannel.isThread() ? targetChannel.parent : targetChannel;
          thread = await parentChannel.threads.create({
            name,
            message: { content: message },
            autoArchiveDuration: 1440,
            type: isPrivate ? ChannelType.GuildPrivateThread : ChannelType.GuildPublicThread,
          });
        }

        embed
          .setTitle('スレッド作成')
          .setDescription(`スレッド **${name}** を作成しました！\nチャンネル: ${targetChannel}`);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'delete': {
        const threadId = interaction.options.getString('thread_id');
        const thread = await interaction.guild.channels.fetch(threadId);

        if (!thread?.isThread()) {
          throw new Error('指定されたIDはスレッドではありません。');
        }

        await thread.delete();
        embed
          .setTitle('スレッド削除')
          .setDescription(`スレッド **${thread.name}** を削除しました。`);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'all-delete': {
        const channel = interaction.channel.isThread()
          ? interaction.channel.parent
          : interaction.channel;

        const threads = await channel.threads.fetchActive();
        const deletions = threads.threads.map(thread => thread.delete());

        await Promise.all(deletions);
        embed
          .setTitle('全スレッド削除')
          .setDescription(`${channel.name} の全スレッドを削除しました。`);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'search': {
        const query = interaction.options.getString('query').toLowerCase();
        const threads = interaction.guild.channels.cache
          .filter(ch => ch.isThread())
          .filter(ch => ch.name.toLowerCase().includes(query));

        if (threads.size === 0) {
          throw new Error('該当するスレッドが見つかりませんでした。');
        }

        embed
          .setTitle('スレッド検索結果')
          .setDescription(
            threads.map(thread => `- ${thread.name} (${thread.id})`).join('\n')
          );
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'invite': {
        const targetId = interaction.options.getString('target');
        const thread = interaction.channel.isThread()
          ? interaction.channel
          : await interaction.guild.channels.fetch(targetId);

        if (!thread?.isThread() || !thread.isPrivate()) {
          throw new Error('プライベートスレッドを指定してください。');
        }

        const target = await interaction.guild.members
          .fetch(targetId)
          .catch(() => interaction.guild.roles.fetch(targetId));

        if (!target) {
          throw new Error('有効なユーザーまたはロールを指定してください。');
        }

        await thread.members.add(targetId);
        embed
          .setTitle('スレッド招待')
          .setDescription(`${target} をスレッド **${thread.name}** に招待しました。`);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'lock': {
        const threadId = interaction.options.getString('thread_id');
        const thread = await interaction.guild.channels.fetch(threadId);

        if (!thread?.isThread()) {
          throw new Error('指定されたIDはスレッドではありません。');
        }

        await thread.setLocked(true);
        embed
          .setTitle('スレッドロック')
          .setDescription(`スレッド **${thread.name}** をロックしました。`);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'unlock': {
        const threadId = interaction.options.getString('thread_id');
        const thread = await interaction.guild.channels.fetch(threadId);

        if (!thread?.isThread()) {
          throw new Error('指定されたIDはスレッドではありません。');
        }

        await thread.setLocked(false);
        embed
          .setTitle('スレッドアンロック')
          .setDescription(`スレッド **${thread.name}** をアンロックしました。`);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (error) {
    embed
      .setColor('#ff0000')
      .setTitle('エラー')
      .setDescription(error.message);
    await interaction.editReply({ embeds: [embed] });
  }
}