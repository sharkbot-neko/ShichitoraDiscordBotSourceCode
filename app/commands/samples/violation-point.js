import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  InteractionContextType,
  ApplicationIntegrationType
} from 'discord.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('violation-point')
  .setDescription('違反ポイントの設定を行います')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function logToWebhook(interaction, details) {
  if (!webhookUrl) {
    console.error('Developer log webhook URL not configured.');
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle(`Violation Point Change in ${interaction.guild.name}`)
    .setDescription(
      `**Server**: ${interaction.guild.name} (${interaction.guildId})\n` +
      `**User**: ${interaction.user.tag} (${interaction.user.id})\n` +
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

async function loadSettings(guildId) {
  const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
  let settings;
  try {
    await mkdir(path.dirname(settingsPath), { recursive: true });
    try {
      const data = await readFile(settingsPath);
      settings = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
      settings = {
        antiTroll: { enabled: false, rules: {} },
        antiSpam: { enabled: false, messageLimit: 5, timeframe: 5000 },
        antiRaid: { enabled: false, timeframe: 5000 },
        antiDuplicate: { enabled: false, similarity: 0.85, timeframe: 10000 },
        antiReactionSpam: { enabled: false, reactionLimit: 5, timeframe: 5000 },
        antiThreadSpam: { enabled: false, threadLimit: 2, timeframe: 5000 },
        antiEventCreateSpam: { enabled: false, eventLimit: 2, timeframe: 5000 },
        antiEventUpdateSpam: { enabled: false, eventLimit: 3, timeframe: 5000 },
        antiEventDeleteSpam: { enabled: false, eventLimit: 2, timeframe: 5000 },
        antiInviteCreateSpam: { enabled: false, inviteLimit: 2, timeframe: 5000 },
        antiChannelCreateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiChannelUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiChannelDeleteSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiRoleCreateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiRoleUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiRoleDeleteSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiWebhookCreateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiWebhookUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiWebhookDeleteSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiBanAddSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiKickSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiTimeoutSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiEmojiCreateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiEmojiUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiEmojiDeleteSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiStickerCreateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiStickerUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiStickerDeleteSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiSoundboardCreateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiSoundboardUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiSoundboardDeleteSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiAutoModRuleUpdateSpam: { enabled: false, nukeLimit: 10, timeframe: 60000 },
        antiAutoModRuleDeleteSpam: { enabled: false, nukeLimit: 5, timeframe: 60000 },
        antiMessageUpdateSpam: { enabled: false, messageLimit: 7, timeframe: 10000 },
        antiMentionSpam: { enabled: false, mentionLimit: 5, timeframe: 5000 },
        antiLongMessage: { enabled: false, messageLimit: 500 },
        antiTooManyLine: { enabled: false, lineLimit: 5, timeframe: 5000 },
        antiCharacterRepeats: { enabled: false, repeatLimit: 5, timeframe: 5000 },
        antiSpecificCharSpam: { enabled: false, targets: [] },
        antiTooManyImages: { enabled: false, imageLimit: 3, timeframe: 5000 },
        antiTooEmoji: { enabled: false, emojiLimit: 10 },
        antiTooLink: { enabled: false, linkLimit: 10 },
        antiTooEmbed: { enabled: false, embedLimit: 8 },
        antiMarkdownSpam: { enabled: false, ratio: 0.3 },
        antiSoundboardSpam: { enabled: false, soundLimit: 5, timeframe: 5000 },
        antiJoinRaid: { enabled: false, joinLimit: 15, timeframe: 10000 },
        antiVoiceChatJoinRaid: { enabled: false, memberLimit: 15, timeframe: 10000 },
        logWebhook: null,
        modLogWebhook: null,
        whitelist: { channels: [], categories: [], roles: [], members: [] },
        ruleWhitelist: {},
        block: { enabled: true, timeout: 600000 },
        points: { thresholds: { '5': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' } },
        muteRoleId: null,
        notBot: { enabled: false },
        notAdmin: { enabled: false },
      };
      await writeFile(settingsPath, JSON.stringify(settings, null, 2));
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error(`Error initializing settings for guild ${guildId}:`, err);
    throw err;
  }
  return { settings, settingsPath };
}

async function saveSettings(settingsPath, settings) {
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

const ruleCategories = {
  link: [
    { name: '招待リンク/Invite Link', value: 'invite_link' },
    { name: '特殊文字リンク/Special Word Link', value: 'special_word_link' },
    { name: 'リダイレクトリンク/Redirect Link', value: 'redirect_link' },
    { name: '改行リンク/Line Link', value: 'line_link' },
    { name: 'エンコードリンク/Encode Link', value: 'encode_link' },
    { name: '短縮リンク/Short Link', value: 'short_link' },
    { name: 'テンプレリンク/Template Link', value: 'template_link' },
    { name: 'ボットの招待/Bot Invite Link', value: 'bot_invite_link' },
    { name: '危険なサイト/DangerSiteLink', value: 'danger_site' },
    { name: 'コマンドリンク/Command Link', value: 'command_link' },
    { name: '合字リンク/Ligature Link', value: 'ligature_link' },
    { name: 'マークダウンリンクスパム/Markdown Link Spam', value: 'markdown' },
    { name: 'Steamスパム/Steam Spam', value: 'steam' },
    { name: '画像サイト/Image Site', value: 'image_site' },
    { name: 'Kairun招待リンク/KaiRun Invite Link', value: 'kairun_invite' },
  ],
  other: [
    { name: '超特殊文字/Super Special Character', value: 'super_special_character' },
    { name: '空白スパム/Blank Only', value: 'blank_only' },
    { name: 'トークン/Token', value: 'token' },
    { name: '全体系メンション/EveryoneAndHereMention', value: 'mention' },
    { name: 'スポイラースパム/Spoiler Spam', value: 'spoiler_spam' },
    { name: '画像スパム/Image Spam', value: 'image_spam' },
    { name: 'メールアドレス/Mail Address', value: 'mail' },
    { name: 'UUID/Universally Unique Identifier', value: 'uuid' },
    { name: '文字装飾/Zalgo', value: 'zalgo' },
    { name: 'クラッシュGIF/Clash GIF', value: 'clash_gif' },
    { name: 'フラッシュGIF・動画/Flash GIF or Video', value: 'flash_gif' },
    { name: '成人向け性的コンテンツ/Nsfw Content', value: 'nsfw_content' },
    { name: '成人向け暴力的コンテンツ/Gore Content', value: 'gore_content' },
  ],
  special: [
    { name: 'スパム/Spam', value: 'spam' },
    { name: 'レイド/Raid', value: 'raid' },
    { name: '重複メッセージ/Duplicate', value: 'duplicate' },
    { name: 'リアクションスパム/Reaction Spam', value: 'reaction_spam' },
    { name: 'スレッドスパム/Thread Spam', value: 'thread_limit' },
    { name: 'イベント作成スパム/Event Create Spam', value: 'event_create' },
    { name: 'イベント更新スパム/Event Update Spam', value: 'event_update' },
    { name: 'イベント削除スパム/Event Delete Spam', value: 'event_delete' },
    { name: '招待リンク作成スパム/Invite Create Spam', value: 'invite_create_spam' },
    { name: 'メンションスパム/Mention Spam', value: 'mention_spam' },
    { name: '長文制限/Anti Long Message', value: 'long_message' },
    { name: '改行制限/Too Many Lines', value: 'too_many_line' },
    { name: '同じ文字のリピート/Character Repeats', value: 'character_repeats' },
    { name: '特定文字スパム/Specific Char Spam', value: 'specific_char_spam' },
    { name: '画像数制限/Too Many Images', value: 'too_many_images' },
    { name: '絵文字数制限/Too Many Emoji', value: 'too_emoji' },
    { name: 'リンク数制限/Too Many Link', value: 'too_link' },
    { name: '埋め込み数制限/Too Many Embed', value: 'too_embed' },
    { name: 'Markdown装飾スパム/Markdown Spam', value: 'markdown_spam' },
    { name: 'サウンドボードスパム/SoundBoard Spam', value: 'soundboard_spam' },
    { name: 'メッセージ更新制限/Message Update Limit', value: 'message_update' },
    { name: 'サーバー参加レイド対策/Anti Server Join Raid', value: 'member_join' },
    { name: 'VC参加レイド対策/Anti VC Join Raid', value: 'vc_raid' },
  ],
  nuke: [
    { name: 'ニューク(チャンネル作成)/Nuke(Channel Create)', value: 'channel_create' },
    { name: 'ニューク(チャンネル更新)/Nuke(Channel Update)', value: 'channel_update' },
    { name: 'ニューク(チャンネル削除)/Nuke(Channel Delete)', value: 'channel_delete' },
    { name: 'ニューク(ロール作成)/Nuke(Role Create)', value: 'role_create' },
    { name: 'ニューク(ロール更新)/Nuke(Role Update)', value: 'role_update' },
    { name: 'ニューク(ロール削除)/Nuke(Role Delete)', value: 'role_delete' },
    { name: 'ニューク(ウェブフック作成)/Nuke(Webhook Create)', value: 'webhook_create' },
    { name: 'ニューク(ウェブフック更新)/Nuke(Webhook Update)', value: 'webhook_update' },
    { name: 'ニューク(ウェブフック削除)/Nuke(Webhook Delete)', value: 'webhook_delete' },
    { name: 'ニューク(メンバーBAN)/Nuke(Member Ban)', value: 'member_ban_add' },
    { name: 'ニューク(メンバーKick)/Nuke(Member Kick)', value: 'member_kick' },
    { name: 'ニューク(メンバーTimeOut)/Nuke(Member TimeOut)', value: 'member_timeout' },
    { name: 'ニューク(絵文字作成)/Nuke(Emoji Create)', value: 'emoji_create' },
    { name: 'ニューク(絵文字更新)/Nuke(Emoji Update)', value: 'emoji_update' },
    { name: 'ニューク(絵文字削除)/Nuke(Emoji Delete)', value: 'emoji_delete' },
    { name: 'ニューク(ステッカー作成)/Nuke(Sticker Create)', value: 'sticker_create' },
    { name: 'ニューク(ステッカー更新)/Nuke(Sticker Update)', value: 'sticker_update' },
    { name: 'ニューク(ステッカー削除)/Nuke(Sticker Delete)', value: 'sticker_delete' },
    { name: 'ニューク(サウンドボード作成)/Nuke(Soundboard Create)', value: 'soundboard_create' },
    { name: 'ニューク(サウンドボード更新)/Nuke(Soundboard Update)', value: 'soundboard_update' },
    { name: 'ニューク(サウンドボード削除)/Nuke(Soundboard Delete)', value: 'soundboard_delete' },
    { name: 'ニューク(オートモッドルール更新)/Nuke(AutoMod Rule Update)', value: 'automod_update' },
    { name: 'ニューク(オートモッドルール削除)/Nuke(AutoMod Rule Delete)', value: 'automod_delete' },
  ],
  custom: [
    { name: 'カスタムルール/Custom Rule', value: 'custom' },
  ]
};

export async function execute(interaction) {
  if (!interaction.guild.members.me.permissions.has(['SendMessages', 'ManageRoles', 'ManageChannels', 'ModerateMembers'])) {
    await interaction.reply({
      content: 'ボットに必要な権限（メッセージ送信、ロール管理、チャンネル管理、メンバー管理）がありません！',
      ephemeral: true,
    });
    return;
  }

  const { settings, settingsPath } = await loadSettings(interaction.guildId);

  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('point_rule_category')
    .setPlaceholder('ルールカテゴリーを選択')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('メッセージ関係ルール - 1').setValue('link'),
      new StringSelectMenuOptionBuilder().setLabel('メッセージ関係ルール - 2').setValue('other'),
      new StringSelectMenuOptionBuilder().setLabel('特殊なルール').setValue('special'),
      new StringSelectMenuOptionBuilder().setLabel('ニューク系ルール').setValue('nuke'),
      new StringSelectMenuOptionBuilder().setLabel('カスタムルール').setValue('custom')
    );

  const row1 = new ActionRowBuilder().addComponents(categorySelect);

  await interaction.reply({
    content: '違反ポイントを設定するルールカテゴリーを選択してください。',
    components: [row1],
    ephemeral: true,
  });

  const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('point_');
  let ruleCategory, rule, points;

  try {
    const categoryInteraction = await interaction.channel.awaitMessageComponent({
      filter,
      time: 300000,
    });

    if (categoryInteraction.customId === 'point_rule_category') {
      ruleCategory = categoryInteraction.values[0];
      await categoryInteraction.update({ components: [], ephemeral: true });
    } else {
      await interaction.editReply({ content: '無効な選択です。', components: [], ephemeral: true });
      return;
    }
  } catch (err) {
    await interaction.editReply({ content: '60秒以内に選択されなかったため、キャンセルしました。', components: [], ephemeral: true });
    return;
  }

  const ruleSelect = new StringSelectMenuBuilder()
    .setCustomId('point_rule_select')
    .setPlaceholder('ルールを選択')
    .addOptions(ruleCategories[ruleCategory].map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.value)));

  const row2 = new ActionRowBuilder().addComponents(ruleSelect);

  await interaction.editReply({
    content: 'ポイントを設定するルールを選択してください。',
    components: [row2],
    ephemeral: true,
  });

  try {
    const ruleInteraction = await interaction.channel.awaitMessageComponent({
      filter,
      time: 300000,
    });

    if (ruleInteraction.customId === 'point_rule_select') {
      rule = ruleInteraction.values[0];
      await ruleInteraction.update({ components: [], ephemeral: true });
    } else {
      await interaction.editReply({ content: '無効な選択です。', components: [], ephemeral: true });
      return;
    }
  } catch (err) {
    await interaction.editReply({ content: '5分以内に選択されなかったため、キャンセルしました。', components: [], ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('point_modal')
    .setTitle('違反ポイントの設定')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('points_input')
          .setLabel('割り当てるポイント（1以上）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('例: 5')
          .setRequired(true)
      )
    );

  const inputButton = new ButtonBuilder()
    .setCustomId('point_input_button')
    .setLabel('ポイントを入力')
    .setStyle(ButtonStyle.Primary);

  const row3 = new ActionRowBuilder().addComponents(inputButton);

  await interaction.editReply({
    content: `ルール: **${ruleCategories[ruleCategory].find(r => r.value === rule)?.name || rule}**\nポイントを入力してください。`,
    components: [row3],
    ephemeral: true,
  });

  try {
    const buttonInteraction = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && i.customId === 'point_input_button',
      time: 300000,
    });

    await buttonInteraction.showModal(modal);

    const modalInteraction = await buttonInteraction.awaitModalSubmit({
      filter: i => i.user.id === interaction.user.id && i.customId === 'point_modal',
      time: 300000,
    });

    const input = modalInteraction.fields.getTextInputValue('points_input');
    points = parseInt(input, 10);

    if (isNaN(points) || points < 1) {
      await modalInteraction.reply({ content: 'ポイントは1以上の整数を入力してください。', ephemeral: true });
      return;
    }

    settings.points[rule] = points;
    await saveSettings(settingsPath, settings);
    await logToWebhook(interaction, `Set ${points} points for rule ${rule}`);

    const ruleName = ruleCategories[ruleCategory].find(r => r.value === rule)?.name || rule;
    await modalInteraction.reply({
      content: `**${ruleName}** に **${points} ポイント** を設定しました。`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.followUp({
      content: '5分以内にポイントが入力されなかったため、キャンセルしました。',
      ephemeral: true,
    });
  }
}
