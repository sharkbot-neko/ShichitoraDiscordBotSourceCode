import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { getUserData, updateUserData, getGuildRanking, getCurrencyName, setCurrencyName } from '../../utils/db.js';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName('money')
  .setDescription('通貨関連のコマンド')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('ユーザーまたはロールに通貨を付与します')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('付与する通貨量')
          .setRequired(true)
          .setMinValue(1))
      .addUserOption(option =>
        option.setName('user')
          .setDescription('対象ユーザー')
          .setRequired(false))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('対象ロール')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('ユーザーの通貨を減らします')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('対象ユーザー')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('減らす通貨量')
          .setRequired(true)
          .setMinValue(1)))
  .addSubcommandGroup(group =>
    group
      .setName('shop')
      .setDescription('ショップパネルの管理')
      .addSubcommand(sub =>
        sub
          .setName('create')
          .setDescription('ロール購入パネルを作成します')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('パネルを作成するチャンネル')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('role1')
              .setDescription('ロール1')
              .setRequired(true))
          .addIntegerOption(option =>
            option.setName('price1')
              .setDescription('ロール1の価格（通貨）')
              .setRequired(true)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role2')
              .setDescription('ロール2')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price2')
              .setDescription('ロール2の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role3')
              .setDescription('ロール3')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price3')
              .setDescription('ロール3の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role4')
              .setDescription('ロール4')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price4')
              .setDescription('ロール4の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role5')
              .setDescription('ロール5')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price5')
              .setDescription('ロール5の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role6')
              .setDescription('ロール6')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price6')
              .setDescription('ロール6の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role7')
              .setDescription('ロール7')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price7')
              .setDescription('ロール7の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role8')
              .setDescription('ロール8')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price8')
              .setDescription('ロール8の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role9')
              .setDescription('ロール9')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price9')
              .setDescription('ロール9の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addRoleOption(option =>
            option.setName('role10')
              .setDescription('ロール10')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('price10')
              .setDescription('ロール10の価格（通貨）')
              .setRequired(false)
              .setMinValue(1))
          .addBooleanOption(option =>
            option.setName('dependent')
              .setDescription('ロール購入に依存関係を設定する（trueで有効）')
              .setRequired(false)))
      .addSubcommand(sub =>
        sub
          .setName('delete')
          .setDescription('ロール購入パネルを削除します')
          .addStringOption(option =>
            option.setName('message_id')
              .setDescription('削除するパネルのメッセージID')
              .setRequired(true))))
  .addSubcommand(subcommand =>
    subcommand
      .setName('balance')
      .setDescription('通貨残高を表示します')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('確認するユーザー（省略時は自分）')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('ranking')
      .setDescription('サーバーの通貨ランキングを表示します'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('send')
      .setDescription('他のユーザーに通貨を譲渡します')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('譲渡するユーザー')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('譲渡する通貨数')
          .setRequired(true)
          .setMinValue(1)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setcurrency')
      .setDescription('サーバーの通貨名を設定します')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('新しい通貨名')
          .setRequired(true)));

