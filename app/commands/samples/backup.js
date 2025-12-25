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

export async function execute(interaction) {
// このコードは非公開です。
}
