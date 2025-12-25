import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, PermissionsBitField, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import axios from 'axios';
import { create, all } from 'mathjs';

const math = create(all);

const badgeMap = {
    'hypesquad-bravery': { flags: ['HypeSquadBravery', 'HypeSquadOnlineHouse1'], type: 'userFlag', name: 'HypeSquad Bravery' },
    'hypesquad-brilliance': { flags: ['HypeSquadBrilliance', 'HypeSquadOnlineHouse2'], type: 'userFlag', name: 'HypeSquad Brilliance' },
    'hypesquad-balance': { flags: ['HypeSquadBalance', 'HypeSquadOnlineHouse3'], type: 'userFlag', name: 'HypeSquad Balance' },
    'nitro': { flags: null, type: 'premium', name: 'Nitro' },
    'server-booster': { flags: ['PremiumGuildSubscription'], type: 'premium', name: 'Server Booster' },
    'active-developer': { flags: ['ActiveDeveloper'], type: 'userFlag', name: 'Active Developer' },
    'quest': { flags: ['CompletedQuests'], type: 'userFlag', name: 'Quest' },
    'orb': { flags: ['HasOrb'], type: 'userFlag', name: 'Orb' },
    'discord-staff': { flags: ['Staff'], type: 'userFlag', name: 'Discord Staff' },
    'legacy-username': { flags: ['HadLegacyUsername'], type: 'userFlag', name: 'Legacy Username' },
    'bug-hunter': { flags: ['BugHunterLevel1'], type: 'userFlag', name: 'Bug Hunter' },
    'bug-hunter-gold': { flags: ['BugHunterLevel2'], type: 'userFlag', name: 'Bug Hunter Gold' },
    'partner-server': { flags: ['Partner'], type: 'userFlag', name: 'Partner Server' },
    'early-supporter': { flags: ['PremiumEarlySupporter'], type: 'userFlag', name: 'Early Supporter' },
    'early-bot-developer': { flags: ['VerifiedDeveloper'], type: 'userFlag', name: 'Early Bot Developer' },
    'moderator-program': { flags: ['CertifiedModerator'], type: 'userFlag', name: 'Moderator Program' },
    'hypesquad-event': { flags: ['HypeSquad'], type: 'userFlag', name: 'HypeSquad Events Member' },
    'support-commands': { flags: ['SupportsCommands'], type: 'userFlag', name: 'Support Commands' },
    'automod': { flags: ['UsesAutoMod'], type: 'userFlag', name: 'AutoMod' }
};

const badgeEmojiMap = {
    'hypesquad-bravery': '<:hypesquadbravery:1399917855364878356>',
    'hypesquad-brilliance': '<:hypesquadbrilliance:1399917875740803172>',
    'hypesquad-balance': '<:hypesquadbalance:1399917839028060270>',
    'nitro': '<:discordnitro:1399917612644962455>',
    'server-booster': '<:boost_tear_8:1372111993393123338>',
    'active-developer': '<:activedeveloper:1399917592763957248>',
    'quest': '<:quest:1399918152292372550>',
    'orb': '<:orb:1399917801203830824>',
    'discord-staff': '<:discordstaff:1399917818622906418>',
    'legacy-username': '<:username:1399918130049843241>',
    'bug-hunter': '<:discordbughunter1:1399917667049144510>',
    'bug-hunter-gold': '<:discordbughunter2:1399917684346327203>',
    'partner-server': '<:discordpartner:1399917784129077359>',
    'early-supporter': '<:discordearlysupporter:1399917650095898725>',
    'early-bot-developer': '<:discordbotdev:1399917569519128696>',
    'moderator-program': '<:discordmod:1399917766873583799>',
    'hypesquad-event': '<:hypesquadevents:1399917931705405510>',
    'support-commands': '<:supportscommands:1399917702558253096>',
    'automod': '<:automod:1399917722430607452>'
};

