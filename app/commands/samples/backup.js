import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ApplicationIntegrationType,
  InteractionContextType
} from 'discord.js';
import { readFile, writeFile, mkdir, rm, access } from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import archiver from 'archiver';
import unzipper from 'unzipper';

const BACKUP_DIR = path.join(process.cwd(), 'backup');

export const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('サーバーのバックアップを管理します')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .addSubcommand(subcommand =>
    subcommand
      .setName('save')
      .setDescription('サーバーのデータをバックアップします')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('load')
      .setDescription('指定されたサーバーIDのバックアップをロードします')
      .addStringOption(option =>
        option
          .setName('serverid')
          .setDescription('バックアップをロードするサーバーID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('request')
      .setDescription('バックアップの許可ユーザーを管理します')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('追加(add)または削除(remove)を選択')
          .setRequired(true)
          .addChoices(
            { name: 'Add', value: 'add' },
            { name: 'Remove', value: 'remove' }
          )
      )
      .addStringOption(option =>
        option
          .setName('userid')
          .setDescription('対象のユーザーID')
          .setRequired(true)
      )
  );

// カスタムAutoModルールのトリガータイプ（数値で定義）
const CUSTOM_AUTOMOD_TRIGGER_TYPES = [1, 3]; // 1: Keyword, 3: KeywordPreset

// ZIPファイルを作成するヘルパー関数
async function createZipArchive(serverDir, serverId) {
  const zipPath = path.join(BACKUP_DIR, 'files', `${serverId}.zip`);
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', err => reject(err));
    archive.pipe(output);
    archive.directory(serverDir, false);
    archive.finalize();
  });
}

// ZIPファイルを展開するヘルパー関数
async function extractZipArchive(zipPath, serverDir) {
  try {
    await access(zipPath);
    await mkdir(serverDir, { recursive: true });
    const stream = createReadStream(zipPath).pipe(unzipper.Extract({ path: serverDir }));
    return new Promise((resolve, reject) => {
      stream.on('close', resolve);
      stream.on('error', reject);
    });
  } catch (error) {
    throw new Error(`ZIPファイルの展開に失敗しました: ${zipPath} (${error.message})`);
  }
}

// コマンドの実行処理
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    await mkdir(path.join(BACKUP_DIR, 'files'), { recursive: true });
  } catch (error) {
    console.error('バックアップディレクトリの作成に失敗:', error);
  }

  if (subcommand === 'save') {
    await saveBackup(interaction);
  } else if (subcommand === 'load') {
    const serverId = interaction.options.getString('serverid');
    await loadBackup(interaction, serverId);
  } else if (subcommand === 'request') {
    const action = interaction.options.getString('action');
    const userId = interaction.options.getString('userid');
    await manageBackupUsers(interaction, action, userId);
  }
}

// ファイル保存ヘルパー
async function saveFile(url, filePath) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.buffer();
    await writeFile(filePath, buffer);
    return path.basename(filePath);
  } catch (error) {
    console.warn(`ファイルの保存に失敗: ${url}`, error);
    return null;
  }
}

// 権限収集ヘルパー
function collectPermissions(entity) {
  const permissions = [];
  if (!entity.permissionOverwrites) {
    return permissions;
  }
  for (const [id, perm] of entity.permissionOverwrites.cache) {
    permissions.push({
      id,
      allow: perm.allow.bitfield.toString(),
      deny: perm.deny.bitfield.toString(),
      type: perm.type,
    });
  }
  return permissions;
}

