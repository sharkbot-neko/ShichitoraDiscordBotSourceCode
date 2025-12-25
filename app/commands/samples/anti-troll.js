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
  ApplicationIntegrationType,
  InteractionContextType
} from 'discord.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('anti-troll')
  .setDescription('ボットの荒らし対策の設定を行います')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

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
    { name: '全体系メンション/Everyone Mention', value: 'mention' },
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
    { name: 'ニューク(メンバーBAN)/Nuke(Member Ban) ', value: 'member_ban_add' },
    { name: 'ニューク(メンバーKick)/Nuke(Member Kick) ', value: 'member_kick' },
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
  ],
};

const ruleKeyMap = {
  spam: 'antiSpam',
  duplicate: 'antiDuplicate',
  raid: 'antiRaid',
  reaction_spam: 'antiReactionSpam',
  thread_limit: 'antiThreadSpam',
  event_create: 'antiEventCreateSpam',
  event_update: 'antiEventUpdateSpam',
  event_delete: 'antiEventDeleteSpam',
  invite_create_spam: 'antiInviteCreateSpam',
  mention_spam: 'antiMentionSpam',
  too_many_line: 'antiTooManyLine',
  character_repeats: 'antiCharacterRepeats',
  specific_char_spam: 'antiSpecificCharSpam',
  long_message: 'antiLongMessage',
  too_many_images: 'antiTooManyImages',
  too_emoji: 'antiTooEmoji',
  too_link: 'antiTooLink',
  too_embed: 'antiTooEmbed',
  markdown_spam: 'antiMarkdownSpam',
  soundboard_spam: 'antiSoundboardSpam',
  message_update: 'antiMessageUpdateSpam',
  member_join: 'antiJoinRaid',
  vc_raid: 'antiVoiceChatJoinRaid',
  channel_create: 'antiChannelCreateSpam',
  channel_update: 'antiChannelUpdateSpam',
  channel_delete: 'antiChannelDeleteSpam',
  role_create: 'antiRoleCreateSpam',
  role_update: 'antiRoleUpdateSpam',
  role_delete: 'antiRoleDeleteSpam',
  webhook_create: 'antiWebhookCreateSpam',
  webhook_update: 'antiWebhookUpdateSpam',
  webhook_delete: 'antiWebhookDeleteSpam',
  member_ban_add: 'antiBanAddSpam',
  member_kick: 'antiKickSpam',
  member_timeout: 'antiTimeoutSpam',
  emoji_create: 'antiEmojiCreateSpam',
  emoji_update: 'antiEmojiUpdateSpam',
  emoji_delete: 'antiEmojiDeleteSpam',
  sticker_create: 'antiStickerCreateSpam',
  sticker_update: 'antiStickerUpdateSpam',
  sticker_delete: 'antiStickerDeleteSpam',
  soundboard_create: 'antiSoundboardCreateSpam',
  soundboard_update: 'antiSoundboardUpdateSpam',
  soundboard_delete: 'antiSoundboardDeleteSpam',
  automod_update: 'antiAutoModRuleUpdateSpam',
  automod_delete: 'antiAutoModRuleDeleteSpam'
};

async function logToWebhook(interaction, details) {
  if (!webhookUrl) return;
  const embed = new EmbedBuilder()
    .setTitle('Anti-Troll設定変更')
    .setDescription(`サーバー: ${interaction.guild.name} (${interaction.guildId})\nユーザー: ${interaction.user.tag}\n詳細: ${details}`)
    .setColor('#00ff00')
    .setTimestamp();
  try {
    await axios.post(webhookUrl, { embeds: [embed.toJSON()] });
  } catch (err) {
    console.error('Webhook送信失敗:', err.message);
  }
}

async function loadSettings(guildId) {
  const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
  const customDeletePath = path.join(process.cwd(), 'custom-delete', `${guildId}.json`);
  let settings = {};
  let customSettings = { rules: {} };

  try {
    await mkdir(path.dirname(settingsPath), { recursive: true });
    const data = await readFile(settingsPath, 'utf8').catch(() => null);
    if (!data) {
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
        antiLongMessage: { enabled: false, messageLimit: 500 },
        antiMentionSpam: { enabled: false, mentionLimit: 5, timeframe: 5000 },
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
      settings = JSON.parse(data);
    }
  } catch (err) {
    console.error('settings読み込みエラー:', err);
  }

  try {
    await mkdir(path.dirname(customDeletePath), { recursive: true });
    const data = await readFile(customDeletePath, 'utf8').catch(() => null);
    if (data) {
      customSettings = JSON.parse(data);
    } else {
      await writeFile(customDeletePath, JSON.stringify({ rules: {} }, null, 2));
    }
  } catch (err) {
    console.error('custom-delete読み込みエラー:', err);
  }

  return { settings, settingsPath, customSettings, customDeletePath };
}

