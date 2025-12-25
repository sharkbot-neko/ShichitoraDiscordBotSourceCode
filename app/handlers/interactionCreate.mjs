export default async(interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`「${interaction.commandName}」コマンドは見つかりませんでした。`);
    return;
  }
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `エラーが発生しました。`, ephemeral: true });
    } else {
      await interaction.editReply({ content: `エラーが発生しました。`, ephemeral: true });
    }
  }
};