// バックアップ保存処理
async function saveBackup(interaction) {
  await interaction.deferReply();
  await interaction.editReply({ content: `バックアップを保存しています\.\.\.\nこの操作には時間がかかります。` });
  try {
    const guild = interaction.guild;
    const serverDir = path.join(BACKUP_DIR, 'files', guild.id);
    await mkdir(serverDir, { recursive: true });

    const backupData = {
      guildId: guild.id,
      ownerId: guild.ownerId,
      allowedUsers: [guild.ownerId],
      name: guild.name,
      description: guild.description || null,
      icon: guild.icon ? await saveFile(guild.iconURL(), path.join(serverDir, `${guild.id}_icon.png`)) : null,
      channels: [],
      categories: [],
      roles: [],
      threads: [],
      emojis: [],
      stickers: [],
      autoModRules: [],
      bans: [],
    };

    // カテゴリーデータの収集
    const categories = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildCategory);
    for (const category of categories.values()) {
      backupData.categories.push({
        id: category.id,
        name: category.name,
        position: category.position,
        permissions: collectPermissions(category),
      });
    }

    // チャンネルデータの収集
    const channels = guild.channels.cache.filter(ch => ch.type !== ChannelType.GuildCategory);
    for (const channel of channels.values()) {
      const channelData = {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId || null,
        position: channel.position,
        permissions: collectPermissions(channel),
        topic: channel.topic || null,
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        nsfw: channel.nsfw || false,
      };
      backupData.channels.push(channelData);

      // スレッドの収集
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildForum) {
        const threads = await channel.threads.fetch();
        for (const thread of threads.threads.values()) {
          const starterMessage = await thread.fetchStarterMessage().catch(() => null);
          backupData.threads.push({
            id: thread.id,
            name: thread.name,
            type: thread.type,
            parentId: channel.id,
            archived: thread.archived || false,
            autoArchiveDuration: thread.autoArchiveDuration || 1440,
            locked: thread.locked || false,
            permissions: collectPermissions(thread),
            starterMessage: starterMessage
              ? {
                  content: starterMessage.content || '',
                  authorId: starterMessage.author.id,
                }
              : null,
          });
        }
      }
    }

    // ロールデータの収集
    const roles = guild.roles.cache.filter(role => role.id !== guild.id);
    for (const role of roles.values()) {
      backupData.roles.push({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
      });
    }

    // 絵文字の収集
    const emojis = guild.emojis.cache;
    for (const emoji of emojis.values()) {
      backupData.emojis.push({
        id: emoji.id,
        name: emoji.name,
        url: await saveFile(emoji.url, path.join(serverDir, `${guild.id}_emoji_${emoji.id}.png`)),
      });
    }

    // スタンプの収集
    const stickers = guild.stickers.cache;
    for (const sticker of stickers.values()) {
      backupData.stickers.push({
        id: sticker.id,
        name: sticker.name,
        url: await saveFile(sticker.url, path.join(serverDir, `${guild.id}_sticker_${sticker.id}.png`)),
      });
    }

    // カスタムAutoModルールの収集（Keyword と KeywordPreset）
    const autoModRules = await guild.autoModerationRules.fetch();
    for (const rule of autoModRules.values()) {
      if (CUSTOM_AUTOMOD_TRIGGER_TYPES.includes(rule.triggerType)) {
        backupData.autoModRules.push({
          id: rule.id,
          name: rule.name,
          triggerType: rule.triggerType,
          actions: rule.actions,
          enabled: rule.enabled,
          triggerMetadata: rule.triggerMetadata || {}, // triggerMetadata を保存
        });
      }
    }

    // BANデータの収集
    const bans = await guild.bans.fetch();
    for (const ban of bans.values()) {
      backupData.bans.push({
        userId: ban.user.id,
        reason: ban.reason || null,
      });
    }

    // JSONファイルに保存
    const backupFile = path.join(BACKUP_DIR, `${guild.id}.json`);
    try {
      await writeFile(backupFile, JSON.stringify(backupData, null, 2));
      await createZipArchive(serverDir, guild.id);
      await rm(serverDir, { recursive: true, force: true });
      await interaction.editReply(`バックアップが正常に保存されました。サーバーID: ${guild.id}`);
    } catch (error) {
      console.error('バックアップファイルの保存またはZIP作成に失敗:', error);
      await interaction.editReply('バックアップの保存またはZIP作成中にエラーが発生しました。');
    }
  } catch (error) {
    console.error('バックアップ保存エラー:', error);
    await interaction.editReply('バックアップの保存中にエラーが発生しました。');
  }
}

