import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ApplicationIntegrationType,
  InteractionContextType
} from 'discord.js';
import { getUserData, updateUserData, getCurrencyName } from '../../utils/db.js';

// ブラックジャック
const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  return suits.flatMap(suit => values.map(value => ({ suit, value })));
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.value === 'A') {
      aces += 1;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  for (let i = 0; i < aces; i++) {
    if (value + 11 <= 21) {
      value += 11;
    } else {
      value += 1;
    }
  }
  return value;
}

function formatHand(hand) {
  return hand.map(card => `${card.value}${card.suit}`).join(' ');
}

// Minesゲーム
function createGridButtons(state, userId) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < 5; j++) {
      const index = i * 5 + j;
      const isSelected = state.selected.includes(index);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines_${userId}_${index}`)
          .setLabel(isSelected ? '✅' : '⬜')
          .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(state.gameOver || isSelected)
      );
    }
    rows.push(row);
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mines_${userId}_cashout`)
        .setLabel('キャッシュアウト')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state.gameOver || state.safeCount === 0),
      new ButtonBuilder()
        .setCustomId(`mines_${userId}_reset`)
        .setLabel('リセット')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(state.gameOver)
    )
  );
  return rows;
}

function revealGrid(grid, state, userId) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < 5; j++) {
      const index = i * 5 + j;
      const isSelected = state.selected.includes(index);
      const isBomb = grid[index] === 'bomb';
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines_${userId}_${index}`)
          .setLabel(isBomb ? '💣' : isSelected ? '✅' : '⬜')
          .setStyle(isBomb ? ButtonStyle.Danger : isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(true)
      );
    }
    rows.push(row);
  }
  return rows;
}

function calculatePayout(state) {
  const { bet, safeCount, bombs } = state;
  if (safeCount === 0) return 0;
  const multiplier = 1 + (safeCount * bombs / 4) / (20 - bombs);
  return bet * multiplier;
}

// じゃんけんのヘルパー関数（変更なし）
async function janken(confirmation) {
  const hands = { rock: "0", scissors: "1", paper: "2" };
  const handsEmoji = [":fist:", ":v:", ":hand_splayed:"];
  const botHand = Math.floor(Math.random() * 3);
  const playersHand = hands[confirmation.customId];
  const solve = (botHand - playersHand + 3) % 3;
  const playersHandButton = new ButtonBuilder()
    .setCustomId("playersHand")
    .setEmoji(confirmation.component.emoji)
    .setLabel(`${confirmation.component.label}を出したよ`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  const confirmedRow = new ActionRowBuilder().addComponents(playersHandButton);
  const text = confirmation.message.content.includes("じゃんけん") ? "じゃんけん...\nぽん！" : "あいこで...\nしょ！";
  await confirmation.update({
    content: `${text}${handsEmoji[botHand]}`,
    components: [confirmedRow],
  });
  return solve;
}

export const data = new SlashCommandBuilder()
  .setName('game')
  .setDescription('さまざまなゲームをプレイします')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('blackjack')
      .setDescription('ブラックジャックをプレイします')
      .addIntegerOption(option =>
        option.setName('bet').setDescription('賭ける通貨数').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('dice')
      .setDescription('ダイスゲームで運試し！')
      .addIntegerOption(option =>
        option.setName('bet').setDescription('賭ける通貨数').setRequired(true).setMinValue(1)
      )
      .addIntegerOption(option =>
        option
          .setName('roll_over')
          .setDescription('ロールオーバーの基準値（1～99）')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(99)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('gacha').setDescription('ガチャを引く')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('janken').setDescription('じゃんけんで対決')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('life').setDescription('2時間に1回の人生ゲーム！運試しをしよう！')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('lottery').setDescription('1日1回の宝くじを引きます！')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('luck_color').setDescription('ラッキーカラーを占う')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('mines')
      .setDescription('Minesゲームをプレイします。爆弾を避けて報酬を獲得！')
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription('掛け金（通貨）')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(9999999)
      )
      .addIntegerOption(option =>
        option
          .setName('bombs')
          .setDescription('爆弾の数（1～19）')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(19)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('race')
      .setDescription('競馬レースにベット！')
      .addIntegerOption(option =>
        option
          .setName('horse')
          .setDescription('ベットする馬（1～4）')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(4)
      )
      .addIntegerOption(option =>
        option.setName('bet').setDescription('賭ける通貨数').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('slots')
      .setDescription('スロットをプレイします！')
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription('賭ける通貨数')
          .setRequired(true)
          .setMinValue(5)
          .setMaxValue(10000)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('coinflip')
      .setDescription('コインを投げて表か裏を予想！')
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription('賭ける通貨数')
          .setRequired(true)
          .setMinValue(5)
          .setMaxValue(2500)
      )
      .addStringOption(option =>
        option
          .setName('guess')
          .setDescription('表（heads）か裏（tails）を選択')
          .setRequired(true)
          .addChoices(
            { name: '表', value: 'heads' },
            { name: '裏', value: 'tails' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('work')
      .setDescription('労働して通貨を獲得します（1時間に1回）')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const currencyName = getCurrencyName(guildId);

  if (subcommand === 'blackjack') {
    const bet = interaction.options.getInteger('bet');
    const userData = getUserData(guildId, userId);
    if (userData.balance < bet) {
      return interaction.reply({ content: `エラー: 残高が不足しています。`, ephemeral: true });
    }
    await interaction.deferReply();
    let deck = shuffleDeck(createDeck());
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    let playerValue = calculateHandValue(playerHand);
    let dealerValue = calculateHandValue(dealerHand);
    let messageContent = `**ブラックジャック**\nあなたのハンド: ${formatHand(playerHand)} (合計: ${playerValue})\nディーラーのハンド: ${dealerHand[0].value}${dealerHand[0].suit} ??\n\nヒットしますか？`;
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('hit').setLabel('ヒット').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stand').setLabel('スタンド').setStyle(ButtonStyle.Secondary)
      );
    await interaction.editReply({ content: messageContent, components: [row] });
    const filter = i => i.user.id === userId && ['hit', 'stand'].includes(i.customId);
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
    collector.on('collect', async i => {
      if (i.customId === 'hit') {
        playerHand.push(deck.pop());
        playerValue = calculateHandValue(playerHand);
        if (playerValue > 21) {
          userData.balance -= bet;
          updateUserData(guildId, userId, userData);
          await i.update({
            content: `**ブラックジャック**\nあなたのハンド: ${formatHand(playerHand)} (合計: ${playerValue})\nディーラーのハンド: ${formatHand(dealerHand)} (合計: ${dealerValue})\n\nバースト！あなたは ${bet} ${currencyName}を失いました。\n現在の残高: ${userData.balance} ${currencyName}`,
            components: [],
          });
          collector.stop();
          return;
        }
        await i.update({
          content: `**ブラックジャック**\nあなたのハンド: ${formatHand(playerHand)} (合計: ${playerValue})\nディーラーのハンド: ${dealerHand[0].value}${dealerHand[0].suit} ??\n\nヒットしますか？`,
          components: [row],
        });
      } else if (i.customId === 'stand') {
        while (dealerValue < 17) {
          dealerHand.push(deck.pop());
          dealerValue = calculateHandValue(dealerHand);
        }
        let result = '';
        let payout = 0;
        if (dealerValue > 21 || playerValue > dealerValue) {
          payout = bet * 2;
          userData.balance += payout;
          result = `あなたの勝ち！${payout} ${currencyName}獲得！`;
        } else if (playerValue < dealerValue) {
          userData.balance -= bet;
          result = `ディーラーの勝ち。${bet} ${currencyName}を失いました。`;
        } else {
          result = `引き分け！${currencyName}は返却されます。`;
        }
        updateUserData(guildId, userId, userData);
        await i.update({
          content: `**ブラックジャック**\nあなたのハンド: ${formatHand(playerHand)} (合計: ${playerValue})\nディーラーのハンド: ${formatHand(dealerHand)} (合計: ${dealerValue})\n\n${result}\n現在の残高: ${userData.balance} ${currencyName}`,
          components: [],
        });
        collector.stop();
      }
    });
    collector.on('end', async () => {
      if (interaction.components?.length) {
        await interaction.editReply({ components: [] });
      }
    });
  } else if (subcommand === 'dice') {
    await interaction.deferReply();
    const bet = interaction.options.getInteger('bet');
    const rollOver = interaction.options.getInteger('roll_over');
    try {
      const userData = getUserData(guildId, userId);
      if (userData.balance < bet) {
        return interaction.editReply({
          content: `残高不足！必要: ${bet} ${currencyName}, 現在の残高: ${userData.balance} ${currencyName}`,
          ephemeral: true,
        });
      }
      const roll = Math.floor(Math.random() * 100) + 1;
      const win = roll > rollOver;
      const multiplier = 100 / (100 - rollOver);
      const payout = win ? Math.floor(bet * multiplier) : 0;
      userData.balance = userData.balance - bet + payout;
      updateUserData(guildId, userId, userData);
      const embed = new EmbedBuilder()
        .setTitle('🎲 ダイスゲーム')
        .setDescription('ダイスを振っています…')
        .setColor(0xFFD700);
      const message = await interaction.editReply({ embeds: [embed] });
      await new Promise(resolve => setTimeout(resolve, 1000));
      embed
        .setDescription(`🎲 結果: **${roll}** (${win ? '勝利！' : '敗北…'})`)
        .addFields(
          { name: '賭け金', value: `${bet} ${currencyName}`, inline: true },
          { name: 'ロールオーバー', value: `${rollOver}`, inline: true },
          { name: '配当', value: `${payout} ${currencyName}`, inline: true },
          { name: '残高', value: `${userData.balance} ${currencyName}`, inline: true }
        )
        .setColor(win ? 0x00FF00 : 0xFF0000);
      await message.edit({ embeds: [embed] });
    } catch (error) {
      console.error('Error in dice:', error);
      await interaction.editReply({
        content: 'ダイスゲームの実行中にエラーが発生しました。管理者にお問い合わせください。',
        ephemeral: true,
      });
    }
  } else if (subcommand === 'gacha') {
    await interaction.deferReply();
    const arr = [
      "UR <:boost_tear_8:1372111993393123338>",
      "SSR <:boost_tear_7:1372111976104460328>",
      "SR <:boost_tear_6:1372111954419908650>",
      "R <:boost_tear_5:1372111930810175558>",
      "NR <:boost_tear_4:1372111906298531882>",
      "UC <:boost_tear_3:1372111891861864458>",
      "C <:boost_tear_2:1372111872735711322>",
      "UN <:boost_tear_1:1372111855027224607>",
      "N <:boost_tear_0:1372111836396126280>",
    ];
    const weight = [1, 2, 4, 8, 12, 16, 16, 16, 20];
    let result = "";
    let totalWeight = 0;
    for (let i = 0; i < weight.length; i++) {
      totalWeight += weight[i];
    }
    let random = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < weight.length; i++) {
      if (random < weight[i]) {
        result = arr[i];
        break;
      } else {
        random -= weight[i];
      }
    }
    await interaction.editReply(`${result} が当選しました！`);
  } else if (subcommand === 'janken') {
    await interaction.deferReply();
    const rock = new ButtonBuilder()
      .setCustomId('rock')
      .setEmoji('✊')
      .setLabel('グー')
      .setStyle(ButtonStyle.Primary);
    const scissors = new ButtonBuilder()
      .setCustomId('scissors')
      .setEmoji('✌')
      .setLabel('チョキ')
      .setStyle(ButtonStyle.Primary);
    const paper = new ButtonBuilder()
      .setCustomId('paper')
      .setEmoji('🖐️')
      .setLabel('パー')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(rock, scissors, paper);
    const response = await interaction.editReply({
      content: `じゃんけん...`,
      components: [row],
    });
    try {
      const result = ['(あいこ)', 'あなたの勝ちだ...', '僕の勝ち！！！'];
      const collectorFilter = i => i.user.id === userId;
      let confirmation = await response.awaitMessageComponent({
        filter: collectorFilter,
        time: 30000,
      });
      let solve = await janken(confirmation);
      while (solve === 0) {
        await confirmation.followUp({
          content: `あいこで...`,
          components: [row],
        });
        confirmation = await response.awaitMessageComponent({
          filter: collectorFilter,
          time: 30000,
        });
        solve = await janken(confirmation);
      }
      await confirmation.followUp(result[solve]);
    } catch (e) {
      await interaction.editReply({
        content: '時間切れ(もしくはエラー)',
        components: [],
      });
    }
  } else if (subcommand === 'life') {
    await interaction.deferReply();
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    try {
      const userData = getUserData(guildId, userId);
      if (userData.lastLife && now - userData.lastLife < twoHoursMs) {
        const resetTime = new Date(userData.lastLife + twoHoursMs).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        return interaction.editReply({
          content: `次の人生ゲームは ${resetTime} にプレイできます！`,
          ephemeral: true,
        });
      }
      const events = [
        { type: 'good', chance: 0.15, message: '💼 就職成功！', amount: 100 },
        { type: 'good', chance: 0.05, message: '🎉 宝くじ当選！', amount: 500 },
        { type: 'good', chance: 0.10, message: '💒 結婚祝い！', amount: 200 },
        { type: 'good', chance: 0.10, message: '👶 子供ができた！', amount: 300 },
        { type: 'good', chance: 0.10, message: '🍀 四つ葉のクローバーを見つけた！', amount: 750 },
        { type: 'good', chance: 0.10, message: '♥️ 彼女/彼氏ができた！', amount: 400 },
        { type: 'bad', chance: 0.10, message: '💸 借金返済…', amount: -350 },
        { type: 'bad', chance: 0.05, message: '🏥 病気で入院…', amount: -100 },
        { type: 'bad', chance: 0.05, message: '🚓 罰金支払い…', amount: -400 },
        { type: 'bad', chance: 0.05, message: '🖥️ 機材の故障…', amount: -200 },
        { type: 'neutral', chance: 0.25, message: '🌳 何も起こらず', amount: 0 },
        { type: 'neutral', chance: 0.25, message: '✈️ 旅行したが楽しかっただけ', amount: 0 },
        { type: 'neutral', chance: 0.25, message: '👣 散歩をしてもなにもなかった', amount: 0 },
      ];
      const rand = Math.random();
      let cumulativeChance = 0;
      let selectedEvent = events[events.length - 1];
      for (const event of events) {
        cumulativeChance += event.chance;
        if (rand <= cumulativeChance) {
          selectedEvent = event;
          break;
        }
      }
      let amount = selectedEvent.amount;
      if (amount < 0 && userData.balance < Math.abs(amount)) {
        amount = -userData.balance;
      }
      userData.balance = (userData.balance || 0) + amount;
      userData.lastLife = now;
      updateUserData(guildId, userId, userData);
      const embed = new EmbedBuilder()
        .setTitle('🎲 人生ゲーム')
        .setDescription(`${selectedEvent.message}`)
        .addFields(
          { name: '結果', value: `${amount >= 0 ? '+' : ''}${amount} ${currencyName}`, inline: true },
          { name: '現在の残高', value: `${userData.balance} ${currencyName}`, inline: true }
        )
        .setColor(amount > 0 ? 0x00FF00 : amount < 0 ? 0xFF0000 : 0x808080)
        .setFooter({ text: '2時間後にまた挑戦！' })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in life:', error);
      await interaction.editReply({
        content: '人生ゲームの実行中にエラーが発生しました。管理者にお問い合わせください。',
        ephemeral: true,
      });
    }
  } else if (subcommand === 'lottery') {
    await interaction.deferReply({ ephemeral: true });
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    try {
      const userData = getUserData(guildId, userId);
      if (userData.lastLottery && now - userData.lastLottery < oneDayMs) {
        const resetTime = new Date(userData.lastLottery + oneDayMs).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        return interaction.editReply({
          content: `今日の宝くじはすでに引きました！次は ${resetTime} に挑戦できます。`,
        });
      }
      const rewards = [
        { amount: 0, chance: 0.3 },
        { amount: 50, chance: 0.4 },
        { amount: 200, chance: 0.2 },
        { amount: 500, chance: 0.09 },
        { amount: 1000, chance: 0.01 },
      ];
      const rand = Math.random();
      let cumulativeChance = 0;
      let reward = 0;
      for (const r of rewards) {
        cumulativeChance += r.chance;
        if (rand <= cumulativeChance) {
          reward = r.amount;
          break;
        }
      }
      userData.balance = (userData.balance || 0) + reward;
      userData.lastLottery = now;
      updateUserData(guildId, userId, userData);
      const message = reward > 0
        ? `🎉 おめでとう！${reward} ${currencyName}を獲得しました！現在の残高: ${userData.balance} ${currencyName}`
        : `😔 ハズレ…また明日挑戦してね！現在の残高: ${userData.balance} ${currencyName}`;
      await interaction.editReply({ content: message });
    } catch (error) {
      console.error('Error in lottery:', error);
      await interaction.editReply({
        content: '宝くじの実行中にエラーが発生しました。管理者にお問い合わせください。',
      });
    }
  } else if (subcommand === 'luck_color') {
    await interaction.deferReply();
    const arr = ["赤色", "橙色", "肌色", "黄色", "黄緑", "緑色", "水色", "空色", "青色", "紫色", "桃色", "白色", "灰色", "黒色"];
    const random = Math.floor(Math.random() * arr.length);
    const color = arr[random];
    await interaction.editReply(`ラッキーカラーは \`${color}\` です！`);
  } else if (subcommand === 'mines') {
    await interaction.deferReply();
    const bet = interaction.options.getInteger('bet');
    const bombs = interaction.options.getInteger('bombs');
    const userData = getUserData(guildId, userId);
    if (userData.balance < bet) {
      return interaction.editReply({
        content: `残高不足！現在の残高: ${userData.balance} ${currencyName}`,
        ephemeral: true,
      });
    }
    const grid = Array(20).fill('safe');
    const bombIndices = [];
    while (bombIndices.length < bombs) {
      const index = Math.floor(Math.random() * 20);
      if (!bombIndices.includes(index)) bombIndices.push(index);
    }
    bombIndices.forEach(index => (grid[index] = 'bomb'));
    const state = {
      selected: [],
      safeCount: 0,
      gameOver: false,
      bet,
      bombs,
    };
    await interaction.editReply({
      content: `**Minesゲーム開始！**\n掛け金: ${bet} ${currencyName}\n爆弾: ${bombs} 個\nマスを選択してください（20マス中 ${20 - bombs} 個が安全）。`,
      components: createGridButtons(state, userId),
      ephemeral: true,
    });
    const filter = i => i.user.id === userId && i.customId.startsWith(`mines_${userId}_`);
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600000 });
    collector.on('collect', async i => {
      if (state.gameOver) return;
      const customId = i.customId;
      if (customId === `mines_${userId}_cashout`) {
        state.gameOver = true;
        const payout = calculatePayout(state);
        userData.balance += Math.floor(payout);
        updateUserData(guildId, userId, userData);
        await i.update({
          content: `**ゲーム終了！**\n安全マス: ${state.safeCount} 個\n報酬: ${Math.floor(payout)} ${currencyName}\n現在の残高: ${userData.balance} ${currencyName}`,
          components: revealGrid(grid, state, userId),
        });
        collector.stop();
        return;
      }
      if (customId === `mines_${userId}_reset`) {
        state.selected = [];
        state.safeCount = 0;
        state.gameOver = false;
        await i.update({
          content: `**グリッドをリセット！**\n掛け金: ${bet} ${currencyName}\n爆弾: ${bombs} 個\nマスを選択してください。`,
          components: createGridButtons(state, userId),
        });
        return;
      }
      const index = parseInt(customId.split('_')[2]);
      if (state.selected.includes(index)) {
        await i.reply({ content: 'そのマスはすでに選択済みです！', ephemeral: true });
        return;
      }
      state.selected.push(index);
      if (grid[index] === 'bomb') {
        state.gameOver = true;
        userData.balance -= bet;
        updateUserData(guildId, userId, userData);
        await i.update({
          content: `**ゲームオーバー！**\n爆弾を引きました！\n掛け金 ${bet} ${currencyName}を失いました。\n現在の残高: ${userData.balance} ${currencyName}`,
          components: revealGrid(grid, state, userId),
        });
        collector.stop();
      } else {
        state.safeCount++;
        const payout = calculatePayout(state);
        await i.update({
          content: `**安全マスを選択！**\n安全マス: ${state.safeCount} 個\n現在の報酬: ${Math.floor(payout)} ${currencyName}\n次のマスを選択するか、キャッシュアウトしてください。`,
          components: createGridButtons(state, userId),
        });
      }
    });
    collector.on('end', async () => {
      if (!state.gameOver) {
        await interaction.editReply({
          content: `**ゲーム終了（タイムアウト）**\n安全マス: ${state.safeCount} 個\nキャッシュアウトしなかったため、報酬は0${currencyName}です。`,
          components: [],
        });
      }
    });
  } else if (subcommand === 'race') {
    await interaction.deferReply();
    const horse = interaction.options.getInteger('horse');
    const bet = interaction.options.getInteger('bet');
    try {
      const userData = getUserData(guildId, userId);
      if (userData.balance < bet) {
        return interaction.editReply({
          content: `残高不足！必要: ${bet} ${currencyName}, 現在の残高: ${userData.balance} ${currencyName}`,
        });
      }
      const horses = [
        { id: 1, name: '🐎 馬1', chance: 0.4, multiplier: 1.5 },
        { id: 2, name: '🐎 馬2', chance: 0.3, multiplier: 2.0 },
        { id: 3, name: '🐎 馬3', chance: 0.2, multiplier: 3.0 },
        { id: 4, name: '🐎 馬4', chance: 0.1, multiplier: 5.0 },
      ];
      const rand = Math.random();
      let cumulativeChance = 0;
      let winner = horses[0];
      for (const h of horses) {
        cumulativeChance += h.chance;
        if (rand <= cumulativeChance) {
          winner = h;
          break;
        }
      }
      const payout = horse === winner.id ? Math.floor(bet * winner.multiplier) : 0;
      userData.balance = userData.balance - bet + payout;
      updateUserData(guildId, userId, userData);
      const embed = new EmbedBuilder()
        .setTitle('🏇 競馬レース')
        .setDescription('レース開始！🏁')
        .setColor(0xFFD700);
      const message = await interaction.editReply({ embeds: [embed] });
      await new Promise(resolve => setTimeout(resolve, 2000));
      embed
        .setDescription(`🏁 ${winner.name} が勝利！\nあなたのベット: ${horses[horse - 1].name}`)
        .addFields(
          { name: '賭け金', value: `${bet} ${currencyName}`, inline: true },
          { name: '配当', value: `${payout} ${currencyName}`, inline: true },
          { name: '残高', value: `${userData.balance} ${currencyName}`, inline: true }
        )
        .setColor(payout > 0 ? 0x00FF00 : 0xFF0000);
      await message.edit({ embeds: [embed] });
    } catch (error) {
      console.error('Error in race:', error);
      await interaction.editReply({
        content: 'レースの実行中にエラーが発生しました。管理者にお問い合わせください。',
        ephemeral: true,
      });
    }
  } else if (subcommand === 'slots') {
    await interaction.deferReply();
    const bet = interaction.options.getInteger('bet');
    try {
      const userData = getUserData(guildId, userId);
      if (userData.balance < bet) {
        return interaction.editReply({
          content: `残高不足！必要: ${bet} ${currencyName}, 現在の残高: ${userData.balance} ${currencyName}`,
          ephemeral: true,
        });
      }
      const symbols = ['🍒', '7️⃣', '🔔', '🪙', '⭐', '💎'];
      const reel = Array(3)
        .fill()
        .map(() => symbols[Math.floor(Math.random() * symbols.length)]);
      let multiplier = 0;
      let resultMessage = '';
      if (reel[0] === reel[1] && reel[1] === reel[2]) {
        switch (reel[0]) {
          case '7️⃣':
            multiplier = 50;
            resultMessage = '🔥 大当たり！セブン揃い！';
            break;
          case '🪙':
            multiplier = 30;
            resultMessage = '🪙 当たり！コイン揃い！';
            break;
          case '💎':
            multiplier = 20;
            resultMessage = '💎 ダイヤ揃い！';
            break;
          case '🔔':
            multiplier = 10;
            resultMessage = '🔔 ベル揃い！';
            break;
          case '🍒':
            multiplier = 5;
            resultMessage = '🍒 チェリー揃い！';
            break;
          case '⭐':
            multiplier = 3;
            resultMessage = '⭐ スター揃い！';
            break;
        }
      } else if (reel[0] === '🍒' && reel[1] === '🍒') {
        multiplier = 2;
        resultMessage = '🍒 チェリー2つで小当たり！';
      } else {
        resultMessage = '😔 ハズレ…次に期待！';
      }
      const payout = bet * multiplier;
      userData.balance = userData.balance - bet + payout;
      updateUserData(guildId, userId, userData);
      const embed = new EmbedBuilder()
        .setTitle('🎰 スロットをプレイ')
        .setColor(0xFFD700)
        .setDescription('リールが回転中...');
      const message = await interaction.editReply({ embeds: [embed] });
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        embed.setDescription(`[ ${reel.slice(0, i + 1).join(' | ')}${' | ⬛'.repeat(2 - i)} ]`);
        await message.edit({ embeds: [embed] });
      }
      embed
        .setDescription(`[ ${reel.join(' | ')} ]\n${resultMessage}`)
        .addFields(
          { name: '賭け金', value: `${bet} ${currencyName}`, inline: true },
          { name: '配当', value: `${payout} ${currencyName}`, inline: true },
          { name: '残高', value: `${userData.balance} ${currencyName}`, inline: true }
        );
      await message.edit({ embeds: [embed] });
    } catch (error) {
      console.error('Error in slots:', error);
      await interaction.editReply({
        content: 'スロットの実行中にエラーが発生しました。管理者にお問い合わせください。',
        ephemeral: true,
      });
    }
  } else if (subcommand === 'coinflip') {
    await interaction.deferReply();
    const bet = interaction.options.getInteger('bet');
    const guess = interaction.options.getString('guess');
    try {
      const userData = getUserData(guildId, userId);
      if (userData.balance < bet) {
        return interaction.editReply({
          content: `残高不足！必要: ${bet} ${currencyName}, 現在の残高: ${userData.balance} ${currencyName}`,
          ephemeral: true,
        });
      }
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const win = guess === result;
      const payout = win ? bet * 2 : 0;
      userData.balance = userData.balance - bet + payout;
      updateUserData(guildId, userId, userData);
      const embed = new EmbedBuilder()
        .setTitle('🪙 コインフリップ')
        .setDescription('コインを投げています…')
        .setColor(0xFFD700);
      const message = await interaction.editReply({ embeds: [embed] });
      await new Promise(resolve => setTimeout(resolve, 1000));
      embed
        .setDescription(`🪙 結果: **${result === 'heads' ? '表' : '裏'}** (${win ? '勝利！' : '敗北…'})`)
        .addFields(
          { name: 'あなたの予想', value: `${guess === 'heads' ? '表' : '裏'}`, inline: true },
          { name: '賭け金', value: `${bet} ${currencyName}`, inline: true },
          { name: '配当', value: `${payout} ${currencyName}`, inline: true },
          { name: '残高', value: `${userData.balance} ${currencyName}`, inline: true }
        )
        .setColor(win ? 0x00FF00 : 0xFF0000);
      await message.edit({ embeds: [embed] });
    } catch (error) {
      console.error('Error in coinflip:', error);
      await interaction.editReply({
        content: 'コインフリップの実行中にエラーが発生しました。管理者にお問い合わせください。',
        ephemeral: true,
      });
    }
  } else if (subcommand === 'work') {
    await interaction.deferReply({ ephemeral: true });
    const now = Date.now();
    const COOLDOWN = 60 * 60 * 1000;
    const MIN_REWARD = 50;
    const MAX_REWARD = 100;
    const userData = getUserData(guildId, userId);
    const lastWork = userData.lastWork || 0;
    if (now - lastWork < COOLDOWN) {
      const timeLeft = Math.ceil((COOLDOWN - (now - lastWork)) / 1000 / 60);
      return interaction.editReply({
        content: `まだ労働できません！${timeLeft}分後に再試行してください。`,
        ephemeral: true,
      });
    }
    const reward = Math.floor(Math.random() * (MAX_REWARD - MIN_REWARD + 1)) + MIN_REWARD;
    userData.balance = (userData.balance || 0) + reward;
    userData.lastWork = now;
    updateUserData(guildId, userId, userData);
    await interaction.editReply(`お疲れ様！${reward} ${currencyName}を獲得しました！現在の残高: ${userData.balance} ${currencyName}`);
  }
}