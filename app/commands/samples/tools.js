import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, PermissionsBitField, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import axios from 'axios';
import { create, all } from 'mathjs';

const math = create(all);

function caesarCipher(text, shift) {
    shift = ((shift % 26) + 26) % 26;
    return text
        .split('')
        .map(char => {
            if (char === ' ') return char;
            const isUpperCase = char === char.toUpperCase();
            const code = char.toLowerCase().charCodeAt(0) - 97;
            const shiftedCode = (code + shift) % 26;
            const newChar = String.fromCharCode(shiftedCode + 97);
            return isUpperCase ? newChar.toUpperCase() : newChar;
        })
        .join('');
}

function ndnDice(ndn) {
    const ndnArr = ndn.split('d');
    const number = parseInt(ndnArr[0]);
    const sides = parseInt(ndnArr[1]);
    const result = [];
    let sum = 0;
    for (let i = 0; i < number; i++) {
        const dice = Math.floor(Math.random() * sides) + 1;
        sum += dice;
        let rollResult = dice;
        if (dice >= 1 && dice <= 5) {
            rollResult = `${dice} (決定的成功)`;
        } else if (dice >= 96 && dice <= 100) {
            rollResult = `${dice} (致命的失敗)`;
        }
        result.push(rollResult);
    }
    return `${number}d${sides} >> [${result.join(', ')}]\n合計: ${sum}`;
}