// バックアップロード処理
async function loadBackup(interaction, serverId) {
  await interaction.deferReply();
  try {
    const backupFile = path.join(BACKUP_DIR, `${serverId}.json`);
    const zipPath = path.join(BACKUP_DIR, 'files', `${serverId}.zip`);
    const serverDir = path.join(BACKUP_DIR, 'files', serverId);

    // ZIPファイルの存在チェック
    try {
      await access(zipPath);
    } catch {
      await interaction.editReply(`ZIPファイルが見つかりません: ${serverId}.zip`);
      return;
    }

    // ZIPファイルを展開
    try {
      await extractZipArchive(zipPath, serverDir);
    } catch (error) {
      console.error('ZIPファイルの展開に失敗:', error);
      await interaction.editReply(`ZIPファイルの展開に失敗しました: ${serverId}.zip (${error.message})`);
      return;
    }

    // バックアップJSONの読み込み
    let backupData;
    try {
      const data = await readFile(backupFile, 'utf-8');
      backupData = JSON.parse(data);
    } catch (error) {
      console.error('バックアップファイルの読み込みに失敗:', error);
      await interaction.editReply(`バックアップファイルが見つからないか、読み込みに失敗しました: ${serverId}`);
      return;
    }

    // 許可されたユーザーのチェック
    if (!backupData.allowedUsers?.includes(interaction.user.id)) {
      await interaction.editReply('あなたはこのバックアップを使用する権限がありません。');
      return;
    }

    const guild = interaction.guild;

    await interaction.editReply(`バックアップからサーバーを復元します。`);

    // サーバー情報の復元
    try {
      if (backupData.name || backupData.description || backupData.icon) {
        await guild.edit({
          name: backupData.name || guild.name,
          description: backupData.description || guild.description,
          icon: backupData.icon ? await readFile(path.join(serverDir, backupData.icon)) : null,
        });
      }
    } catch (error) {
      console.warn('サーバー情報の復元に失敗:', error);
    }

    // 既存のチャンネルとロールを削除
    const channels = guild.channels.cache.filter(ch => ch.deletable);
    for (const channel of channels.values()) {
      try {
        await channel.delete();
      } catch (error) {
        console.warn(`チャンネル ${channel.name} の削除に失敗しました:`, error);
      }
    }

    const roles = guild.roles.cache.filter(role => role.editable && role.id !== guild.id);
    for (const role of roles.values()) {
      try {
        await role.delete();
      } catch (error) {
        console.warn(`ロール ${role.name} の削除に失敗しました:`, error);
      }
    }

    // カテゴリーの作成
    const categoryMap = new Map();
    for (const category of (backupData.categories || []).sort((a, b) => a.position - b.position)) {
      try {
        const newCategory = await guild.channels.create({
          name: category.name,
          type: ChannelType.GuildCategory,
          position: category.position,
          permissionOverwrites: category.permissions || [],
        });
        categoryMap.set(category.id, newCategory.id);
      } catch (error) {
        console.warn(`カテゴリー ${category.name} の作成に失敗しました:`, error);
      }
    }

    // チャンネルの作成
    const channelMap = new Map();
    for (const channel of (backupData.channels || []).sort((a, b) => a.position - b.position)) {
      try {
        const newChannel = await guild.channels.create({
          name: channel.name,
          type: channel.type,
          parent: channel.parentId ? guild.channels.cache.get(categoryMap.get(channel.parentId)) : null,
          position: channel.position,
          permissionOverwrites: channel.permissions || [],
          topic: channel.topic || undefined,
          rateLimitPerUser: channel.rateLimitPerUser || 0,
          nsfw: channel.nsfw || false,
        });
        channelMap.set(channel.id, newChannel.id);
      } catch (error) {
        console.warn(`チャンネル ${channel.name} の作成に失敗しました:`, error);
      }
    }

    // スレッドの復元
    for (const thread of backupData.threads || []) {
      try {
        const parentChannel = guild.channels.cache.get(channelMap.get(thread.parentId));
        if (!parentChannel) {
          console.warn(`スレッド ${thread.name} の親チャンネルが見つかりません`);
          continue;
        }
        let newThread;
        if (parentChannel.type === ChannelType.GuildForum) {
          newThread = await parentChannel.threads.create({
            name: thread.name,
            message: thread.starterMessage ? { content: thread.starterMessage.content } : undefined,
            autoArchiveDuration: thread.autoArchiveDuration || 1440,
          });
        } else {
          newThread = await parentChannel.threads.create({
            name: thread.name,
            type: thread.type,
            autoArchiveDuration: thread.autoArchiveDuration || 1440,
          });
          if (thread.starterMessage?.content) {
            await newThread.send(thread.starterMessage.content);
          }
        }
        if (thread.permissions?.length) {
          await newThread.edit({
            permissionOverwrites: thread.permissions,
          });
        }
        if (thread.archived) await newThread.setArchived(true);
        if (thread.locked) await newThread.setLocked(true);
      } catch (error) {
        console.warn(`スレッド ${thread.name} の作成に失敗しました:`, error);
      }
    }

    // ロールの作成
    const roleMap = new Map();
    for (const role of (backupData.roles || []).sort((a, b) => a.position - b.position)) {
      try {
        const newRole = await guild.roles.create({
          name: role.name,
          colors: [role.color], // colors を使用
          position: role.position,
          permissions: role.permissions ? BigInt(role.permissions) : 0n,
        });
        roleMap.set(role.id, newRole.id);
      } catch (error) {
        console.warn(`ロール ${role.name} の作成に失敗しました:`, error);
      }
    }

    // 絵文字の復元
    for (const emoji of backupData.emojis || []) {
      try {
        if (emoji.url) {
          await guild.emojis.create({
            name: emoji.name,
            attachment: path.join(serverDir, emoji.url),
          });
        }
      } catch (error) {
        console.warn(`絵文字 ${emoji.name} の作成に失敗しました:`, error);
      }
    }

    // スタンプの復元
    for (const sticker of backupData.stickers || []) {
      try {
        if (sticker.url) {
          await guild.stickers.create({
            name: sticker.name,
            file: path.join(serverDir, sticker.url),
          });
        }
      } catch (error) {
        console.warn(`スタンプ ${sticker.name} の作成に失敗しました:`, error);
      }
    }

    // カスタムAutoModルールの復元
    for (const rule of backupData.autoModRules || []) {
      try {
        await guild.autoModerationRules.create({
          name: rule.name,
          triggerType: rule.triggerType,
          actions: rule.actions,
          enabled: rule.enabled,
          triggerMetadata: rule.triggerMetadata || {},
        });
      } catch (error) {
        console.warn(`AutoModルール ${rule.name} の作成に失敗しました:`, error);
      }
    }

    // BANの復元
    for (const ban of backupData.bans || []) {
      try {
        await guild.bans.create(ban.userId, { reason: ban.reason });
      } catch (error) {
        console.warn(`ユーザー ${ban.userId} のBAN復元に失敗しました:`, error);
      }
    }

    // 展開したディレクトリを削除
    try {
      await rm(serverDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`展開ディレクトリの削除に失敗: ${serverDir}`, error);
    }

  } catch (error) {
    console.error('バックアップロードエラー:', error);
    await interaction.editReply('バックアップの復元中にエラーが発生しました。');
  }
}

