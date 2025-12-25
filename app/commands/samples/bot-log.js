import {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  InteractionContextType,
  ApplicationIntegrationType,
  PermissionFlagsBits
} from 'discord.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const data = new SlashCommandBuilder()
  .setName('bot-log')
  .setDescription('ログを送信するチャンネルを設定')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('送信先チャンネル')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel');
  const guild = interaction.guild;
  const botUser = interaction.client.user;
  const botPerms = channel.permissionsFor(guild.members.me);
  if (!botPerms?.has(PermissionsBitField.Flags.ManageWebhooks)) {
    return interaction.editReply('❌ このチャンネルでWebhookを作成する権限がありません！');
  }
  await interaction.editReply('Webhookを作成中…');
  const webhook = await channel.createWebhook({
    name: '七虎なるくん-Log',
    reason: 'ログ用',
  });
  const settingsPath = path.join(process.cwd(), 'settings', `${guild.id}.json`);
  await mkdir(path.dirname(settingsPath), { recursive: true });
  let settings;
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf8'));
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
  settings.logWebhook = webhook.url;
  if (!settings.whitelist) settings.whitelist = { members: [], channels: [], roles: [], categories: [] };
  if (!settings.whitelist.members.includes(webhook.id)) {
    settings.whitelist.members.push(webhook.id);
  }
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  await interaction.editReply({
    content: `【ログ設定】\n\n作成したWebhook: \`${webhook.name}\`\nWebhook ID: \`${webhook.id}\`\n`
  });
}