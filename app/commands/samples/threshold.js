import { SlashCommandBuilder, EmbedBuilder, ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('threshold')
  .setDescription('違反ポイント閾値と処罰を設定')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addIntegerOption(option => option.setName('points').setDescription('閾値となる違反ポイント数').setRequired(true).setMinValue(1))
  .addStringOption(option =>
    option.setName('action')
      .setDescription('閾値到達時の処罰')
      .setRequired(true)
      .addChoices(
        { name: 'タイムアウト', value: 'timeout' },
        { name: 'キック', value: 'kick' },
        { name: 'BAN', value: 'ban' },
        { name: 'Webhook削除', value: 'delete_webhook' },
        { name: 'なし/削除', value: 'none' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
  await mkdir(path.dirname(settingsPath), { recursive: true });

  let settings;
  try {
    const data = await readFile(settingsPath, 'utf-8');
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
    } else throw err;
  }
  if (!settings.points) settings.points = { thresholds: {} };
  if (!settings.points.thresholds) settings.points.thresholds = {};

  const points = interaction.options.getInteger('points').toString();
  const action = interaction.options.getString('action');

  if (action === 'none') {
    delete settings.points.thresholds[points];
    await interaction.editReply({ content: `ポイント閾値 ${points} を削除しました` });
    if (webhookUrl) {
      const embed = new EmbedBuilder()
        .setTitle(`Configuration Change in ${interaction.guild.name}`)
        .setDescription(`**Server**: ${interaction.guild.name} (${guildId})\n**User**: ${interaction.user.tag} (${interaction.user.id})\n**Command**: threshold\n**Details**: Removed threshold ${points} points`)
        .setTimestamp();
      try { await axios.post(webhookUrl, { embeds: [embed.toJSON()] }); } catch {}
    }
  } else {
    settings.points.thresholds[points] = action;
    await interaction.editReply({ content: `ポイント ${points} で処罰「${action}」を設定しました` });
    if (webhookUrl) {
      const embed = new EmbedBuilder()
        .setTitle(`Configuration Change in ${interaction.guild.name}`)
        .setDescription(`**Server**: ${interaction.guild.name} (${guildId})\n**User**: ${interaction.user.tag} (${interaction.user.id})\n**Command**: threshold\n**Details**: Set ${points} points → ${action}`)
        .setTimestamp();
      try { await axios.post(webhookUrl, { embeds: [embed.toJSON()] }); } catch {}
    }
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
}