// 許可ユーザー管理
async function manageBackupUsers(interaction, action, userId) {
  await interaction.deferReply();
  try {
    const guild = interaction.guild;
    if (interaction.user.id !== guild.ownerId) {
      await interaction.editReply('この操作はサーバーオーナーのみが行えます。');
      return;
    }

    const backupFile = path.join(BACKUP_DIR, `${guild.id}.json`);
    let backupData;
    try {
      const data = await readFile(backupFile, 'utf-8');
      backupData = JSON.parse(data);
    } catch (error) {
      console.error('バックアップファイルの読み込みに失敗:', error);
      await interaction.editReply('バックアップファイルが見つかりません。');
      return;
    }

    if (!backupData.allowedUsers) {
      backupData.allowedUsers = [guild.ownerId];
    }

    if (action === 'add') {
      if (!backupData.allowedUsers.includes(userId)) {
        backupData.allowedUsers.push(userId);
        await writeFile(backupFile, JSON.stringify(backupData, null, 2));
        await interaction.editReply(`ユーザー ${userId} をバックアップ許可リストに追加しました。`);
      } else {
        await interaction.editReply(`ユーザー ${userId} はすでに許可リストに含まれています。`);
      }
    } else if (action === 'remove') {
      if (userId === guild.ownerId) {
        await interaction.editReply('オーナーIDは削除できません。');
        return;
      }
      backupData.allowedUsers = backupData.allowedUsers.filter(id => id !== userId);
      await writeFile(backupFile, JSON.stringify(backupData, null, 2));
      await interaction.editReply(`ユーザー ${userId} をバックアップ許可リストから削除しました。`);
    }
  } catch (error) {
    console.error('許可ユーザー管理エラー:', error);
    await interaction.editReply('許可ユーザーの管理中にエラーが発生しました。');
  }
}