export const data = new SlashCommandBuilder()
    .setName('info')
    .setDescription('情報取得コマンド')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('指定したユーザーの情報を表示します')
            .addUserOption(option =>
                option.setName('target')
                    .setDescription('情報を表示するユーザー')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('id')
                    .setDescription('ユーザーIDを直接指定（サーバーにいない場合用）')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('server')
            .setDescription('サーバーの情報を表示します')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('role')
            .setDescription('指定したロールの情報を表示します')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('情報を表示したいロール')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('invite')
            .setDescription('招待リンクからサーバー情報を表示します')
            .addStringOption(option =>
                option.setName('invite')
                    .setDescription('サーバーの招待リンク')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('emoji')
            .setDescription('サーバーのカスタム絵文字一覧、または指定絵文字の詳細')
            .addStringOption(option =>
                option.setName('emoji')
                    .setDescription('調べたい絵文字（名前 or ID or 絵文字そのもの）')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('channel')
            .setDescription('指定したチャンネルの詳細情報を表示')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('情報を取得するチャンネル')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('message')
            .setDescription('メッセージIDまたはリンクから詳細を表示')
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('メッセージID または メッセージURL')
                    .setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
    case 'user': {
    await interaction.deferReply();
    let target = interaction.options.getUser('target');
    const userIdInput = interaction.options.getString('id');
    if (!target && userIdInput) {
        try {
            target = await interaction.client.users.fetch(userIdInput, { force: true });
        } catch (error) {
            console.error('ユーザー取得エラー:', error);
            await interaction.editReply({ content: '指定されたIDのユーザーが見つかりませんでした。' });
            return;
        }
    } else if (!target) {
        target = interaction.user;
    }
    let member;
    let isInGuild = true;
    try {
        member = await interaction.guild.members.fetch(target.id);
    } catch (error) {
        isInGuild = false;
    }
    const userId = target.id;
    const displayName = isInGuild ? member.displayName : target.username;
    const nickname = isInGuild ? (member.nickname || '設定なし') : '利用不可';
    const createdAt = target.createdAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const joinedAt = isInGuild ? member.joinedAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '利用不可';
    const roleCount = isInGuild ? member.roles.cache.size - 1 : '利用不可';
    const userType = target.bot ? 'ボット' : 'ユーザー';
    const roles = isInGuild
        ? member.roles.cache
            .filter(role => role.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(role => role.name)
            .slice(0, 10)
            .join(', ') || 'なし'
        : '利用不可';
    let lastActivity = '不明';
    if (isInGuild && member.presence) {
        const status = member.presence.status === 'online' ? 'オンライン' :
                       member.presence.status === 'idle' ? '退席中' :
                       member.presence.status === 'dnd' ? '取り込み中' : 'オフライン';
        const activities = member.presence.activities;
        const activityDetails = activities.length > 0
            ? activities.map(a => `${a.name}${a.details ? `: ${a.details}` : ''}`).join(', ')
            : 'なし';
        lastActivity = `${status} (${activityDetails})`;
    } else {
        lastActivity = 'オフラインまたは利用不可';
    }
    let lastMessage = '不明';
    try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m => m.author.id === target.id);
        if (userMessages.size > 0) {
            const lastMsg = userMessages.first();
            lastMessage = `${lastMsg.content.slice(0, 50)}${lastMsg.content.length > 50 ? '...' : ''} (${lastMsg.createdAt.toLocaleDateString('ja-JP')})`;
        }
    } catch (error) {
        console.error('最後のメッセージ取得エラー:', error);
    }
    const user = await interaction.client.users.fetch(target.id, { force: true });
    const userFlags = user.flags.toArray();
    const detectedBadges = [];
    for (const [badge, { flags, type, name }] of Object.entries(badgeMap)) {
        let hasBadge = false;
        if (type === 'userFlag' && flags) {
            hasBadge = flags.some(flag => userFlags.includes(flag));
        } else if (type === 'premium' && isInGuild) {
            if (badge === 'nitro' || badge === 'server-booster') {
                hasBadge = !!member.premiumSince;
            }
        }
        if (hasBadge) {
            detectedBadges.push(`${badgeEmojiMap[badge]} ${name}`);
        }
    }
    const bannerURL = user.banner ? user.bannerURL({ dynamic: true, size: 4096 }) : 'なし';
    const accentColor = user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : '設定なし';
    
    let serverTag = '設定なし';
    if (user.primaryGuild?.tag) {
        serverTag = user.primaryGuild?.tag;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`${target.tag} の情報`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setColor(user.accentColor || '#00AAFF')
        .addFields(
            { name: 'ユーザーID', value: userId, inline: true },
            { name: '表示名', value: displayName, inline: true },
            { name: 'ニックネーム', value: nickname, inline: true },
            { name: 'アカウント作成日', value: createdAt, inline: true },
            { name: 'サーバー参加日', value: joinedAt, inline: true },
            { name: 'ロール数', value: typeof roleCount === 'number' ? `${roleCount}個` : roleCount, inline: true },
            { name: 'ユーザータイプ', value: userType, inline: true },
            { name: '最後のアクティビティ', value: lastActivity, inline: true },
            { name: '最後のメッセージ', value: lastMessage, inline: true },
            { name: 'プロフィールカラー', value: accentColor, inline: true },
            { name: 'サーバータグ', value: serverTag, inline: true },
            { name: '所有ロール（上位10個）', value: roles, inline: false },
            { name: '所有バッジ', value: detectedBadges.length > 0 ? detectedBadges.join(', ') : 'なし', inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `リクエスト: ${interaction.user.tag}` });
    if (bannerURL !== 'なし') {
        embed.setImage(bannerURL);
    }
    if (!isInGuild) {
        embed.setDescription('※このユーザーはサーバーにいません。一部の情報は利用できません。');
        }
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'server': {
            await interaction.deferReply();
            const guild = interaction.guild;
            const serverName = guild.name;
            const serverId = guild.id;
            const createdAt = guild.createdAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
            const memberCount = guild.memberCount;
            const channels = guild.channels.cache.size;
            const owner = await guild.fetchOwner();
            const roleCount = guild.roles.cache.size;
            const boostLevel = guild.premiumTier;
            const customEmojis = guild.emojis.cache.size;
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd').size;
            const embed = new EmbedBuilder()
                .setTitle(`${serverName} の情報`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setColor('#00AAFF')
                .addFields(
                    { name: 'サーバー名', value: serverName, inline: true },
                    { name: 'サーバーID', value: serverId, inline: true },
                    { name: '作成日', value: createdAt, inline: true },
                    { name: 'メンバー数', value: `${memberCount}人`, inline: true },
                    { name: 'オンラインメンバー数', value: `${onlineMembers}人`, inline: true },
                    { name: 'チャンネル数', value: `${channels}個`, inline: true },
                    { name: 'サーバー所有者', value: owner.user.tag, inline: true },
                    { name: 'ロール数', value: `${roleCount}個`, inline: true },
                    { name: 'ブーストレベル', value: `レベル ${boostLevel}`, inline: true },
                    { name: 'カスタム絵文字数', value: `${customEmojis}個`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `リクエスト: ${interaction.user.tag}` });
            await interaction.editReply({ embeds: [embed] });
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
        case 'role': {
            await interaction.deferReply();
            const role = interaction.options.getRole('role');
            try {
                if (!role) {
                    throw new Error('ロールが見つかりませんでした。');
                }
                const permissions = role.permissions.toArray().join(', ') || 'なし';
                const embed = new EmbedBuilder()
                    .setTitle(`ロール情報: ${role.name}`)
                    .setColor(role.hexColor || '#00ff00')
                    .addFields(
                        { name: 'ロール名', value: role.name, inline: true },
                        { name: 'ロールID', value: role.id, inline: true },
                        { name: '作成日', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'カラー', value: role.hexColor || 'デフォルト', inline: true },
                        { name: 'メンション可能', value: role.mentionable ? 'はい' : 'いいえ', inline: true },
                        { name: '表示順位', value: `${role.position}`, inline: true },
                        { name: '権限', value: permissions.length > 1024 ? '多数（詳細は省略）' : permissions, inline: false }
                    )
                    .setTimestamp();
                if (role.iconURL()) {
                    embed.setThumbnail(role.iconURL({ dynamic: true }));
                }
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('ロール情報取得エラー:', error);
                await interaction.editReply({ content: 'ロール情報の取得中にエラーが発生しました。ロールが存在するか確認してください。', ephemeral: true });
            }
            break;
        }
        case 'invite': {
          await interaction.deferReply({ ephemeral: true });
          const inviteLink = interaction.options.getString('invite');
          try {
          const invite = await interaction.client.fetchInvite(inviteLink);
          const guild = invite.guild;
          if (!guild) {
            throw new Error('サーバー情報を取得できませんでした。');
        }
        const embed = new EmbedBuilder()
            .setTitle(`${guild.name} のサーバー情報`)
            .setThumbnail(guild.iconURL({ dynamic: true }) || null)
            .setColor('#0099ff')
            .setTimestamp();
        if (guild.description) {
            embed.setDescription(guild.description);
        }
        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ dynamic: true }));
        }
        if (guild.splashURL()) {
            embed.addFields({
                name: 'スプラッシュ画像',
                value: `[リンク](${guild.splashURL({ dynamic: true })})`,
                inline: true
            });
        }
        embed.addFields(
            { name: 'サーバーID', value: guild.id, inline: true },
            { name: '作成日', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'メンバー数（おおよそ）', value: invite.approximateMemberCount ? `${invite.approximateMemberCount}` : '不明', inline: true },
            { name: 'オンラインメンバー（おおよそ）', value: invite.approximatePresenceCount ? `${invite.approximatePresenceCount}` : '不明', inline: true },
            { name: '認証レベル', value: guild.verificationLevel ? `${guild.verificationLevel}` : '不明', inline: true },
            { name: 'NSFWレベル', value: guild.nsfwLevel ? `${guild.nsfwLevel}` : '不明', inline: true },
            { name: 'サーバーの機能', value: guild.features.length > 0 ? guild.features.join(', ') : 'なし', inline: true }
        );
        embed.addFields(
            { name: '招待コード', value: invite.code, inline: true },
            { name: '招待リンクの作成者', value: invite.inviter ? `${invite.inviter.tag} (${invite.inviter.id})` : '不明', inline: true },
            { name: '有効期限', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : '無期限', inline: true },
            { name: '最大使用回数', value: invite.maxUses ? `${invite.maxUses}` : '無制限', inline: true },
            { name: '現在の使用回数', value: invite.uses ? `${invite.uses}` : '0', inline: true },
            { name: '一時的な招待', value: invite.temporary ? 'はい' : 'いいえ', inline: true }
        );
        if (invite.channel) {
            embed.addFields({
                name: '招待先チャンネル',
                value: `${invite.channel.name} (ID: ${invite.channel.id}, タイプ: ${invite.channel.type})`,
                inline: true
            });
        }
        if (interaction.client.guilds.cache.has(guild.id)) {
            const fullGuild = await interaction.client.guilds.fetch(guild.id);
            embed.addFields({
                name: 'チャンネル数',
                value: fullGuild.channels.cache.size.toString(),
                inline: true
            });
        } else {
            embed.addFields({
                name: 'チャンネル数',
                value: 'ボットがサーバーに参加していないため不明',
                inline: true
              });
           }
           await interaction.editReply({ embeds: [embed], ephemeral: true });
       } catch (error) {
          console.error('サーバー情報取得エラー:', error);
              await interaction.editReply({
                 content: '招待リンクからサーバー情報を取得できませんでした。リンクが有効か、ボットに必要な権限があるか確認してください。',
                 ephemeral: true
              });
           }
           break;
        }
        case 'emoji': {
            await interaction.deferReply();
            const guild = interaction.guild;
            const query = interaction.options.getString('emoji');

            if (!query) {
                // 絵文字一覧表示（50個まで、超えたら「他XX個」と表示）
                const emojis = guild.emojis.cache
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(e => `${e} — \`${e.name}\` (${e.id})`)
                    .slice(0, 50);

                const more = guild.emojis.cache.size > 50 ? `\n他 ${guild.emojis.cache.size - 50} 個...` : '';

                const embed = new EmbedBuilder()
                    .setTitle(`${guild.name} のカスタム絵文字 (${guild.emojis.cache.size}個)`)
                    .setDescription(emojis.join('\n') + more || 'カスタム絵文字がありません')
                    .setColor('#00AAFF')
                    .setTimestamp()
                    .setFooter({ text: `リクエスト: ${interaction.user.tag}` });

                await interaction.editReply({ embeds: [embed] });
            } else {
                // 特定の絵文字を検索
                let emoji = guild.emojis.cache.find(e => 
                    e.name.toLowerCase() === query.toLowerCase() || 
                    e.id === query.replace(/[^0-9]/g, '') ||
                    e.toString() === query
                );

                if (!emoji) {
                    return interaction.editReply({ content: 'その名前の絵文字は見つかりませんでした。' });
                }

                const embed = new EmbedBuilder()
                    .setTitle('絵文字情報')
                    .setThumbnail(emoji.url)
                    .setColor('#00AAFF')
                    .addFields(
                        { name: '名前', value: emoji.name, inline: true },
                        { name: 'ID', value: emoji.id, inline: true },
                        { name: 'アニメーション', value: emoji.animated ? 'はい' : 'いいえ', inline: true },
                        { name: '作成日', value: `<t:${Math.floor(emoji.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'URL', value: `[クリック](${emoji.url})`, inline: true }
                    )
                    .setImage(emoji.url)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
            break;
        }

        case 'channel': {
            await interaction.deferReply();
            let channel = interaction.options.getChannel('channel') || interaction.channel;

            const embed = new EmbedBuilder()
                .setTitle('チャンネル情報')
                .setColor('#00AAFF')
                .addFields(
                    { name: '名前', value: channel.name, inline: true },
                    { name: 'ID', value: channel.id, inline: true },
                    { name: '種類', value: channel.type.toString().replace('GUILD_', '').replace('_', ' '), inline: true },
                    { name: '作成日', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'トピック', value: channel.topic || 'なし', inline: false },
                    { name: 'NSFW', value: channel.nsfw ? 'はい' : 'いいえ', inline: true },
                    { name: 'スローレート', value: channel.rateLimitPerUser ? `${channel.rateLimitPerUser}秒` : 'なし', inline: true }
                );

            if (channel.parent) {
                embed.addFields({ name: 'カテゴリ', value: channel.parent.name, inline: true });
            }

            if (channel.isTextBased()) {
                embed.addFields({ name: '最終メッセージ', value: channel.lastMessageId ? `<t:${Math.floor(channel.lastMessage.createdTimestamp / 1000)}:R>` : 'なし', inline: true });
            }

            await interaction.editReply({ embeds: [embed] });
            break;
        }

        case 'message': {
            await interaction.deferReply({ ephemeral: true });
            const input = interaction.options.getString('message').trim();

            const msgId = input.match(/(?:https?:\/\/)?discord\.com\/channels\/(?:\d+\/){2}(\d+)/)?.[1] || input.replace(/[^0-9]/g, '');

            if (!msgId || isNaN(msgId)) {
                return interaction.editReply({ content: '有効なメッセージIDまたはURLを指定してください。' });
            }

            let message;
            try {
                message = await interaction.channel.messages.fetch(msgId);
            } catch {
                const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
                for (const channel of channels.values()) {
                    try {
                        message = await channel.messages.fetch(msgId);
                        break;
                    } catch {}
                }
            }

            if (!message) {
                return interaction.editReply({ content: '指定されたメッセージが見つかりませんでした。' });
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(message.content || '*内容なし*')
                .setColor('#00AAFF')
                .addFields(
                    { name: '送信者', value: `${message.author} (${message.author.id})`, inline: true },
                    { name: 'チャンネル', value: `<#${message.channel.id}>`, inline: true },
                    { name: '送信日時', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'メッセージID', value: message.id, inline: true },
                    { name: '添付ファイル', value: message.attachments.size > 0 ? `${message.attachments.size}個` : 'なし', inline: true },
                    { name: '埋め込み', value: message.embeds.length > 0 ? `${message.embeds.length}個` : 'なし', inline: true }
                )
                .setFooter({ text: 'メッセージジャンプ →' })
                .setTimestamp();

            if (message.attachments.size > 0) {
                embed.setImage(message.attachments.first().url);
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('メッセージに移動')
                        .setStyle(ButtonStyle.Link)
                        .setURL(message.url)
                );

            await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
            break;
        }
        default:
            await interaction.reply({ content: '不明なサブコマンドです。', ephemeral: true });
    }
}