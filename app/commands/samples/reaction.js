import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ApplicationIntegrationType } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('reaction')
    .setDescription('メッセージのリアクションを管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('メッセージにリアクションを追加します')
            .addStringOption(option =>
                option.setName('emoji')
                    .setDescription('追加する絵文字')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('messageid')
                    .setDescription('対象のメッセージID')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('メッセージからリアクションを削除します')
            .addStringOption(option =>
                option.setName('emoji')
                    .setDescription('削除する絵文字')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('messageid')
                    .setDescription('対象のメッセージID')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('allremove')
            .setDescription('メッセージからすべてのリアクションを削除します')
            .addStringOption(option =>
                option.setName('messageid')
                    .setDescription('対象のメッセージID')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('mention')
            .setDescription('メッセージのリアクションからランダムにメンションします')
            .addStringOption(option =>
                option.setName('emoji')
                    .setDescription('対象の絵文字')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('messageid')
                    .setDescription('対象のメッセージID')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('random')
            .setDescription('メッセージにランダムな絵文字を追加します')
            .addStringOption(option =>
                option.setName('messageid')
                    .setDescription('対象のメッセージID')
                    .setRequired(true)));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const messageId = interaction.options.getString('messageid');
    const emoji = interaction.options.getString('emoji');
    const channel = interaction.channel;

    let message;
    try {
        message = await channel.messages.fetch(messageId);
    } catch (error) {
        await interaction.reply({ content: 'メッセージが見つかりません。', ephemeral: true });
        return;
    }

    switch (subcommand) {
        case 'add': {
            try {
                // カスタム絵文字のIDを抽出（例: <:emojiName:emojiId>）
                const emojiId = emoji.match(/<:[^:]+:(\d+)>/)?.[1] || emoji;
                const resolvedEmoji = interaction.client.emojis.cache.get(emojiId) || emoji;
                await message.react(resolvedEmoji);
                await interaction.reply({ content: `リアクション ${emoji} を追加しました。`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: '無効な絵文字か、リアクションの追加に失敗しました。', ephemeral: true });
            }
            break;
        }

        case 'remove': {
            try {
                const emojiId = emoji.match(/<:[^:]+:(\d+)>/)?.[1] || emoji;
                const resolvedEmoji = interaction.client.emojis.cache.get(emojiId) || emoji;
                await message.reactions.cache.get(resolvedEmoji.id || resolvedEmoji)?.remove();
                await interaction.reply({ content: `リアクション ${emoji} を削除しました。`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: '無効な絵文字か、リアクションの削除に失敗しました。', ephemeral: true });
            }
            break;
        }

        case 'allremove': {
            try {
                await message.reactions.removeAll();
                await interaction.reply({ content: 'すべてのリアクションを削除しました。', ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: 'リアクションの削除に失敗しました。', ephemeral: true });
            }
            break;
        }

        case 'mention': {
            try {
                const emojiId = emoji.match(/<:[^:]+:(\d+)>/)?.[1] || emoji;
                const reaction = message.reactions.cache.get(emojiId) || message.reactions.cache.find(r => r.emoji.name === emoji);
                if (!reaction) {
                    await interaction.reply({ content: '指定されたリアクションが見つかりません。', ephemeral: true });
                    return;
                }
                const users = await reaction.users.fetch();
                const userArray = users.filter(user => !user.bot).random();
                if (!userArray) {
                    await interaction.reply({ content: 'リアクションしたユーザーがいません。', ephemeral: true });
                    return;
                }
                await interaction.reply({ content: `<@${userArray.id}> がランダムに選ばれました！`, ephemeral: false });
            } catch (error) {
                await interaction.reply({ content: 'メンションの処理に失敗しました。', ephemeral: true });
            }
            break;
        }

        case 'random': {
            try {
                const emojis = interaction.client.emojis.cache.filter(e => e.animated || !e.animated).random();
                if (!emojis) {
                    await interaction.reply({ content: '利用可能な絵文字がありません。', ephemeral: true });
                    return;
                }
                await message.react(emojis);
                await interaction.reply({ content: `ランダムな絵文字 ${emojis} を追加しました。`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: 'ランダムな絵文字の追加に失敗しました。', ephemeral: true });
            }
            break;
        }
    }
}