export const data = new SlashCommandBuilder()
    .setName('tools')
    .setDescription('便利なツール')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setContexts(InteractionContextType.Guild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('url-button')
            .setDescription('URL付きボタンとカスタムメッセージを作成します')
            .addStringOption(option =>
                option.setName('label')
                    .setDescription('ボタンのラベル')
                    .setRequired(true)
                    .setMaxLength(80))
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('リンク先URL')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('ボタンと一緒に送信するメッセージ')
                    .setRequired(false)
                    .setMaxLength(2000))
            .addStringOption(option =>
                option.setName('embed')
                    .setDescription('メッセージを埋め込み形式にする？')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Yes', value: 'yes' },
                        { name: 'No', value: 'no' }
                    ))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('unicode')
            .setDescription('Unicode文字とコードポイントを変換します')
            .addStringOption(option =>
                option.setName('input')
                    .setDescription('変換したいUnicode文字またはコードポイント (例: A または \\u0041)')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('short')
            .setDescription('指定したURLを短縮リンクに変換します')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('短縮したいURL')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('roll')
            .setDescription('サイコロを振る')
            .addStringOption(option =>
                option.setName('ndn')
                    .setDescription('「1d100」形式でダイスロールを指定')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('rolelist')
            .setDescription('サーバーのロール一覧を表示します')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('roleinfo')
            .setDescription('指定したロールの情報を表示します')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('情報を表示したいロール')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('message-content')
            .setDescription('指定したメッセージURLの内容を表示します')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('メッセージのURL')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('create-invite')
            .setDescription('サーバーの招待リンクを作成します')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('embed')
            .setDescription('カスタム埋め込みメッセージを作成します')
            .addStringOption(option =>
                option.setName('title')
                    .setDescription('埋め込みのタイトル')
                    .setRequired(true)
                    .setMaxLength(256))
            .addStringOption(option =>
                option.setName('description')
                    .setDescription('埋め込みの説明')
                    .setRequired(true)
                    .setMaxLength(4096))
            .addStringOption(option =>
                option.setName('color')
                    .setDescription('カラーコード（例: #FF0000）')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('crypto')
            .setDescription('文字列を暗号化または復号化します')
            .addStringOption(option =>
                option.setName('mode')
                    .setDescription('暗号化または復号化を選択')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Encrypt', value: 'encrypt' },
                        { name: 'Decrypt', value: 'decrypt' }
                    ))
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('暗号化/復号化する文字列')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('shift')
                    .setDescription('シフト数（1-25、デフォルト: 3）')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(25))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('calc')
            .setDescription('数式を計算します')
            .addStringOption(option =>
                option.setName('expression')
                    .setDescription('計算したい数式（例: 2 + 2 * 3 や sin(45 deg) ^ 2）')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('banner')
            .setDescription('ユーザーのバナーを表示します')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('情報を表示するユーザー（省略時は自分）')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('avatar')
            .setDescription('ユーザーのアバターを表示します')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('情報を表示するユーザー（省略時は自分）')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('activity')
            .setDescription('同じアクティビティ中のメンバーを検索します(カスタムは"Custom Status")')
            .addStringOption(option =>
                option.setName('activity')
                    .setDescription('検索するアクティビティ名')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('5000兆円')
            .setDescription('5000兆円ジェネレーター')
            .addStringOption(option =>
                option.setName('top')
                    .setDescription('上部に表示する文字')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('bottom')
                    .setDescription('下部に表示する文字')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('timestamp')
            .setDescription('指定した日時からDiscordタイムスタンプを作成します')
            .addStringOption(option =>
                option.setName('datetime')
                    .setDescription('日時 (例: 2025-05-21 15:30)')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('format')
                    .setDescription('タイムスタンプの形式')
                    .setRequired(false)
                    .addChoices(
                        { name: '短い時刻', value: 't' },
                        { name: '長い時刻', value: 'T' },
                        { name: '短い日付', value: 'd' },
                        { name: '長い日付', value: 'D' },
                        { name: '日付と時刻', value: 'f' },
                        { name: '長い日付と時刻', value: 'F' },
                        { name: '相対時間', value: 'R' }
                    ))
    )
    .addSubcommand(subcommand =>
     subcommand
      .setName('poll')
      .setDescription('投票を作成します')
      .addStringOption(option =>
        option.setName('question')
          .setDescription('投票の質問')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('option1')
          .setDescription('選択肢1')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('option2')
          .setDescription('選択肢2')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('option3')
          .setDescription('選択肢3')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('option4')
          .setDescription('選択肢4')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('option5')
          .setDescription('選択肢5')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('option6')
          .setDescription('選択肢6')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('emoji1')
          .setDescription('選択肢1の絵文字')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('emoji2')
          .setDescription('選択肢2の絵文字')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('emoji3')
          .setDescription('選択肢3の絵文字')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('emoji4')
          .setDescription('選択肢4の絵文字')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('emoji5')
          .setDescription('選択肢5の絵文字')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('emoji6')
          .setDescription('選択肢6の絵文字')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('duration')
          .setDescription('投票の期間(時間)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(768))
      .addBooleanOption(option =>
        option.setName('multiselect')
          .setDescription('複数選択を許可するかどうか')
          .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
      .setName('pin')
      .setDescription('指定したメッセージをピン留めします')
      .addStringOption(option =>
        option.setName('messageid')
          .setDescription('ピン留めするメッセージのID')
          .setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'url-button': {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'このコマンドを実行するには「サーバー管理」権限が必要です。', ephemeral: true });
            }
            await interaction.deferReply();
            const label = interaction.options.getString('label');
            const url = interaction.options.getString('url');
            const message = interaction.options.getString('message');
            const embedOption = interaction.options.getString('embed') || 'no';
            try {
                if (!url.match(/^https?:\/\//)) {
                    return interaction.editReply({ content: '有効なURL（http:// または https:// で始まる）を指定してください。', ephemeral: true });
                }
                const button = new ButtonBuilder()
                    .setLabel(label)
                    .setURL(url)
                    .setStyle(ButtonStyle.Link);
                const row = new ActionRowBuilder().addComponents(button);
                let replyOptions = { components: [row] };
                if (embedOption === 'yes') {
                    const embed = new EmbedBuilder()
                        .setTitle(message || '以下のボタンをクリック！')
                        .setColor(0x00FF00)
                        .setTimestamp()
                        .setFooter({ text: `作成者: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
                    replyOptions.embeds = [embed];
                } else {
                    replyOptions.content = message || '以下のボタンをクリック！';
                }
                await interaction.editReply(replyOptions);
            } catch (error) {
                console.error('Error in url_button:', error);
                await interaction.editReply({ content: 'ボタンの作成中にエラーが発生しました。URLまたはメッセージを確認してください。', ephemeral: true });
            }
            break;
        }
        case 'unicode': {
            await interaction.deferReply({ ephemeral: true });
            const input = interaction.options.getString('input');
            try {
                let result;
                let description;
                if (input.match(/^\\u[0-9a-fA-F]{4}$/)) {
                    const codePoint = parseInt(input.slice(2), 16);
                    if (codePoint < 0 || codePoint > 0x10FFFF) {
                        throw new Error('無効なUnicodeコードポイントです（範囲: \\u0000 から \\u10FFFF）。');
                    }
                    result = String.fromCodePoint(codePoint);
                    description = `コードポイント \`${input}\` を文字に変換しました。`;
                } else if (input.length === 1) {
                    const codePoint = input.codePointAt(0);
                    result = `\\u${codePoint.toString(16).padStart(4, '0').toUpperCase()}`;
                    description = `文字 \`${input}\` をコードポイントに変換しました。`;
                } else {
                    throw new Error('入力は1文字または \\uXXXX 形式（例: \\u0041）のいずれかにしてください。');
                }
                const embed = new EmbedBuilder()
                    .setTitle('Unicode変換')
                    .setDescription(description)
                    .addFields(
                        { name: '入力', value: `\`\`\`${input}\`\`\``, inline: true },
                        { name: '変換結果', value: `\`\`\`${result}\`\`\``, inline: true }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Unicode変換エラー:', error);
                await interaction.editReply({ content: `エラーが発生しました: ${error.message}\n例: A または \\u0041`, ephemeral: true });
            }
            break;
        }
        case 'short': {
            await interaction.deferReply({ ephemeral: true });
            const url = interaction.options.getString('url');
            const urlPattern = /^(https?:\/\/[^\s]+)/;
            if (!urlPattern.test(url)) {
                return await interaction.editReply({ content: '有効なURLを入力してください（例: https://example.com）。', ephemeral: true });
            }
            try {
                const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
                const shortUrl = response.data;
                if (shortUrl === 'Error') {
                    return await interaction.editReply({ content: 'URLの短縮に失敗しました。もう一度試してください。', ephemeral: true });
                }
                await interaction.editReply({ content: `短縮リンク: ${shortUrl}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '短縮リンクの作成中にエラーが発生しました。', ephemeral: true });
            }
            break;
        }
        case 'roll': {
            await interaction.deferReply();
            const input = interaction.options.getString('ndn');
            if (!input.match(/^\d+d\d+$/)) {
                await interaction.editReply('入力が正しくありません。');
                return;
            }
            await interaction.editReply(ndnDice(input));
            break;
        }
        case 'rolelist': {
            await interaction.deferReply();
            const guild = interaction.guild;
            const roles = guild.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(role => `${role.name} (ID: ${role.id})`)
                .join('\n') || 'ロールがありません。';
            const embed = new EmbedBuilder()
                .setTitle(`${guild.name} のロール一覧`)
                .setDescription(roles)
                .setColor('#00AAFF')
                .setTimestamp()
                .setFooter({ text: `リクエスト: ${interaction.user.tag}` });
            await interaction.editReply({ embeds: [embed] });
            break;
        }
        case 'message-content': {
            await interaction.deferReply({ ephemeral: true });
            const url = interaction.options.getString('url');
            const client = interaction.client;
            try {
                const urlPattern = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
                const match = url.match(urlPattern);
                if (!match) {
                    return await interaction.editReply('無効なメッセージURLです。正しい形式のURLを入力してください。');
                }
                const [, guildId, channelId, messageId] = match;
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    return await interaction.editReply('指定されたチャンネルにアクセスできません。');
                }
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) {
                    return await interaction.editReply('指定されたメッセージが見つかりません。');
                }
                let response = `**メッセージ内容**:\n${message.content || '(内容なし)'}\n`;
                response += `**送信者**: ${message.author.tag}\n`;
                response += `**送信日時**: ${message.createdAt.toLocaleString('ja-JP')}\n`;
                if (message.attachments.size > 0) {
                    response += '**添付ファイル**:\n';
                    message.attachments.forEach(attachment => {
                        response += `- ${attachment.url}\n`;
                    });
                }
                await interaction.editReply(response);
            } catch (error) {
                console.error('メッセージ取得エラー:', error);
                await interaction.editReply('メッセージの取得中にエラーが発生しました。');
            }
            break;
        }
        case 'create-invite': {
            if (!interaction.member.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
                return interaction.reply({ content: 'このコマンドを実行するには「招待リンクの作成」権限が必要です。', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            try {
                const invite = await interaction.channel.createInvite({
                    maxAge: 0,
                    maxUses: 0,
                    unique: true,
                });
                await interaction.editReply({ content: `サーバーの招待リンク: ${invite.url}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '招待リンクの作成中にエラーが発生しました。', ephemeral: true });
            }
            break;
        }
        case 'embed': {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'このコマンドを実行するには「サーバー管理」権限が必要です。', ephemeral: true });
            }
            await interaction.deferReply();
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            let color = interaction.options.getString('color') || '#00FF00';
            try {
                if (color.startsWith('#')) color = color.slice(1);
                let colorInt = parseInt(color, 16);
                if (isNaN(colorInt) || color.length !== 6) {
                    colorInt = 0x00FF00;
                }
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(colorInt)
                    .setTimestamp()
                    .setFooter({ text: `作成者: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error in embed:', error);
                await interaction.editReply({ content: '埋め込みの作成中にエラーが発生しました。カラーコードを確認してください。', ephemeral: true });
            }
            break;
        }
        case 'poll': {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'このコマンドを実行するには「サーバー管理」権限が必要です。', ephemeral: true });
            }
            await interaction.deferReply();
            const question = interaction.options.getString('question');
            const option1 = interaction.options.getString('option1');
            const emoji1 = interaction.options.getString('emoji1');
            const option2 = interaction.options.getString('option2');
            const emoji2 = interaction.options.getString('emoji2');
            const option3 = interaction.options.getString('option3');
            const emoji3 = interaction.options.getString('emoji3');
            const option4 = interaction.options.getString('option4');
            const emoji4 = interaction.options.getString('emoji4');
            const option5 = interaction.options.getString('option5');
            const emoji5 = interaction.options.getString('emoji5');
            const option6 = interaction.options.getString('option6');
            const emoji6 = interaction.options.getString('emoji6');
            const durationHours = interaction.options.getInteger('duration') || 24;
            const multiselect = interaction.options.getBoolean('multiselect') ?? true;
            const answers = [
                { text: option1, emoji: emoji1 || undefined },
                { text: option2, emoji: emoji2 || undefined },
            ];
            if (option3) answers.push({ text: option3, emoji: emoji3 || undefined });
            if (option4) answers.push({ text: option4, emoji: emoji4 || undefined });
            if (option5) answers.push({ text: option5, emoji: emoji5 || undefined });
            if (option6) answers.push({ text: option6, emoji: emoji6 || undefined });
            const poll = {
                question: { text: question },
                answers: answers,
                duration: Math.min(durationHours, 12),
                allow_multiselect: multiselect,
            };
            try {
                await interaction.editReply({ poll: poll });
            } catch (error) {
                await interaction.editReply({ content: '投票の作成に失敗しました。入力内容を確認してください。', ephemeral: true });
            }
            break;
        }
        case 'pin': {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'このコマンドを実行するには「サーバー管理」権限が必要です。', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const messageId = interaction.options.getString('messageid');
            try {
                const message = await interaction.channel.messages.fetch(messageId);
                if (message.pinned) {
                    await interaction.editReply({ content: '指定されたメッセージはすでにピン留めされています。', ephemeral: true });
                    return;
                }
                await message.pin();
                await interaction.editReply({ content: 'メッセージをピン留めしました。', ephemeral: true });
            } catch (error) {
                console.error('ピン留めエラー:', error);
                await interaction.editReply({ content: 'ピン留めに失敗しました。メッセージIDまたは権限を確認してください。', ephemeral: true });
            }
            break;
        }
        case 'crypto': {
            await interaction.deferReply({ ephemeral: true });
            const mode = interaction.options.getString('mode');
            const text = interaction.options.getString('text');
            const shift = interaction.options.getInteger('shift') || 3;
            try {
                if (text.length > 100) {
                    throw new Error('入力文字列は100文字以内にしてください。');
                }
                if (!/^[a-zA-Z\s]+$/.test(text)) {
                    throw new Error('英字とスペースのみ使用可能です。');
                }
                const result = mode === 'encrypt' 
                    ? caesarCipher(text, shift) 
                    : caesarCipher(text, -shift);
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle(mode === 'encrypt' ? '暗号化結果' : '復号化結果')
                    .addFields(
                        { name: '入力', value: `\`\`\`${text}\`\`\``, inline: true },
                        { name: 'シフト数', value: `\`\`\`${shift}\`\`\``, inline: true },
                        { name: '結果', value: `\`\`\`${result}\`\`\``, inline: false }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('エラー')
                    .setDescription('処理中にエラーが発生しました。以下の点を確認してください：\n' +
                        '- 英字とスペースのみを使用\n' +
                        '- 文字列は100文字以内\n' +
                        '- シフト数は1～25の範囲')
                    .addFields(
                        { name: '入力された文字列', value: `\`\`\`${text}\`\`\`` },
                        { name: 'エラーメッセージ', value: `\`\`\`${error.message}\`\`\`` }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            }
            break;
        }
        case 'calc': {
            await interaction.deferReply({ ephemeral: true });
            const expression = interaction.options.getString('expression');
            try {
                const result = math.evaluate(expression);
                const formattedResult = typeof result === 'number' 
                    ? Number.isInteger(result) 
                        ? result.toString()
                        : result.toFixed(6).replace(/\.?0+$/, '')
                    : result.toString();
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('計算結果')
                    .addFields(
                        { name: '入力', value: `\`\`\`${expression}\`\`\`` },
                        { name: '結果', value: `\`\`\`${formattedResult}\`\`\`` }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('エラー')
                    .setDescription('無効な数式です。以下の点を確認してください：\n' +
                        '- 正しい数式形式を使用しているか\n' +
                        '- サポートされている関数を使用しているか\n' +
                        '- 括弧が正しく閉じているか')
                    .addFields(
                        { name: '入力された数式', value: `\`\`\`${expression}\`\`\`` },
                        { name: 'エラーメッセージ', value: `\`\`\`${error.message}\`\`\`` }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            }
            break;
        }
        case 'banner': {
            await interaction.deferReply({ ephemeral: true });
            try {
                const targetUser = interaction.options.getUser('user') || interaction.user;
                const user = await interaction.client.users.fetch(targetUser.id, { force: true });
                const bannerUrl = user.banner ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=512` : null;
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle(`${user.tag} のバナー`)
                    .setThumbnail(bannerUrl || user.displayAvatarURL({ dynamic: true, size: 128 }))
                    .setTimestamp();
                if (bannerUrl) {
                    embed.addFields({ name: 'バナー', value: `[バナーのリンク](${bannerUrl})`, inline: false });
                } else {
                    embed.addFields({ name: 'バナー', value: 'このユーザーはバナーを設定していません。', inline: false });
                }
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('アバター/バナー表示エラー:', error);
                await interaction.editReply({ content: 'ユーザー情報の取得中にエラーが発生しました。', ephemeral: true });
            }
            break;
        }
        case 'avatar': {
            await interaction.deferReply({ ephemeral: true });
            try {
                const targetUser = interaction.options.getUser('user') || interaction.user;
                const user = await interaction.client.users.fetch(targetUser.id, { force: true });
                const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 4096 });
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle(`${user.tag} のアバター`)
                    .setImage(avatarUrl)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('アバター表示エラー:', error);
                await interaction.editReply({ content: 'ユーザー情報の取得中にエラーが発生しました。', ephemeral: true });
            }
            break;
        }
        case 'activity': {
            await interaction.deferReply({ ephemeral: true });
            const activityName = interaction.options.getString('activity').toLowerCase();
            const guild = interaction.guild;
            await guild.members.fetch();
            const matchingMembers = guild.members.cache
                .filter(member => {
                    if (member.presence?.status === 'offline') return false;
                    return member.presence?.activities.some(activity => 
                        activity.name.toLowerCase().includes(activityName)
                    );
                })
                .first(100);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`「${activityName}」をプレイ中のメンバー`)
                .setTimestamp();
            if (matchingMembers.length === 0) {
                embed.setDescription('該当するメンバーは見つかりませんでした。');
            } else {
                const memberList = matchingMembers.map(member => {
                    const activity = member.presence.activities.find(act => 
                        act.name.toLowerCase().includes(activityName)
                    );
                    return `${member.user.tag} - ${activity.name} ${activity.details ? `(${activity.details})` : ''}`;
                }).join('\n');
                embed.setDescription(memberList);
                embed.setFooter({ text: `合計: ${matchingMembers.length}人${matchingMembers.length === 100 ? ' (上限100人に達しました)' : ''}` });
            }
            await interaction.editReply({ embeds: [embed], ephemeral: true });
            break;
        }
        case '5000兆円': {
            await interaction.deferReply();
            const topmoji = interaction.options.getString('top');
            const bottommoji = interaction.options.getString('bottom');
            if (!topmoji || !bottommoji) {
                return interaction.editReply({ content: '文字を正しく指定してください。' });
            }
            const forbiddenPattern = /((discord)|(https?:\/\/)|(\/)|(\.)|(\\)|(．))/i;
            if (forbiddenPattern.test(topmoji) || forbiddenPattern.test(bottommoji)) {
                return interaction.editReply({ content: '入力に禁止された内容が含まれています。別の文字を指定してください。' });
            }
            try {
                const apiUrl = `https://gsapi.cbrx.io/image?top=${encodeURIComponent(topmoji)}&bottom=${encodeURIComponent(bottommoji)}&q=100&type=png&rainbow=false&noalpha=false`;
                const embed = new EmbedBuilder()
                    .setTitle('結果：')
                    .setImage(apiUrl)
                    .setColor('#0099ff');
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '画像の生成中にエラーが発生しました。文字が正しいか確認してください。' });
            }
            break;
        }
        case 'timestamp': {
            await interaction.deferReply({ ephemeral: true });
            const datetimeString = interaction.options.getString('datetime');
            const format = interaction.options.getString('format') || 'f';
            try {
                const date = new Date(datetimeString);
                if (isNaN(date.getTime())) {
                    throw new Error('無効な日時形式です。例: 2025-05-21 15:30');
                }
                const timestamp = Math.floor(date.getTime() / 1000);
                const timestampString = `<t:${timestamp}:${format}>`;
                const timestampCopy = `\`\`\`<t:${timestamp}:${format}>\`\`\``;
                const embed = new EmbedBuilder()
                    .setTitle('タイムスタンプ生成')
                    .addFields(
                        { name: '入力された日時', value: datetimeString, inline: true },
                        { name: 'プレビュー', value: timestampString, inline: true },
                        { name: 'コピー', value: timestampCopy, inline: true }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('タイムスタンプ生成エラー:', error);
                await interaction.editReply({
                    content: `エラーが発生しました: ${error.message}\n正しい形式（例: 2025-05-21 15:30）で入力してください。`,
                    ephemeral: true
                });
            }
            break;
        }
        default:
            await interaction.reply({ content: '不明なサブコマンドです。', ephemeral: true });
    }
}