export async function execute(interaction) {
  await interaction.deferReply();
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const currencyName = getCurrencyName(guildId);

  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
  if (['add', 'remove', 'shop', 'setcurrency'].includes(subcommandGroup || subcommand) && !isAdmin) {
    return interaction.editReply({
      content: 'このコマンドは管理者権限が必要です！',
      ephemeral: true,
    });
  }

  try {
    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount');
      const targetUser = interaction.options.getUser('user');
      const targetRole = interaction.options.getRole('role');

      if (targetUser && targetRole) {
        return interaction.editReply('ユーザーとロールの両方を指定することはできません！');
      }
      if (!targetUser && !targetRole) {
        return interaction.editReply('ユーザーまたはロールのどちらかを指定してください！');
      }

      await interaction.guild.members.fetch();

      if (targetUser) {
        const userData = getUserData(guildId, targetUser.id);
        userData.balance = (userData.balance || 0) + amount;
        updateUserData(guildId, targetUser.id, userData);
        await interaction.editReply(
          `${targetUser.tag} に ${amount} ${currencyName}を付与しました。現在の残高: ${userData.balance} ${currencyName}`
        );
      } else {
        const roleMembers = interaction.guild.members.cache.filter(member =>
          member.roles.cache.has(targetRole.id)
        );
        if (roleMembers.size === 0) {
          return interaction.editReply(`ロール ${targetRole.name} を持つメンバーがいません！`);
        }
        let updatedCount = 0;
        roleMembers.forEach(member => {
          const userData = getUserData(guildId, member.id);
          userData.balance = (userData.balance || 0) + amount;
          updateUserData(guildId, member.id, userData);
          updatedCount++;
        });
        await interaction.editReply(
          `ロール ${targetRole.name} の ${updatedCount} 人に ${amount} ${currencyName}を付与しました。`
        );
      }
    } else if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const userData = getUserData(guildId, targetUser.id);

      if (userData.balance < amount) {
        return interaction.editReply(`エラー: 残高が不足しています。`);
      }
      userData.balance -= amount;
      updateUserData(guildId, targetUser.id, userData);
      await interaction.editReply(
        `${targetUser.tag} から ${amount} ${currencyName}を減らしました。現在の残高: ${userData.balance} ${currencyName}`
      );
    } else if (subcommandGroup === 'shop') {
      if (subcommand === 'create') {
        const channel = interaction.options.getChannel('channel');
        const dependent = interaction.options.getBoolean('dependent') || false;
        const roles = [];
        for (let i = 1; i <= 10; i++) {
          const role = interaction.options.getRole(`role${i}`);
          const price = interaction.options.getInteger(`price${i}`);
          if (role && price) {
            roles.push({ roleId: role.id, price, name: role.name });
          } else if (role && !price) {
            return interaction.editReply(`ロール${i}の価格を指定してください！`);
          } else if (!role && price) {
            return interaction.editReply(`価格${i}に対応するロールを指定してください！`);
          }
        }
        if (roles.length === 0) {
          return interaction.editReply('少なくとも1つのロールと価格を指定してください！');
        }
        const embed = new EmbedBuilder()
          .setTitle('Role Shop')
          .setDescription(roles.map((r, i) => {
            const dependency = dependent && i > 0 ? `（要：<@&${roles[i-1].roleId}>）` : '';
            return `<@&${r.roleId}> - ${r.price} ${currencyName} ${dependency}`;
          }).join('\n'))
          .setColor(0x00ff00);
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`shop_select_${channel.id}_${dependent}`)
          .setPlaceholder('購入するロールを選択')
          .addOptions(roles.map((r, i) => ({
            label: r.name,
            description: `${r.price} ${currencyName}${dependent && i > 0 ? ` (要: ${roles[i-1].name})` : ''}`,
            value: `${r.roleId}_${r.price}_${i}`
          })));
        const components = [new ActionRowBuilder().addComponents(selectMenu)];
        const message = await channel.send({ embeds: [embed], components });
        await interaction.editReply(`ロールショップパネルを ${channel} に作成しました！メッセージID: ${message.id}`);
      } else if (subcommand === 'delete') {
        const messageId = interaction.options.getString('message_id');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        try {
          const message = await channel.messages.fetch(messageId);
          await message.delete();
          await interaction.editReply(`メッセージID ${messageId} のパネルを削除しました。`);
        } catch (error) {
          await interaction.editReply('指定されたメッセージIDのパネルが見つかりません！');
        }
      }
    } else if (subcommand === 'balance') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userData = getUserData(guildId, targetUser.id);
      const balance = userData.balance || 0;
      await interaction.editReply(`${targetUser.tag} の残高: ${balance} ${currencyName}`);
    } else if (subcommand === 'ranking') {
      const ranking = getGuildRanking(guildId);
      await interaction.guild.members.fetch();
      if (ranking.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('通貨ランキング')
            .setDescription('ランキングデータがありません。')
            .setColor(0xFF0000)
            .setTimestamp()]
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${currencyName} Ranking`)
        .setDescription(ranking
          .slice(0, 10)
          .map((user, index) => {
            const member = interaction.guild.members.cache.get(user.userId);
            return `${index + 1}. ${member?.user.tag || 'Unknown User'}: ${user.balance} ${currencyName}`;
          })
          .join('\n'))
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: `総計 ${ranking.length} ユーザー` });

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'send') {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const now = Date.now();
      const oneMinuteMs = 60 * 1000;

      if (targetUser.id === userId) {
        return interaction.editReply(`自分自身に${currencyName}を譲渡できません！`);
      }
      if (targetUser.bot) {
        return interaction.editReply(`ボットに${currencyName}を譲渡できません！`);
      }
      const userData = getUserData(guildId, userId);
      if (userData.lastGive && now - userData.lastGive < oneMinuteMs) {
        const resetTime = new Date(userData.lastGive + oneMinuteMs).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        return interaction.editReply(`次の譲渡は ${resetTime} に可能です！`);
      }
      if (userData.balance < amount) {
        return interaction.editReply(`残高不足！必要: ${amount} ${currencyName}, 現在の残高: ${userData.balance} ${currencyName}`);
      }
      const targetData = getUserData(guildId, targetUser.id);
      userData.balance -= amount;
      userData.lastGive = now;
      targetData.balance = (targetData.balance || 0) + amount;
      updateUserData(guildId, userId, userData);
      updateUserData(guildId, targetUser.id, targetData);
      const embed = new EmbedBuilder()
        .setTitle(`💸 ${currencyName}譲渡`)
        .setDescription(`<@${userId}> が <@${targetUser.id}> に ${amount} ${currencyName}を譲渡しました！`)
        .addFields(
          { name: '譲渡者の残高', value: `${userData.balance} ${currencyName}`, inline: true },
          { name: '受取人の残高', value: `${targetData.balance} ${currencyName}`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed], ephemeral: false });
    } else if (subcommand === 'setcurrency') {
      const newCurrencyName = interaction.options.getString('name');
      if (newCurrencyName.length > 100) {
        return interaction.editReply('通貨名は100文字以内にしてください！');
      }
      setCurrencyName(guildId, newCurrencyName);
      await interaction.editReply(`通貨名を「${newCurrencyName}」に設定しました！`);
    }
  } catch (error) {
    console.error(`Error in money ${subcommandGroup ? `${subcommandGroup} ${subcommand}` : subcommand}:`, error);
    await interaction.editReply({
      content: 'コマンドの実行中にエラーが発生しました。管理者にお問い合わせください。',
      ephemeral: true,
    });
  }
}