async function saveSettings(settingsPath, settings, customDeletePath, customSettings) {
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  await writeFile(customDeletePath, JSON.stringify(customSettings, null, 2));
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild.members.me.permissions.has(['SendMessages', 'ManageRoles', 'ManageChannels', 'ModerateMembers'])) {
    return interaction.editReply({ content: 'ボットに必要な権限がありません！', ephemeral: true });
  }

  const { settings, settingsPath, customSettings, customDeletePath } = await loadSettings(interaction.guildId);
  const filter = i => i.user.id === interaction.user.id;

  try {
    const enabledMenu = new StringSelectMenuBuilder()
      .setCustomId('enabled_select')
      .setPlaceholder('有効/無効')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('有効').setValue('true'),
        new StringSelectMenuOptionBuilder().setLabel('無効').setValue('false')
      );
    await interaction.editReply({ content: 'ルールを有効にしますか？', components: [new ActionRowBuilder().addComponents(enabledMenu)] });
    const enabledInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
    const enabled = enabledInt.values[0] === 'true';
    await enabledInt.deferUpdate();
    await interaction.editReply({ components: [] });

    const catMenu = new StringSelectMenuBuilder()
      .setCustomId('cat_select')
      .setPlaceholder('カテゴリーを選択')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('リンク系ルール').setValue('link'),
        new StringSelectMenuOptionBuilder().setLabel('その他のメッセージルール').setValue('other'),
        new StringSelectMenuOptionBuilder().setLabel('特殊・スパム系').setValue('special'),
        new StringSelectMenuOptionBuilder().setLabel('ニューク系').setValue('nuke'),
        new StringSelectMenuOptionBuilder().setLabel('カスタムルール').setValue('custom')
      );
    await interaction.editReply({ content: '設定するカテゴリーを選んでください', components: [new ActionRowBuilder().addComponents(catMenu)] });
    const catInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
    const category = catInt.values[0];
    await catInt.deferUpdate();
    await interaction.editReply({ components: [] });

    if (category === 'custom') {
      const actionMenu = new StringSelectMenuBuilder()
        .setCustomId('custom_action')
        .setPlaceholder('操作を選択')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('新しいカスタムルールを追加').setValue('add'),
          new StringSelectMenuOptionBuilder().setLabel('既存ルールの編集・削除').setValue('edit')
        );
      await interaction.editReply({ content: 'カスタムルールで何をしますか？', components: [new ActionRowBuilder().addComponents(actionMenu)] });
      const actionInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
      const action = actionInt.values[0];
      await actionInt.deferUpdate();
      await interaction.editReply({ components: [] });

      if (action === 'add') {
        const addBtn = new ButtonBuilder().setCustomId('add_custom').setLabel('カスタムルール追加').setStyle(ButtonStyle.Primary);
        await interaction.editReply({ content: '追加ボタンを押してください', components: [new ActionRowBuilder().addComponents(addBtn)] });
        const addInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
        if (addInt.customId === 'add_custom') {
          const modal = new ModalBuilder().setCustomId('custom_add_modal').setTitle('カスタムルール追加');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('ルール名（半角英数_-のみ）').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('regex').setLabel('正規表現').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('point').setLabel('付与ポイント（0〜100）').setStyle(TextInputStyle.Short).setValue('5').setRequired(false))
          );
          await addInt.showModal(modal);
          const submitted = await addInt.awaitModalSubmit({ time: 300000 });
          const name = submitted.fields.getTextInputValue('name').trim();
          const regex = submitted.fields.getTextInputValue('regex');
          const point = parseInt(submitted.fields.getTextInputValue('point')) || 5;
          if (!/^[a-zA-Z0-9_-]+$/.test(name)) return submitted.reply({ content: 'ルール名は半角英数と_-のみです', ephemeral: true });
          if (customSettings.rules[name]) return submitted.reply({ content: 'その名前は既に使われています', ephemeral: true });
          try { new RegExp(regex); } catch { return submitted.reply({ content: '無効な正規表現です', ephemeral: true }); }
          if (point < 0 || point > 100) return submitted.reply({ content: 'ポイントは0〜100にしてください', ephemeral: true });
          customSettings.rules[name] = { regex, addPoint: point, enabled };
          await saveSettings(settingsPath, settings, customDeletePath, customSettings);
          await logToWebhook(interaction, `Custom rule "${name}" added`);
          await submitted.reply({ content: `カスタムルール \`${name}\` を追加しました！`, ephemeral: true });
        }
        return;
      }

      if (action === 'edit') {
        if (Object.keys(customSettings.rules).length === 0) {
          return interaction.editReply({ content: '登録されているカスタムルールがありません', components: [] });
        }
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_custom_rule')
          .setPlaceholder('編集・削除するルール')
          .addOptions(Object.entries(customSettings.rules).map(([k, v]) => new StringSelectMenuOptionBuilder().setLabel(k).setDescription(`ポイント: ${v.addPoint}`).setValue(k)));
        await interaction.editReply({ content: '編集または削除するルールを選んでください', components: [new ActionRowBuilder().addComponents(selectMenu)] });
        const selectInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
        const ruleName = selectInt.values[0];
        await selectInt.deferUpdate();
        await interaction.editReply({ components: [] });

        const editBtn = new ButtonBuilder().setCustomId('edit_rule').setLabel('編集').setStyle(ButtonStyle.Primary);
        const delBtn = new ButtonBuilder().setCustomId('delete_rule').setLabel('削除').setStyle(ButtonStyle.Danger);
        await interaction.editReply({ content: `選択されたルール: \`${ruleName}\``, components: [new ActionRowBuilder().addComponents(editBtn, delBtn)] });

        const btnInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
        if (btnInt.customId === 'delete_rule') {
          delete customSettings.rules[ruleName];
          await saveSettings(settingsPath, settings, customDeletePath, customSettings);
          await logToWebhook(interaction, `Custom rule "${ruleName}" deleted`);
          return btnInt.update({ content: `カスタムルール \`${ruleName}\` を削除しました`, components: [] });
        }

        const current = customSettings.rules[ruleName];
        const modal = new ModalBuilder().setCustomId('edit_custom_modal').setTitle('カスタムルール編集');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('regex').setLabel('正規表現').setStyle(TextInputStyle.Paragraph).setValue(current.regex).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('point').setLabel('付与ポイント').setStyle(TextInputStyle.Short).setValue(String(current.addPoint)).setRequired(true))
        );
        await btnInt.showModal(modal);
        const editSubmit = await btnInt.awaitModalSubmit({ time: 300000 });
        const newRegex = editSubmit.fields.getTextInputValue('regex');
        const newPoint = parseInt(editSubmit.fields.getTextInputValue('point')) || 0;
        try { new RegExp(newRegex); } catch { return editSubmit.reply({ content: '無効な正規表現です', ephemeral: true }); }
        customSettings.rules[ruleName] = { regex: newRegex, addPoint: newPoint, enabled: current.enabled };
        await saveSettings(settingsPath, settings, customDeletePath, customSettings);
        await logToWebhook(interaction, `Custom rule "${ruleName}" updated`);
        await editSubmit.reply({ content: `カスタムルール \`${ruleName}\` を更新しました`, ephemeral: true });
        return;
      }
    }

    const ruleMenu = new StringSelectMenuBuilder()
      .setCustomId('rule_select')
      .setPlaceholder('ルールを選択')
      .addOptions(ruleCategories[category].map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.value)));
    await interaction.editReply({ content: '設定するルールを選んでください', components: [new ActionRowBuilder().addComponents(ruleMenu)] });
    const ruleInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
    const rule = ruleInt.values[0];
    await ruleInt.deferUpdate();
    await interaction.editReply({ components: [] });

    if (category === 'special' || category === 'nuke') {
      const antiKey = ruleKeyMap[rule];

      if (rule === 'specific_char_spam') {
        const modal = new ModalBuilder()
          .setCustomId('specific_char_modal')
          .setTitle('特定文字スパム設定');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('char1')
              .setLabel('対象文字1')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(10)
              .setPlaceholder('例: あ')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('limit1')
              .setLabel('制限数1（1〜100）')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder('例: 10')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('char2')
              .setLabel('対象文字2')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(10)
              .setPlaceholder('例: い')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('limit2')
              .setLabel('制限数2（1〜100）')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder('例: 15')
          )
        );

        const customBtn = new ButtonBuilder()
          .setCustomId('open_specific_modal')
          .setLabel('設定する')
          .setStyle(ButtonStyle.Primary);

        await interaction.editReply({
          content: `\`specific_char_spam\` の設定\n\- 文字または制限数を空欄にするとそのセットは無視されます。\n- 少なくとも1セットは両方入力してください。`,
          components: [new ActionRowBuilder().addComponents(customBtn)]
        });

        const btnInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });
        await btnInt.showModal(modal);
        const modalInt = await btnInt.awaitModalSubmit({ time: 300000 });

        const targets = [];
        let hasValidSet = false;

        for (let i = 1; i <= 2; i++) {
          const char = modalInt.fields.getTextInputValue(`char${i}`)?.trim();
          const limitStr = modalInt.fields.getTextInputValue(`limit${i}`)?.trim();

          if (char && limitStr) {
            const limit = parseInt(limitStr);
            if (!isNaN(limit) && limit >= 1 && limit <= 100) {
              targets.push({ char, limit });
              hasValidSet = true;
            }
          }
        }

        if (!hasValidSet) {
          return modalInt.reply({ content: '少なくとも1セットは「対象文字」と「制限数」の両方を入力してください。', ephemeral: true });
        }

        settings[antiKey] = { enabled, targets };
        await saveSettings(settingsPath, settings, customDeletePath, customSettings);
        await logToWebhook(interaction, `specific_char_spam 設定適用 (対象数: ${targets.length})`);
        await modalInt.reply({ content: '`specific_char_spam` を設定・有効化しました！', ephemeral: true });

      } else {
        const customBtn = new ButtonBuilder().setCustomId('open_custom_modal').setLabel('カスタマイズ設定').setStyle(ButtonStyle.Primary);
        const defaultBtn = new ButtonBuilder().setCustomId('use_default').setLabel('デフォルト設定').setStyle(ButtonStyle.Secondary);
        await interaction.editReply({ content: `ルール: \`${rule}\`\n設定方法を選んでください`, components: [new ActionRowBuilder().addComponents(customBtn, defaultBtn)] });

        const btnInt = await interaction.channel.awaitMessageComponent({ filter, time: 300000 });

        if (btnInt.customId === 'open_custom_modal') {
          const modal = new ModalBuilder().setCustomId(`modal_${rule}`).setTitle(`${rule} カスタム設定`);
          let limitFieldId = 'limit';
          let limitLabel = '制限数';
          let hasTimeframe = true;

          if (rule === 'duplicate') {
            limitFieldId = 'similarity';
            limitLabel = '類似度 (0.0〜1.0)';
          } else if (rule === 'raid') {
            limitFieldId = 'timeframe';
            limitLabel = '検知時間枠 (秒)';
            hasTimeframe = false;
          } else if (rule === 'spam') {
            limitFieldId = 'messageLimit';
            limitLabel = 'メッセージ数上限';
          } else {
            const map = {
              too_emoji: 'emojiLimit', too_link: 'linkLimit', too_embed: 'embedLimit', markdown_spam: 'ratio',
              too_many_images: 'imageLimit', too_many_line: 'lineLimit', message_update: 'messageLimit',
              character_repeats: 'repeatLimit', mention_spam: 'mentionLimit', reaction_spam: 'reactionLimit',
              thread_limit: 'threadLimit', event_create: 'eventLimit', event_update: 'eventLimit',
              event_delete: 'eventLimit', invite_create_spam: 'inviteLimit', long_message: 'lengthLimit',
              soundboard_spam: 'soundLimit', member_join: 'joinLimit', vc_raid: 'memberLimit'
            };
            limitFieldId = map[rule] || 'nukeLimit';
            limitLabel = '制限数';
          }

          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(limitFieldId).setLabel(limitLabel).setStyle(TextInputStyle.Short).setRequired(true)));
          if (hasTimeframe && rule !== 'raid') {
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('timeframe').setLabel('検知時間枠 (秒)').setStyle(TextInputStyle.Short).setRequired(true)));
          }

          await btnInt.showModal(modal);
          const modalInt = await btnInt.awaitModalSubmit({ time: 300000 });

          const config = { enabled };
          let valid = true;

          if (rule === 'duplicate') {
            const similarity = parseFloat(modalInt.fields.getTextInputValue('similarity'));
            const timeframe = parseInt(modalInt.fields.getTextInputValue('timeframe') || '10') * 1000;
            if (isNaN(similarity) || similarity < 0 || similarity > 1 || isNaN(timeframe) || timeframe < 5000 || timeframe > 60000) valid = false;
            else { config.similarity = similarity; config.timeframe = timeframe; }
          } else if (rule === 'raid') {
            const timeframe = parseInt(modalInt.fields.getTextInputValue('timeframe') || '5') * 1000;
            if (isNaN(timeframe) || timeframe < 1000 || timeframe > 10000) valid = false;
            else config.timeframe = timeframe;
          } else if (rule === 'spam') {
            const messageLimit = parseInt(modalInt.fields.getTextInputValue('messageLimit') || '5');
            const timeframe = parseInt(modalInt.fields.getTextInputValue('timeframe') || '5') * 1000;
            if (isNaN(messageLimit) || messageLimit < 1 || messageLimit > 10 || isNaN(timeframe) || timeframe < 5000 || timeframe > 60000) valid = false;
            else { config.messageLimit = messageLimit; config.timeframe = timeframe; }
          } else {
            const limit = parseInt(modalInt.fields.getTextInputValue(limitFieldId) || '10');
            const timeframe = hasTimeframe ? parseInt(modalInt.fields.getTextInputValue('timeframe') || '60') * 1000 : 60000;
            const max = rule.includes('nuke') ? 20 : 15;
            if (isNaN(limit) || limit < 1 || limit > max || (hasTimeframe && (isNaN(timeframe) || timeframe < 5000 || timeframe > 60000))) valid = false;
            else {
              const key = limitFieldId.charAt(0).toLowerCase() + limitFieldId.slice(1);
              config[key.replace('limit', 'Limit')] = limit;
              if (hasTimeframe) config.timeframe = timeframe;
            }
          }

          if (!valid) return modalInt.reply({ content: '入力値が不正です。もう一度やり直してください。', ephemeral: true });

          settings[antiKey] = config;
          await saveSettings(settingsPath, settings, customDeletePath, customSettings);
          await logToWebhook(interaction, `${rule} カスタム設定適用`);
          await modalInt.reply({ content: `\`${rule}\` をカスタム設定で${enabled ? '有効' : '無効'}にしました！`, ephemeral: true });
        } else {
          const defaults = {
            spam: { messageLimit: 5, timeframe: 5000 },
            duplicate: { similarity: 0.85, timeframe: 10000 },
            raid: { timeframe: 5000 },
            too_emoji: { emojiLimit: 10 },
            long_message: { lengthLimit: 500 },
            too_link: { linkLimit: 10 },
            too_embed: { embedLimit: 8 },
            too_many_images: { imageLimit: 3, timeframe: 5000 },
            too_many_line: { lineLimit: 5, timeframe: 5000 },
            character_repeats: { repeatLimit: 5, timeframe: 5000 },
            mention_spam: { mentionLimit: 5, timeframe: 5000 },
            reaction_spam: { reactionLimit: 5, timeframe: 5000 },
            thread_limit: { threadLimit: 2, timeframe: 5000 },
            event_create: { eventLimit: 2, timeframe: 5000 },
            event_update: { eventLimit: 3, timeframe: 5000 },
            event_delete: { eventLimit: 2, timeframe: 5000 },
            invite_create_spam: { inviteLimit: 2, timeframe: 5000 },
            soundboard_spam: { soundLimit: 5, timeframe: 5000 },
            message_update: { messageLimit: 7, timeframe: 10000 },
            member_join: { joinLimit: 15, timeframe: 10000 },
            vc_raid: { memberLimit: 15, timeframe: 10000 },
            specific_char_spam: { targets: [] },
            markdown_spam: { ratio: 0.3 },
            default: { nukeLimit: 10, timeframe: 60000 },
          };
          const config = { enabled, ...(defaults[rule] || defaults.default) };
          settings[antiKey] = config;
          await saveSettings(settingsPath, settings, customDeletePath, customSettings);
          await logToWebhook(interaction, `${rule} デフォルト設定`);
          await btnInt.update({ content: `\`${rule}\` をデフォルト設定で${enabled ? '有効' : '無効'}にしました！`, components: [] });
        }
      }
    } else {
      if (!settings.antiTroll.rules[rule]) settings.antiTroll.rules[rule] = { enabled: false };
      settings.antiTroll.rules[rule].enabled = enabled;
      settings.antiTroll.enabled = Object.values(settings.antiTroll.rules).some(r => r.enabled);
      await saveSettings(settingsPath, settings, customDeletePath, customSettings);
      await logToWebhook(interaction, `${rule} ${enabled ? '有効' : '無効'}`);
      await interaction.editReply({ content: `\`${rule}\` を${enabled ? '有効' : '無効'}にしました！`, components: [] });
    }
  } catch (error) {
    console.error(error);
    await interaction.followUp({ content: 'タイムアウトまたはエラーが発生しました。もう一度コマンドを実行してください。', ephemeral: true }).catch(() => {});
  }
}