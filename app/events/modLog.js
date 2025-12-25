import {
  EmbedBuilder,
  Colors,
  ChannelType,
  AuditLogEvent,
  time,
  TimestampStyles,
} from 'discord.js';
import { readFile } from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const SETTINGS_DIR = path.join(process.cwd(), 'settings');

async function getModLogWebhook(guild) {
  try {
    const data = await readFile(path.join(SETTINGS_DIR, `${guild.id}.json`), 'utf8');
    const settings = JSON.parse(data);
    return settings.modLogWebhook || null;
  } catch {
    return null;
  }
}

async function sendLog(webhookUrl, embed) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error('ModLog Webhook送信エラー:', error);
  }
}

function formatUser(user) {
  if (!user) return '不明';
  return `\`${user.id}\` **${user.username}** (${user.displayName || user.globalName || 'なし'})`;
}

function formatReason(audit) {
  return audit?.reason || '理由なし';
}

function formatExecutor(audit) {
  return audit?.executor ? formatUser(audit.executor) : '不明（システム等）';
}

async function fetchAudit(guild, type) {
  try {
    const audits = await guild.fetchAuditLogs({ type, limit: 1 });
    return audits.entries.first();
  } catch {
    return null;
  }
}

export async function handleModLog(client) {

  client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    if (channel.type === ChannelType.GuildCategory) return;
    const webhookUrl = await getModLogWebhook(channel.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(channel.guild, AuditLogEvent.ChannelCreate);

    const embed = new EmbedBuilder()
      .setTitle('チャンネル作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'チャンネル', value: `<#${channel.id}> (\`${channel.id}\`)` },
        { name: '名前', value: channel.name },
        { name: 'タイプ', value: ChannelType[channel.type] || '不明' },
        { name: 'カテゴリー', value: channel.parent ? `${channel.parent.name} (\`${channel.parentId}\`)` : 'なし' },
        { name: 'トピック', value: channel.topic || 'なし' },
        { name: '低速モード', value: `${channel.rateLimitPerUser || 0}秒` },
        { name: '18禁', value: channel.nsfw ? '有効' : '無効' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    if (oldChannel.name === newChannel.name && 
        oldChannel.topic === newChannel.topic && 
        oldChannel.nsfw === newChannel.nsfw && 
        oldChannel.rateLimitPerUser === newChannel.rateLimitPerUser && 
        oldChannel.parentId === newChannel.parentId) return;

    const webhookUrl = await getModLogWebhook(newChannel.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newChannel.guild, AuditLogEvent.ChannelUpdate);

    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`名前: \`${oldChannel.name}\` → \`${newChannel.name}\``);
    if (oldChannel.topic !== newChannel.topic) changes.push(`トピック: ${oldChannel.topic || 'なし'} → ${newChannel.topic || 'なし'}`);
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`18禁: ${oldChannel.nsfw ? '有効' : '無効'} → ${newChannel.nsfw ? '有効' : '無効'}`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`低速: ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
    if (oldChannel.parentId !== newChannel.parentId) changes.push(`カテゴリー: ${oldChannel.parent?.name || 'なし'} → ${newChannel.parent?.name || 'なし'}`);

    const embed = new EmbedBuilder()
      .setTitle('チャンネル更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'チャンネル', value: `<#${newChannel.id}> (\`${newChannel.id}\`)` },
        { name: '変更内容', value: changes.length ? changes.join('\n') : '権限変更など' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    if (channel.type === ChannelType.GuildCategory) return;
    const webhookUrl = await getModLogWebhook(channel.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(channel.guild, AuditLogEvent.ChannelDelete);

    const embed = new EmbedBuilder()
      .setTitle('チャンネル削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'チャンネル名', value: channel.name },
        { name: 'ID', value: `\`${channel.id}\`` },
        { name: 'タイプ', value: ChannelType[channel.type] || '不明' },
        { name: 'カテゴリー', value: channel.parent ? channel.parent.name : 'なし' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('channelCreate', async (channel) => {
    if (channel.type !== ChannelType.GuildCategory) return;
    const webhookUrl = await getModLogWebhook(channel.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(channel.guild, AuditLogEvent.ChannelCreate);

    const embed = new EmbedBuilder()
      .setTitle('カテゴリー作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'カテゴリー', value: channel.name },
        { name: 'ID', value: `\`${channel.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (oldChannel.type !== ChannelType.GuildCategory || newChannel.type !== ChannelType.GuildCategory) return;
    if (oldChannel.name === newChannel.name) return;

    const webhookUrl = await getModLogWebhook(newChannel.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newChannel.guild, AuditLogEvent.ChannelUpdate);

    const embed = new EmbedBuilder()
      .setTitle('カテゴリー更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'カテゴリー', value: `\`${oldChannel.name}\` → \`${newChannel.name}\`` },
        { name: 'ID', value: `\`${newChannel.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('channelDelete', async (channel) => {
    if (channel.type !== ChannelType.GuildCategory) return;
    const webhookUrl = await getModLogWebhook(channel.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(channel.guild, AuditLogEvent.ChannelDelete);

    const embed = new EmbedBuilder()
      .setTitle('カテゴリー削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'カテゴリー名', value: channel.name },
        { name: 'ID', value: `\`${channel.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('threadCreate', async (thread) => {
    if (!thread.guild) return;
    const webhookUrl = await getModLogWebhook(thread.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(thread.guild, AuditLogEvent.ThreadCreate);

    const embed = new EmbedBuilder()
      .setTitle('スレッド作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'スレッド', value: `<#${thread.id}> (\`${thread.id}\`)` },
        { name: '親チャンネル', value: `<#${thread.parentId}>` },
        { name: '名前', value: thread.name },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('threadDelete', async (thread) => {
    if (!thread.guild) return;
    const webhookUrl = await getModLogWebhook(thread.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(thread.guild, AuditLogEvent.ThreadDelete);

    const embed = new EmbedBuilder()
      .setTitle('スレッド削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'スレッド名', value: thread.name },
        { name: 'ID', value: `\`${thread.id}\`` },
        { name: '親チャンネル', value: `<#${thread.parentId}>` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('threadUpdate', async (oldThread, newThread) => {
    if (oldThread.name === newThread.name && oldThread.archived === newThread.archived && oldThread.locked === newThread.locked) return;
    const webhookUrl = await getModLogWebhook(newThread.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newThread.guild, AuditLogEvent.ThreadUpdate);

    const changes = [];
    if (oldThread.name !== newThread.name) changes.push(`名前: \`${oldThread.name}\` → \`${newThread.name}\``);
    if (oldThread.archived !== newThread.archived) changes.push(`アーカイブ: ${oldThread.archived ? '済' : '未'} → ${newThread.archived ? '済' : '未'}`);
    if (oldThread.locked !== newThread.locked) changes.push(`ロック: ${oldThread.locked ? '済' : '未'} → ${newThread.locked ? '済' : '未'}`);

    const embed = new EmbedBuilder()
      .setTitle('スレッド更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'スレッド', value: `<#${newThread.id}>` },
        { name: '変更内容', value: changes.join('\n') },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('roleCreate', async (role) => {
    const webhookUrl = await getModLogWebhook(role.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(role.guild, AuditLogEvent.RoleCreate);

    const embed = new EmbedBuilder()
      .setTitle('ロール作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'ロール', value: `${role} (\`${role.id}\`)` },
        { name: '色', value: role.hexColor || 'デフォルト' },
        { name: 'メンション可能', value: role.mentionable ? 'はい' : 'いいえ' },
        { name: '別表示', value: role.hoist ? 'はい' : 'いいえ' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      )
      .setThumbnail(role.iconURL() || null);

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    if (oldRole.name === newRole.name && oldRole.color === newRole.color && oldRole.permissions.bitfield === newRole.permissions.bitfield && oldRole.mentionable === newRole.mentionable && oldRole.hoist === newRole.hoist && oldRole.icon === newRole.icon) return;

    const webhookUrl = await getModLogWebhook(newRole.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newRole.guild, AuditLogEvent.RoleUpdate);

    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`名前: \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.color !== newRole.color) changes.push(`色: ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`メンション: ${oldRole.mentionable ? '可' : '不可'} → ${newRole.mentionable ? '可' : '不可'}`);
    if (oldRole.hoist !== newRole.hoist) changes.push(`別表示: ${oldRole.hoist ? 'はい' : 'いいえ'} → ${newRole.hoist ? 'はい' : 'いいえ'}`);
    if (oldRole.icon !== newRole.icon) changes.push('ロールアイコン変更');
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('権限変更');

    const embed = new EmbedBuilder()
      .setTitle('ロール更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'ロール', value: `${newRole} (\`${newRole.id}\`)` },
        { name: '変更内容', value: changes.join('\n') || '不明' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      )
      .setThumbnail(newRole.iconURL() || null);

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('roleDelete', async (role) => {
    const webhookUrl = await getModLogWebhook(role.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(role.guild, AuditLogEvent.RoleDelete);

    const embed = new EmbedBuilder()
      .setTitle('ロール削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'ロール名', value: role.name },
        { name: 'ID', value: `\`${role.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      )
      .setThumbnail(role.iconURL() || null);

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildMemberRoleAdd', async (member, role) => {
    const webhookUrl = await getModLogWebhook(member.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(member.guild, AuditLogEvent.MemberRoleUpdate);

    const embed = new EmbedBuilder()
      .setTitle('ロール付与')
      .setColor(Colors.Blue)
      .setTimestamp()
      .addFields(
        { name: '対象ユーザー', value: formatUser(member.user) },
        { name: '付与ロール', value: `${role} (\`${role.id}\`)` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildMemberRoleRemove', async (member, role) => {
    const webhookUrl = await getModLogWebhook(member.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(member.guild, AuditLogEvent.MemberRoleUpdate);

    const embed = new EmbedBuilder()
      .setTitle('ロール剥奪')
      .setColor(Colors.DarkOrange)
      .setTimestamp()
      .addFields(
        { name: '対象ユーザー', value: formatUser(member.user) },
        { name: '剥奪ロール', value: `${role} (\`${role.id}\`)` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildMemberAdd', async (member) => {
    const webhookUrl = await getModLogWebhook(member.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('メンバー参加')
      .setColor(Colors.Green)
      .setThumbnail(member.user.displayAvatarURL({ size: 4096 }))
      .setTimestamp()
      .addFields(
        { name: 'ユーザー', value: formatUser(member.user) },
        { name: '参加日時', value: time(member.joinedAt, TimestampStyles.LongDateTime) },
        { name: 'アカウント作成日', value: time(member.user.createdAt, TimestampStyles.LongDateTime) },
        { name: 'ニックネーム', value: member.nickname || 'なし' },
        { name: 'バッジ', value: member.user.flags?.toArray().join(', ') || 'なし' }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildMemberRemove', async (member) => {
    const webhookUrl = await getModLogWebhook(member.guild);
    if (!webhookUrl) return;

    const kickAudit = await fetchAudit(member.guild, AuditLogEvent.MemberKick);
    const banAudit = await fetchAudit(member.guild, AuditLogEvent.MemberBanAdd);
    const audit = kickAudit || banAudit;

    const action = audit ? (kickAudit ? 'キック' : 'BAN') : '自主退会';

    const embed = new EmbedBuilder()
      .setTitle(action === '自主退会' ? 'メンバー退会' : `${action}実行`)
      .setColor(action === '自主退会' ? Colors.Orange : Colors.Red)
      .setThumbnail(member.user.displayAvatarURL({ size: 4096 }))
      .setTimestamp()
      .addFields(
        { name: 'ユーザー', value: formatUser(member.user) },
        { name: '実行者', value: action === '自主退会' ? '-' : formatExecutor(audit), inline: true },
        { name: '理由', value: action === '自主退会' ? '-' : formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildBanAdd', async (ban) => {
    const webhookUrl = await getModLogWebhook(ban.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(ban.guild, AuditLogEvent.MemberBanAdd);

    const embed = new EmbedBuilder()
      .setTitle('BAN実行')
      .setColor(Colors.DarkRed)
      .setThumbnail(ban.user.displayAvatarURL({ size: 4096 }))
      .setTimestamp()
      .addFields(
        { name: '対象ユーザー', value: formatUser(ban.user) },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildBanRemove', async (ban) => {
    const webhookUrl = await getModLogWebhook(ban.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(ban.guild, AuditLogEvent.MemberBanRemove);

    const embed = new EmbedBuilder()
      .setTitle('BAN解除')
      .setColor(Colors.Green)
      .setThumbnail(ban.user.displayAvatarURL({ size: 4096 }))
      .setTimestamp()
      .addFields(
        { name: '対象ユーザー', value: formatUser(ban.user) },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const webhookUrl = await getModLogWebhook(newMember.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newMember.guild, AuditLogEvent.MemberUpdate);

    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const isTimeout = newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > Date.now();
      const embed = new EmbedBuilder()
        .setTitle(isTimeout ? 'タイムアウト実行' : 'タイムアウト解除')
        .setColor(isTimeout ? Colors.Red : Colors.Green)
        .setThumbnail(newMember.user.displayAvatarURL({ size: 4096 }))
        .setTimestamp()
        .addFields(
          { name: '対象ユーザー', value: formatUser(newMember.user) },
          { name: '期限', value: isTimeout ? time(newMember.communicationDisabledUntil, TimestampStyles.LongDateTime) : '解除済み' },
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setTitle('ニックネーム変更')
        .setColor(Colors.Blue)
        .setTimestamp()
        .addFields(
          { name: 'ユーザー', value: formatUser(newMember.user) },
          { name: '変更内容', value: `\`${oldMember.nickname || 'なし'}\` → \`${newMember.nickname || 'なし'}\`` },
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }
  });

  client.on('autoModerationRuleCreate', async (rule) => {
    const webhookUrl = await getModLogWebhook(rule.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('オートモッドルール作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'ルール名', value: rule.name },
        { name: 'ID', value: `\`${rule.id}\`` },
        { name: 'トリガータイプ', value: rule.triggerType.toString() },
        { name: '有効', value: rule.enabled ? 'はい' : 'いいえ' }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('autoModerationRuleUpdate', async (oldRule, newRule) => {
    if (!oldRule || !newRule) return;
    const webhookUrl = await getModLogWebhook(newRule.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('オートモッドルール更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'ルール名', value: newRule.name },
        { name: 'ID', value: `\`${newRule.id}\`` },
        { name: '変更内容', value: '詳細はDiscord監査ログ参照' }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('autoModerationRuleDelete', async (rule) => {
    const webhookUrl = await getModLogWebhook(rule.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('オートモッドルール削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'ルール名', value: rule.name },
        { name: 'ID', value: `\`${rule.id}\`` }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('autoModerationActionExecution', async (execution) => {
    const webhookUrl = await getModLogWebhook(execution.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('オートモッド発動')
      .setColor(Colors.Purple)
      .setTimestamp()
      .addFields(
        { name: 'ユーザー', value: formatUser(execution.user) },
        { name: 'アクション', value: execution.action.type.toString() },
        { name: 'ルール名', value: execution.ruleName || '不明' },
        { name: 'チャンネル', value: execution.channel ? `<#${execution.channel.id}>` : 'DM/不明' },
        { name: '内容', value: execution.content?.slice(0, 1000) || 'なし' }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('voiceStateUpdate', async (oldState, newState) => {
    const webhookUrl = await getModLogWebhook(newState.guild);
    if (!webhookUrl) return;

    if (oldState.channelId && !newState.channelId) {
      const audit = await fetchAudit(newState.guild, AuditLogEvent.MemberDisconnect);
      if (audit && audit.targetId === newState.member.id) {
        const embed = new EmbedBuilder()
          .setTitle('VC切断（キック）')
          .setColor(Colors.Red)
          .setTimestamp()
          .addFields(
            { name: '対象ユーザー', value: formatUser(newState.member.user) },
            { name: 'チャンネル', value: `<#${oldState.channelId}>` },
            { name: '実行者', value: formatExecutor(audit), inline: true },
            { name: '理由', value: formatReason(audit), inline: true }
          );
        await sendLog(webhookUrl, embed.toJSON());
      }
    }

    if (oldState.channelId && !newState.channelId) {
      const audit = await fetchAudit(newState.guild, AuditLogEvent.MemberDisconnect);
      if (audit && audit.targetId === newState.member.id) return;

      const embed = new EmbedBuilder()
        .setTitle('ボイスチャンネル切断')
        .setColor(Colors.Orange)
        .setThumbnail(newState.member.user.displayAvatarURL({ size: 4096 }))
        .setTimestamp()
        .addFields(
          { name: 'ユーザー', value: formatUser(newState.member.user) },
          { name: '切断元チャンネル', value: `<#${oldState.channelId}>` }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setTitle('ボイスチャンネル接続')
        .setColor(Colors.Green)
        .setThumbnail(newState.member.user.displayAvatarURL({ size: 4096 }))
        .setTimestamp()
        .addFields(
          { name: 'ユーザー', value: formatUser(newState.member.user) },
          { name: '接続先チャンネル', value: `<#${newState.channelId}>` }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (oldState.channelId !== newState.channelId && oldState.channelId && newState.channelId) {
      const audit = await fetchAudit(newState.guild, AuditLogEvent.MemberMove);
      if (audit && audit.targetId === newState.member.id) {
        const embed = new EmbedBuilder()
          .setTitle('VC移動（強制）')
          .setColor(Colors.Blue)
          .setTimestamp()
          .addFields(
            { name: '対象ユーザー', value: formatUser(newState.member.user) },
            { name: '移動元 → 移動先', value: `<#${oldState.channelId}> → <#${newState.channelId}>` },
            { name: '実行者', value: formatExecutor(audit), inline: true },
            { name: '理由', value: formatReason(audit), inline: true }
          );
        await sendLog(webhookUrl, embed.toJSON());
      }
    }

    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const audit = await fetchAudit(newState.guild, AuditLogEvent.MemberMove);
      if (audit && audit.targetId === newState.member.id) return;

      const embed = new EmbedBuilder()
        .setTitle('ボイスチャンネル移動')
        .setColor(Colors.Blue)
        .setThumbnail(newState.member.user.displayAvatarURL({ size: 4096 }))
        .setTimestamp()
        .addFields(
          { name: 'ユーザー', value: formatUser(newState.member.user) },
          { name: '移動元 → 移動先', value: `<#${oldState.channelId}> → <#${newState.channelId}>` }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }

  });

  client.on('guildUpdate', async (oldGuild, newGuild) => {
    const webhookUrl = await getModLogWebhook(newGuild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newGuild, AuditLogEvent.GuildUpdate);

    if (oldGuild.name !== newGuild.name) {
      const embed = new EmbedBuilder()
        .setTitle('サーバー名変更')
        .setColor(Colors.Purple)
        .setTimestamp()
        .addFields(
          { name: '変更内容', value: `\`${oldGuild.name}\` → \`${newGuild.name}\`` },
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        )
        .setThumbnail(newGuild.iconURL({ size: 4096 }) || null);
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (oldGuild.description !== newGuild.description) {
      const embed = new EmbedBuilder()
        .setTitle('サーバー説明変更')
        .setColor(Colors.Purple)
        .setTimestamp()
        .addFields(
          { name: '変更内容', value: 'サーバー説明が更新されました' },
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (oldGuild.icon !== newGuild.icon) {
      const embed = new EmbedBuilder()
        .setTitle('サーバーアイコン変更')
        .setColor(Colors.Purple)
        .setTimestamp()
        .addFields(
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        )
        .setThumbnail(newGuild.iconURL({ size: 4096 }) || null);
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (oldGuild.features.length !== newGuild.features.length || oldGuild.features.some(f => !newGuild.features.includes(f))) {
      const added = newGuild.features.filter(f => !oldGuild.features.includes(f));
      const removed = oldGuild.features.filter(f => !newGuild.features.includes(f));
      const embed = new EmbedBuilder()
        .setTitle('コミュニティ機能変更')
        .setColor(Colors.Purple)
        .setTimestamp()
        .addFields(
          { name: '追加機能', value: added.join(', ') || 'なし' },
          { name: '削除機能', value: removed.join(', ') || 'なし' },
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }

    if (oldGuild.rulesChannelId !== newGuild.rulesChannelId || oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
      const embed = new EmbedBuilder()
        .setTitle('オンボーディング/ルールチャンネル変更')
        .setColor(Colors.Purple)
        .setTimestamp()
        .addFields(
          { name: '変更内容', value: 'オンボーディング関連チャンネルが変更されました' },
          { name: '実行者', value: formatExecutor(audit), inline: true },
          { name: '理由', value: formatReason(audit), inline: true }
        );
      await sendLog(webhookUrl, embed.toJSON());
    }
  });

  client.on('emojiCreate', async (emoji) => {
    const webhookUrl = await getModLogWebhook(emoji.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(emoji.guild, AuditLogEvent.EmojiCreate);

    const embed = new EmbedBuilder()
      .setTitle('絵文字作成')
      .setColor(Colors.Green)
      .setThumbnail(emoji.url)
      .setTimestamp()
      .addFields(
        { name: '絵文字', value: `${emoji} \`${emoji.name}\`` },
        { name: 'ID', value: `\`${emoji.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
    if (oldEmoji.name === newEmoji.name) return;
    const webhookUrl = await getModLogWebhook(newEmoji.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newEmoji.guild, AuditLogEvent.EmojiUpdate);

    const embed = new EmbedBuilder()
      .setTitle('絵文字更新')
      .setColor(Colors.Orange)
      .setThumbnail(newEmoji.url)
      .setTimestamp()
      .addFields(
        { name: '絵文字', value: `${newEmoji} (\`${newEmoji.id}\`)` },
        { name: '名前変更', value: `\`${oldEmoji.name}\` → \`${newEmoji.name}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('emojiDelete', async (emoji) => {
    const webhookUrl = await getModLogWebhook(emoji.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(emoji.guild, AuditLogEvent.EmojiDelete);

    const embed = new EmbedBuilder()
      .setTitle('絵文字削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: '絵文字名', value: emoji.name },
        { name: 'ID', value: `\`${emoji.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('stickerCreate', async (sticker) => {
    const webhookUrl = await getModLogWebhook(sticker.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(sticker.guild, AuditLogEvent.StickerCreate);

    const embed = new EmbedBuilder()
      .setTitle('ステッカー作成')
      .setColor(Colors.Green)
      .setThumbnail(sticker.url)
      .setTimestamp()
      .addFields(
        { name: 'ステッカー', value: sticker.name },
        { name: 'ID', value: `\`${sticker.id}\`` },
        { name: '説明', value: sticker.description || 'なし' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('stickerUpdate', async (oldSticker, newSticker) => {
    if (oldSticker.name === newSticker.name && oldSticker.description === newSticker.description) return;
    const webhookUrl = await getModLogWebhook(newSticker.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newSticker.guild, AuditLogEvent.StickerUpdate);

    const changes = [];
    if (oldSticker.name !== newSticker.name) changes.push(`名前: \`${oldSticker.name}\` → \`${newSticker.name}\``);
    if (oldSticker.description !== newSticker.description) changes.push(`説明: ${oldSticker.description || 'なし'} → ${newSticker.description || 'なし'}`);

    const embed = new EmbedBuilder()
      .setTitle('ステッカー更新')
      .setColor(Colors.Orange)
      .setThumbnail(newSticker.url)
      .setTimestamp()
      .addFields(
        { name: 'ステッカー', value: newSticker.name },
        { name: '変更内容', value: changes.join('\n') },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('stickerDelete', async (sticker) => {
    const webhookUrl = await getModLogWebhook(sticker.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(sticker.guild, AuditLogEvent.StickerDelete);

    const embed = new EmbedBuilder()
      .setTitle('ステッカー削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'ステッカー名', value: sticker.name },
        { name: 'ID', value: `\`${sticker.id}\`` },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;
    if (!message.guild) return;
    const webhookUrl = await getModLogWebhook(message.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(message.guild, AuditLogEvent.MessageDelete);

    const embed = new EmbedBuilder()
      .setTitle('メッセージ削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: '送信者', value: formatUser(message.author) },
        { name: 'チャンネル', value: `<#${message.channel.id}>` },
        { name: '内容', value: message.content?.slice(0, 1000) || '（添付ファイル/埋め込みのみ）' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    if (message.attachments.size > 0) {
      embed.setImage(message.attachments.first().url);
    }

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.content === newMessage.content || !oldMessage.content || !newMessage.content) return;
    if (newMessage.author?.bot) return;
    const webhookUrl = await getModLogWebhook(newMessage.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('メッセージ編集')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: '送信者', value: formatUser(newMessage.author) },
        { name: 'チャンネル', value: `<#${newMessage.channel.id}>` },
        { name: '旧内容', value: oldMessage.content.slice(0, 1000) },
        { name: '新内容', value: newMessage.content.slice(0, 1000) }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('inviteCreate', async (invite) => {
    const webhookUrl = await getModLogWebhook(invite.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('招待リンク作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: '招待コード', value: invite.code },
        { name: 'チャンネル', value: `<#${invite.channel.id}>` },
        { name: '有効期限', value: invite.expiresAt ? time(invite.expiresAt, TimestampStyles.RelativeTime) : '無制限' },
        { name: '最大使用回数', value: invite.maxUses ? `${invite.maxUses}回` : '無制限' },
        { name: '作成者', value: formatUser(invite.inviter) }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('inviteDelete', async (invite) => {
    const webhookUrl = await getModLogWebhook(invite.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('招待リンク削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: '招待コード', value: invite.code },
        { name: 'チャンネル', value: `<#${invite.channel.id}>` }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('webhookCreate', async (webhook) => {
    const webhookUrl = await getModLogWebhook(webhook.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('Webhook作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'Webhook名', value: webhook.name },
        { name: 'チャンネル', value: `<#${webhook.channelId}>` }
      )
      .setThumbnail(webhook.avatarURL() || null);

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('webhookDelete', async (webhook) => {
    const webhookUrl = await getModLogWebhook(webhook.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('Webhook削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'Webhook名', value: webhook.name },
        { name: 'チャンネル', value: `<#${webhook.channelId}>` }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('integrationCreate', async (integration) => {
    const webhookUrl = await getModLogWebhook(integration.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('連携/ボット追加')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: '名前', value: integration.name },
        { name: 'タイプ', value: integration.type },
        { name: 'ID', value: `\`${integration.id}\`` }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('integrationDelete', async (integration) => {
    const webhookUrl = await getModLogWebhook(integration.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('連携/ボット削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: '名前', value: integration.name },
        { name: 'タイプ', value: integration.type },
        { name: 'ID', value: `\`${integration.id}\`` }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('stageInstanceCreate', async (stage) => {
    const webhookUrl = await getModLogWebhook(stage.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('ステージチャンネルイベント開始')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'チャンネル', value: `<#${stage.channelId}>` },
        { name: 'トピック', value: stage.topic },
        { name: 'プライバシー', value: stage.privacyLevel === 1 ? '公開' : 'ギルド限定' }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('stageInstanceUpdate', async (oldStage, newStage) => {
    if (!oldStage || !newStage) return;
    if (oldStage.topic === newStage.topic) return;

    const webhookUrl = await getModLogWebhook(newStage.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('ステージチャンネルトピック更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'チャンネル', value: `<#${newStage.channelId}>` },
        { name: 'トピック変更', value: `\`${oldStage.topic || 'なし'}\` → \`${newStage.topic}\`` }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('stageInstanceDelete', async (stage) => {
    const webhookUrl = await getModLogWebhook(stage.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('ステージチャンネルイベント終了')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'チャンネル', value: `<#${stage.channelId}>` },
        { name: 'トピック', value: stage.topic }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildScheduledEventCreate', async (event) => {
    const webhookUrl = await getModLogWebhook(event.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(event.guild, AuditLogEvent.GuildScheduledEventCreate);

    const location = event.entityType === 1 ? 'ステージチャンネル' :
                     event.entityType === 2 ? 'ボイスチャンネル' :
                     event.entityType === 3 ? '外部' : '不明';

    const embed = new EmbedBuilder()
      .setTitle('サーバーイベント作成')
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: 'イベント名', value: event.name },
        { name: '開始予定', value: time(event.scheduledStartAt, TimestampStyles.LongDateTime) },
        { name: '終了予定', value: event.scheduledEndAt ? time(event.scheduledEndAt, TimestampStyles.LongDateTime) : '未設定' },
        { name: '場所タイプ', value: location },
        { name: '場所', value: event.channel ? `<#${event.channelId}>` : event.entityMetadata?.location || '外部' },
        { name: '説明', value: event.description?.slice(0, 500) || 'なし' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      )
      .setThumbnail(event.coverImageURL({ size: 4096 }) || null);

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
    if (!oldEvent || !newEvent) return;
    if (oldEvent.name === newEvent.name && 
        oldEvent.description === newEvent.description && 
        oldEvent.scheduledStartAt.getTime() === newEvent.scheduledStartAt.getTime() &&
        oldEvent.status === newEvent.status) return;

    const webhookUrl = await getModLogWebhook(newEvent.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(newEvent.guild, AuditLogEvent.GuildScheduledEventUpdate);

    const changes = [];
    if (oldEvent.name !== newEvent.name) changes.push(`名前: \`${oldEvent.name}\` → \`${newEvent.name}\``);
    if (oldEvent.description !== newEvent.description) changes.push('説明変更');
    if (oldEvent.scheduledStartAt.getTime() !== newEvent.scheduledStartAt.getTime()) changes.push(`開始時間変更`);
    if (oldEvent.status !== newEvent.status) changes.push(`ステータス: ${oldEvent.status === 1 ? '予定' : oldEvent.status === 2 ? '開始' : '終了'} → ${newEvent.status === 1 ? '予定' : newEvent.status === 2 ? '開始' : '終了'}`);

    const embed = new EmbedBuilder()
      .setTitle('サーバーイベント更新')
      .setColor(Colors.Orange)
      .setTimestamp()
      .addFields(
        { name: 'イベント名', value: newEvent.name },
        { name: '変更内容', value: changes.join('\n') || '細かな変更' },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      )
      .setThumbnail(newEvent.coverImageURL({ size: 4096 }) || null);

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildScheduledEventDelete', async (event) => {
    const webhookUrl = await getModLogWebhook(event.guild);
    if (!webhookUrl) return;
    const audit = await fetchAudit(event.guild, AuditLogEvent.GuildScheduledEventDelete);

    const embed = new EmbedBuilder()
      .setTitle('サーバーイベント削除')
      .setColor(Colors.Red)
      .setTimestamp()
      .addFields(
        { name: 'イベント名', value: event.name },
        { name: '開始予定だった時間', value: time(event.scheduledStartAt, TimestampStyles.LongDateTime) },
        { name: '実行者', value: formatExecutor(audit), inline: true },
        { name: '理由', value: formatReason(audit), inline: true }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildScheduledEventUserAdd', async (event, user) => {
    const webhookUrl = await getModLogWebhook(event.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('イベント参加')
      .setColor(Colors.Blue)
      .setThumbnail(user.displayAvatarURL({ size: 4096 }))
      .setTimestamp()
      .addFields(
        { name: 'イベント', value: event.name },
        { name: 'ユーザー', value: formatUser(user) }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

  client.on('guildScheduledEventUserRemove', async (event, user) => {
    const webhookUrl = await getModLogWebhook(event.guild);
    if (!webhookUrl) return;

    const embed = new EmbedBuilder()
      .setTitle('イベント参加取消')
      .setColor(Colors.DarkOrange)
      .setThumbnail(user.displayAvatarURL({ size: 4096 }))
      .setTimestamp()
      .addFields(
        { name: 'イベント', value: event.name },
        { name: 'ユーザー', value: formatUser(user) }
      );

    await sendLog(webhookUrl, embed.toJSON());
  });

}