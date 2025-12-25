// 7n6r(1140963618423312436) only

import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationIntegrationType,
  InteractionContextType
} from 'discord.js';
import { readdir, unlink } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import 'dotenv/config';

const ADMIN_ID = '1140963618423312436';
const DEV_WEBHOOK = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('【開発者専用】ボット管理コマンド')
  .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
  .setDMPermission(true)
  .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('実行する操作')
      .setRequired(true)
      .addChoices(
        { name: '不要データ全削除', value: 'cleanupFiles' },
        { name: 'ボットBAN設定', value: 'botBan' },
        { name: '強制サーバー退出', value: 'serverLeave' },
        { name: 'サーバー参加確認', value: 'checkServer' },
        { name: '参加サーバーリスト', value: 'serverList' },
        { name: 'カスタムメッセージ', value: 'customMessage' },
        { name: 'タイムアウト (要申請)', value: 'timeOut' },
        { name: 'タイムアウト解除 (要申請)', value: 'unTimeOut' },
        { name: 'キック (要申請)', value: 'kick' },
        { name: 'BAN (要申請)', value: 'ban' },
        { name: 'BAN解除 (要申請)', value: 'unBan' },
        { name: 'ロール付与 (要申請)', value: 'addRole' },
        { name: 'ロール剥奪 (要申請)', value: 'removeRole' },
        { name: 'ロール作成 (要申請)', value: 'createRole' },
        { name: 'ロール編集 (要申請)', value: 'editRole' },
        { name: 'ロール削除 (要申請)', value: 'deleteRole' },
        { name: 'チャンネル作成 (要申請)', value: 'createChannel' },
        { name: 'チャンネル編集 (要申請)', value: 'editChannel' },
        { name: 'チャンネル削除 (要申請)', value: 'deleteChannel' },
        { name: 'メッセージクリア (要申請)', value: 'messageClear' },
        { name: 'メッセージ削除 (要申請)', value: 'messageDelete' },
        { name: 'イベント作成 (要申請)', value: 'createEvent' },
        { name: 'イベント削除 (要申請)', value: 'deleteEvent' },
        { name: 'ニックネーム設定 (要申請)', value: 'setNick' }
      )
  );

// execute
export async function execute(interaction) {
// このコードは非公開です。
}
