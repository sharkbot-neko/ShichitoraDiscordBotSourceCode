import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
const commands = [];
const foldersPath = path.join(process.cwd(), 'commands');
const commandFolders = fs.readdirSync(foldersPath);

// commands regist
export default async() => {
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      await import(filePath).then(module => {
        commands.push(module.data.toJSON());
      });
    }
  }
  const rest = new REST().setToken(process.env.TOKEN);
  (async () => {
    try {
      const data = await rest.put(
        Routes.applicationCommands(process.env.BOT_ID),
        { body: commands },
      );
      const dataGuild = await rest.put(
        Routes.applicationCommands(process.env.BOT_ID),
        { body: commands },
      );
    } catch (error) {
      console.error(error);
    }
  })();
};
