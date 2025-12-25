import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';
import { modalSubmit } from '../commands/samples/admin.js';

const restrictedPermissions = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels
];

export function handleInteractions(client) {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      if (
        interaction.customId.startsWith("whitelist") ||
        interaction.customId.startsWith("settings") ||
        interaction.customId.startsWith("point") ||
        interaction.customId.startsWith("verify") ||
        interaction.customId.startsWith("vc") ||
        interaction.customId.startsWith("vt") ||
        interaction.customId.startsWith("va") ||
        interaction.customId.startsWith("enabled") ||
        interaction.customId.startsWith("cat") ||
        interaction.customId.startsWith("custom") ||
        interaction.customId.startsWith("edit") ||
        interaction.customId.startsWith("add") ||
        interaction.customId.startsWith("delete") ||
        interaction.customId.startsWith("regex") ||
        interaction.customId.startsWith("rule") ||
        interaction.customId.startsWith("default") ||
        interaction.customId.startsWith("hit") ||
        interaction.customId.startsWith("stand") ||
        interaction.customId.startsWith("mines") ||
        interaction.customId.startsWith("rock") ||
        interaction.customId.startsWith("scissors") ||
        interaction.customId.startsWith("paper") ||
        interaction.customId.startsWith("open") ||
        interaction.customId.startsWith("use") ||
        interaction.customId.startsWith("select") ||
        interaction.customId.startsWith("open_specific_modal") ||
        interaction.customId.startsWith("specific_char_modal") ||
        interaction.customId.startsWith("char")
      ) {
        return;
      }
      else if (interaction.isStringSelectMenu() && interaction.customId === 'rolepanel_select') {
        await interaction.deferReply({ ephemeral: true });
        try {
          const selectedValue = interaction.values[0];
          const [, roleId] = selectedValue.split('_');
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            await interaction.editReply({
              content: 'ロールが見つかりません。管理者にお問い合わせください。',
              ephemeral: true,
            });
            return;
          }
          const hasRestrictedPermissions = restrictedPermissions.some((permission) =>
            role.permissions.has(permission)
          );
          if (hasRestrictedPermissions) {
            await interaction.editReply({
              content: `エラー: ロール <@&${roleId}> には管理者、サーバー管理、ロール管理、またはチャンネル管理の権限が含まれています。このロールは付与できません。`,
              ephemeral: true,
            });
            return;
          }
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(role);
            await interaction.editReply({
              content: `ロール <@&${roleId}> を解除しました！`,
              ephemeral: true,
            });
          } else {
            await member.roles.add(role);
            await interaction.editReply({
              content: `ロール <@&${roleId}> を付与しました！`,
              ephemeral: true,
            });
          }
        } catch (error) {
          console.error('Error in role panel interaction:', error);
          await interaction.editReply({
            content: 'ロール処理中にエラーが発生しました。管理者にお問い合わせください。',
            ephemeral: true,
          });
        }
      }
      else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("shop_select_")) {
        await interaction.deferReply({ ephemeral: true });
        try {
          const [, , channelId, dependent] = interaction.customId.split("_");
          const [roleId, price, index] = interaction.values[0].split("_");
          const guildId = interaction.guild.id;
          const userId = interaction.user.id;
          const currencyName = getCurrencyName(guildId);
          const member = await interaction.guild.members.fetch(userId);
          if (dependent === 'true' && index > 0) {
            const message = await interaction.channel.messages.fetch(interaction.message.id);
            const embed = message.embeds[0];
            const roleLines = embed.description.split('\n');
            const prevRoleId = roleLines[index - 1].match(/<@&(\d+)>/)[1];
            if (!member.roles.cache.has(prevRoleId)) {
              await interaction.editReply({
                content: `エラー: <@&${roleId}> を購入するには先に <@&${prevRoleId}> を購入する必要があります！`
              });
              return;
            }
          }
          const userData = getUserData(guildId, userId);
          if (userData.balance < parseInt(price)) {
            await interaction.editReply({
              content: `残高不足！必要: ${price} ${currencyName}, 現在の残高: ${userData.balance} ${currencyName}`
            });
            return;
          }
          if (member.roles.cache.has(roleId)) {
            await interaction.editReply({
              content: `あなたはすでに <@&${roleId}> を持っています！`
            });
            return;
          }
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            await interaction.editReply({
              content: "ロールが見つかりません。管理者にお問い合わせください。"
            });
            return;
          }
          const hasRestrictedPermissions = restrictedPermissions.some(permission =>
            role.permissions.has(permission)
          );
          if (hasRestrictedPermissions) {
            await interaction.editReply({
              content: `エラー: ロール <@&${roleId}> には管理者、サーバー管理、ロール管理、またはチャンネル管理の権限が含まれています。このロールは購入できません。`,
              ephemeral: true
            });
            return;
          }
          await member.roles.add(roleId);
          userData.balance -= parseInt(price);
          updateUserData(guildId, userId, userData);
          await interaction.editReply({
            content: `<@&${roleId}> を ${price} ${currencyName}で購入しました！現在の残高: ${userData.balance} ${currencyName}`
          });
        } catch (error) {
          console.error("Error in shop select:", error);
          await interaction.editReply({
            content: "ロールの購入中にエラーが発生しました。管理者にお問い合わせください。"
          });
        }
      }
      else if (!interaction.guild.members.me.permissions.has(['SendMessages', 'ManageRoles', 'ManageChannels', 'ModerateMembers'])) {
        await interaction.reply({
          content: 'ボットに必要な権限（メッセージ送信、ロール管理、チャンネル管理、メンバー管理）がありません！',
          ephemeral: true
        });
        return;
      }
      else if (interaction.customId.startsWith("ticket_")) {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ ephemeral: true });
        try {
          const userId = interaction.user.id;
          const parts = interaction.customId.split("_");
          if (parts.length < 3) {
            return interaction.editReply({ content: "パネル設定が不十分、または、サポートが終了した形式です。新しいチケットパネルを作成してください。" });
          }
          const supportRoleId = parts[1];
          const parentChannelId = parts[2];
          const parentChannel = await interaction.guild.channels.fetch(parentChannelId).catch(() => null);
          if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
            return interaction.editReply({ content: "指定された親チャンネルが見つからないか、テキストチャンネルではありません。" });
          }
          const activeThreads = await parentChannel.threads.fetchActive();
          const existingThread = activeThreads.threads.find(t => 
            t.topic?.includes(`creator:${userId}|`)
          );
          if (existingThread) {
            return interaction.editReply({
              content: `既にチケットが存在します → ${existingThread}\n既存のチケットを閉じるか削除してから新しいチケットを作成してください。`
            });
          }
          const thread = await parentChannel.threads.create({
            name: `ticket-${userId}-${Date.now()}`,
            type: ChannelType.PrivateThread,
            invitable: false,
            reason: `Ticket created by ${interaction.user.tag}`,
          });
          await thread.members.add(userId);
          const welcomeEmbed = new EmbedBuilder()
            .setTitle('Ticket')
            .setDescription(`Welcome ${interaction.user}！\nお問い合わせ内容を記載してください。`)
            .setColor('#00FF00')
            .setTimestamp();
          const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tlock_${thread.id}`).setLabel('🔒️ ロック').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`tunlock_${thread.id}`).setLabel('🔓️ アンロック').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId(`tclose_${thread.id}`).setLabel('🔐 閉じる').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`topen_${thread.id}`).setLabel('📫️ 開く').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId(`tdelete_${thread.id}`).setLabel('🗑️ 削除').setStyle(ButtonStyle.Danger)
          );
          const userRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`tuserdelete_${thread.id}`)
              .setLabel('🚮 自分で削除する')
              .setStyle(ButtonStyle.Danger)
          );
          await thread.send({
            content: `<@&${supportRoleId}>`,
            embeds: [welcomeEmbed],
            components: [adminRow, userRow]
          });
          await interaction.editReply({ content: `チケットを作成しました: ${thread}` });
        } catch (error) {
          await interaction.editReply({ content: "チケット作成中にエラーが発生しました。管理者にお問い合わせください。" })
            .catch(err => console.error("Failed to edit reply:", err));
        }
      }
      else if (
        interaction.customId.startsWith("tlock_") ||
        interaction.customId.startsWith("tunlock_") ||
        interaction.customId.startsWith("tclose_") ||
        interaction.customId.startsWith("topen_") ||
        interaction.customId.startsWith("tdelete_")
      ) {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ ephemeral: true });
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ content: 'この操作は管理者のみ実行できます。' });
          }
          const threadId = interaction.customId.split("_")[1];
          const thread = await interaction.guild.channels.fetch(threadId).catch(() => null);
          if (!thread || !thread.isThread()) {
            return interaction.editReply({ content: 'スレッドが見つかりません。' });
          }
          const createButtonRow = () => {
            const locked = thread.locked ?? false;
            const archived = thread.archived ?? false;
            return [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tlock_${thread.id}`).setLabel('🔒️ ロック').setStyle(ButtonStyle.Primary).setDisabled(locked),
                new ButtonBuilder().setCustomId(`tunlock_${thread.id}`).setLabel('🔓️ アンロック').setStyle(ButtonStyle.Secondary).setDisabled(!locked),
                new ButtonBuilder().setCustomId(`tclose_${thread.id}`).setLabel('🔐 閉じる').setStyle(ButtonStyle.Secondary).setDisabled(archived),
                new ButtonBuilder().setCustomId(`topen_${thread.id}`).setLabel('📫️ 開く').setStyle(ButtonStyle.Secondary).setDisabled(!archived),
                new ButtonBuilder().setCustomId(`tdelete_${thread.id}`).setLabel('🗑️ 削除').setStyle(ButtonStyle.Danger)
              ),
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tuserdelete_${thread.id}`).setLabel('🚮 自分で削除する').setStyle(ButtonStyle.Danger)
              )
            ];
          };
          let message;
          try {
            message = await thread.messages.fetch(interaction.message.id).catch(() => null);
          } catch (_) {}
          if (interaction.customId.startsWith("tlock_")) {
            await thread.setLocked(true);
            await interaction.editReply({ content: `スレッド ${thread} をロックしました。` });
          }
          else if (interaction.customId.startsWith("tunlock_")) {
            await thread.setLocked(false);
            await interaction.editReply({ content: `スレッド ${thread} をアンロックしました。` });
          }
          else if (interaction.customId.startsWith("tclose_")) {
            await thread.setArchived(true);
            await interaction.editReply({ content: `スレッド ${thread} を閉じました（アーカイブ）。` });
          }
          else if (interaction.customId.startsWith("topen_")) {
            await thread.setArchived(false);
            await interaction.editReply({ content: `スレッド ${thread} を再開しました。` });
          }
          else if (interaction.customId.startsWith("tdelete_")) {
            await interaction.editReply({ content: `スレッド ${thread} を削除しました。` });
            await thread.delete();
            return;
          }
          if (message) {
            await message.edit({ components: createButtonRow() }).catch(() => {});
          }
        } catch (error) {
          console.error("Error in ticket action:", error);
          await interaction.editReply({ content: "チケット操作中にエラーが発生しました。管理者にお問い合わせください。" })
            .catch(err => console.error("Failed to edit reply:", err));
        }
      }
      else if (interaction.customId.startsWith("tuserdelete_")) {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ ephemeral: true });
        try {
          const threadId = interaction.customId.split("_")[1];
          const thread = interaction.channel.id === threadId ? interaction.channel : await interaction.guild.channels.fetch(threadId);
          if (!thread?.isThread()) return interaction.editReply({ content: 'スレッドが見つかりません。' });
          const parts = thread.name.split('-');
          if (parts.length !== 3) return interaction.editReply({ content: 'チケット情報が壊れています。' });
          const creatorId = parts[1];
          const createdAt = parseInt(parts[2]);
          if (interaction.user.id !== creatorId) {
            return interaction.editReply({ content: '作成者本人しか削除できません。' });
          }
          if (Date.now() - createdAt < 300000) {
            const remain = Math.ceil((300000 - (Date.now() - createdAt)) / 1000);
            return interaction.editReply({ content: `あと ${remain}秒 お待ちください。` });
          }
          await interaction.editReply({ content: '削除中...' });
          await thread.send({ content: `${interaction.user} がチケットを自分で削除しました。` }).catch(() => {});
          await thread.delete();
        } catch (error) {
          await interaction.editReply({ content: "削除処理中にエラーが発生しました。" })
            .catch(() => {});
        }
      }
      else {
        await interaction.reply({
          content: 'このボタンは無効です。\nミスだと思われる場合はサポートサーバーで報告ください。',
          ephemeral: true
        });
      }
    }
    else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('admin_')) {
        await modalSubmit(interaction);
      }
    }
  });
}