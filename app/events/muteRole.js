import { Events } from 'discord.js';
import { join } from 'path';
import { readFile } from 'fs/promises';

export function handleMuteRole(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    if (message.system || message.author.id === message.guild.ownerId) return;

    const guildId = message.guild.id;
    const settingsPath = join(process.cwd(), 'settings', `${guildId}.json`);

    let settings;
    try {
      const data = await readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
    } catch (err) {
      return;
    }

    const muteRoleId = settings.muteRoleId;
    if (!muteRoleId) return;

    const muteRole = message.guild.roles.cache.get(muteRoleId);
    if (!muteRole) return;

    if (message.member.roles.cache.has(muteRoleId)) {
      try {
        await message.delete();
      } catch (error) {}
    }
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (!newState.guild || newState.member.user.bot) return;
    if (newState.member.id === newState.guild.ownerId) return;

    const guildId = newState.guild.id;
    const settingsPath = join(process.cwd(), 'settings', `${guildId}.json`);

    let settings;
    try {
      const data = await readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
    } catch (err) {
      return;
    }

    const muteRoleId = settings.muteRoleId;
    if (!muteRoleId) return;

    const muteRole = newState.guild.roles.cache.get(muteRoleId);
    if (!muteRole) return;

    if (newState.member.roles.cache.has(muteRoleId)) {
      if (newState.channelId && oldState.channelId !== newState.channelId) {
        try {
          await newState.disconnect('Muted user is not allowed to join voice channels');
        } catch (error) {}
      }
    }
  });

  client.on(Events.ThreadCreate, async (thread) => {
    if (!thread.guild || thread.owner?.bot) return;

    const guildId = thread.guild.id;
    const settingsPath = join(process.cwd(), 'settings', `${guildId}.json`);

    let settings;
    try {
      const data = await readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
    } catch (err) {
      return;
    }

    const muteRoleId = settings.muteRoleId;
    if (!muteRoleId) return;

    const muteRole = thread.guild.roles.cache.get(muteRoleId);
    if (!muteRole) return;

    const member = await thread.guild.members.fetch(thread.ownerId).catch(() => null);
    if (!member) return;

    if (member.roles.cache.has(muteRoleId)) {
      try {
        await thread.delete('Muted user is not allowed to create threads');
      } catch (error) {}
    }
  });

  client.on(Events.GuildScheduledEventCreate, async (event) => {
    if (!event.guild || !event.creator) return;

    const guildId = event.guild.id;
    const settingsPath = join(process.cwd(), 'settings', `${guildId}.json`);

    let settings;
    try {
      const data = await readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
    } catch (err) {
      return;
    }

    const muteRoleId = settings.muteRoleId;
    if (!muteRoleId) return;

    const muteRole = event.guild.roles.cache.get(muteRoleId);
    if (!muteRole) return;

    const member = await event.guild.members.fetch(event.creator.id).catch(() => null);
    if (!member) return;

    if (member.roles.cache.has(muteRoleId)) {
      try {
        await event.delete('Muted user is not allowed to create events');
      } catch (error) {}
    }
  });
}