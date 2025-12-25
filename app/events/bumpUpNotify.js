import { EmbedBuilder } from 'discord.js';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';

const PATTERNS = {
  DISBOARD: {
    SUCCESS: /表示順をアップしたよ|Bump done|Bump effectué|Bump fatto|Podbito serwer|Успешно поднято|갱신했어|Patlatmap tamamlandı/,
    FAILURE: /上げられるようになるまで/,
    NOTIFY_AFTER: 2 * 60 * 60 * 1000,
  },
  DISSOKU: {
    SUCCESS: /ActiveLevel/,
    FAILURE: /間隔をあけてください/,
    NOTIFY_AFTER: 2 * 60 * 60 * 1000,
  },
  DCAFE: {
    SUCCESS: /サーバーの表示順位を上げました/,
    NOTIFY_AFTER: 1 * 60 * 60 * 1000,
  },
  DICOALL: {
    SUCCESS: /サーバーが上位に表示されました/,
    FAILURE: /分残りました/,
    NOTIFY_AFTER: 1 * 60 * 60 * 1000,
  },
  TAKASUMIBOT: {
    SUCCESS: /表示順位が更新されました/,
    NOTIFY_AFTER: 1 * 60 * 60 * 1000,
  },
  DISCADIA: {
    SUCCESS: /has been successfully bumped\!/,
    FAILURE: /please try again|You must be \*\*owner\*\*\, \*\*admin\*\*\, or have the \'\*\*manage server\*\*\' permission to bump this server\./,
    NOTIFY_AFTER: 24 * 60 * 60 * 1000,
  },
  DISTOPIA: {
    SUCCESS: /表示順を上げました/,
    NOTIFY_AFTER: 2 * 60 * 60 * 1000,
  },
  SABACHANNEL: {
    SUCCESS: /このサーバーに1票を投じました|The display order of the server has been changed to a higher position\!/,
    NOTIFY_AFTER: 2 * 60 * 60 * 1000,
  },
  DISLIST: {
    SUCCESS: /掲載順位を更新しました/,
    FAILURE: /クールダウン中/,
    NOTIFY_AFTER: 1 * 60 * 60 * 1000,
  },
  SHARKBOT: {
    SUCCESS: /に再度Upできます/,
    NOTIFY_AFTER: 2 * 60 * 60 * 1000,
  },
  KOKONATSU: {
    SUCCESS: /サーバーがアップされました/,
    FAILURE: /クールダウン中/,
    NOTIFY_AFTER: 2 * 60 * 60 * 1000,
  }
};

const getServerSettingsPath = (guildId) => join(process.cwd(), 'bump', `${guildId}.json`);
const bumpNotifySettings = new Map();
const bumpSchedules = new Map();

async function ensureBumpDirectory() {
  try {
    await mkdir(join(process.cwd(), 'bump'), { recursive: true });
  } catch (error) {
    console.error('Error creating bump directory:', error);
  }
}

async function loadBumpSettings(guildId) {
  const settingsPath = getServerSettingsPath(guildId);
  try {
    const data = await readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);

    if (typeof settings.enabled !== 'boolean' || (settings.mentionRoleId && typeof settings.mentionRoleId !== 'string')) {
      return { enabled: false, mentionRoleId: null, schedules: [] };
    }
    bumpNotifySettings.set(guildId, settings);
    return settings;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return null;
  }
}

async function loadBumpSchedules(client, guildId) {
  const settings = bumpNotifySettings.get(guildId);
  if (!settings?.schedules?.length) return;

  const now = Date.now();
  for (const schedule of settings.schedules) {
    if (schedule.notifyAt > now) {
      const delay = schedule.notifyAt - now;
      scheduleNotification(client, schedule, delay);
    }
  }
}

async function saveBumpSettings(guildId) {
  const settings = bumpNotifySettings.get(guildId);
  if (!settings) return;

  const schedules = Array.from(bumpSchedules.entries())
    .filter(([id]) => id.startsWith(`${guildId}-`))
    .map(([, s]) => s);

  if (!settings.enabled && !settings.mentionRoleId && schedules.length === 0) {
    return;
  }

  settings.schedules = schedules.map(s => ({
    guildId: s.guildId,
    channelId: s.channelId,
    service: s.service,
    command: s.command,
    notifyAt: s.notifyAt
  }));

  try {
    await writeFile(getServerSettingsPath(guildId), JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error saving settings for guild ${guildId}:`, error);
  }
}

async function scheduleNotification(client, schedule, delay) {
  const scheduleId = `${schedule.guildId}-${schedule.service}-${Date.now()}`;
  bumpSchedules.set(scheduleId, { ...schedule, notifyAt: Date.now() + delay });

  setTimeout(async () => {
    const settings = bumpNotifySettings.get(schedule.guildId);
    if (!settings?.enabled) {
      bumpSchedules.delete(scheduleId);
      await saveBumpSettings(schedule.guildId);
      return;
    }

    try {
      const channel = await client.channels.fetch(schedule.channelId);
      const mention = settings.mentionRoleId ? `<@&${settings.mentionRoleId}> ` : '';

      await channel.send({
        content: mention,
        embeds: [
          new EmbedBuilder()
            .setTitle(`${schedule.service}の${schedule.service === 'SABACHANNEL' ? 'VOTE' : 'BUMP/UP'}通知`)
            .setDescription(`## ${schedule.command} を実行できます`)
            .setColor('#00ff00')
        ]
      });
    } catch (error) {
      console.error(`Error sending ${schedule.service} notification for guild ${schedule.guildId}:`, error);
    }

    bumpSchedules.delete(scheduleId);
    await saveBumpSettings(schedule.guildId);
  }, delay);

  await saveBumpSettings(schedule.guildId);
}

function hasActiveSchedule(guildId, channelId, service) {
  return Array.from(bumpSchedules.values()).some(
    s => s.guildId === guildId && s.channelId === channelId && s.service === service
  );
}

async function handleBump(client, message, service, pattern, command) {
  const guildId = message.guildId;
  await loadBumpSettings(guildId);
  const settings = bumpNotifySettings.get(guildId);
  if (!settings?.enabled) return;

  const embed = message.embeds?.[0];
  const content = embed?.description || embed?.title || message.content;

  if (pattern.SUCCESS.test(content)) {
    if (hasActiveSchedule(guildId, message.channelId, service)) {
      return;
    }

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${service}の${service === 'SABACHANNEL' ? 'VOTE' : 'BUMP/UP'}が実行されました！`)
          .setDescription(`${Math.round(pattern.NOTIFY_AFTER / 3600000)}時間後にお知らせします。`)
          .setColor('#00ff00')
      ]
    });

    scheduleNotification(client, {
      guildId,
      channelId: message.channelId,
      service,
      command,
      notifyAt: Date.now() + pattern.NOTIFY_AFTER
    }, pattern.NOTIFY_AFTER);
  } else if (pattern.FAILURE?.test(content)) {
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${service}の${service === 'SABACHANNEL' ? 'VOTE' : 'BUMP/UP'}に失敗しました...`)
          .setDescription('後で再度お試しください。')
          .setColor('#ff0000')
      ]
    });
  }
}

export function handleBumpUpNotify(client) {
  client.once('ready', async () => {
    await ensureBumpDirectory();
    for (const guild of client.guilds.cache.values()) {
      const settings = await loadBumpSettings(guild.id);
      if (settings) {
        await loadBumpSchedules(client, guild.id);
      } else {
        bumpNotifySettings.set(guild.id, { enabled: false, mentionRoleId: null, schedules: [] });
      }
    }
    console.log('BumpUpNotify initialized');
  });

  client.on('messageCreate', async (message) => {
    if (!message.guildId) return;

    const handlers = [
      { authorId: '302050872383242240', service: 'DISBOARD', pattern: PATTERNS.DISBOARD, command: '</bump:947088344167366698>' },
      { authorId: '850493201064132659', service: 'DCAFE', pattern: PATTERNS.DCAFE, command: '</up:980136954169536525>' },
      { authorId: '903541413298450462', service: 'DICOALL', pattern: PATTERNS.DICOALL, command: '</up:935190259111706754>' },
      { authorId: '981314695543783484', service: 'TAKASUMIBOT', pattern: PATTERNS.TAKASUMIBOT, command: '</up:1135405664852783157>' },
      { authorId: '1300797373374529557', service: 'DISTOPIA', pattern: PATTERNS.DISTOPIA, command: '</bump:1309070135360749620>' },
      { authorId: '1233072112139501608', service: 'SABACHANNEL', pattern: PATTERNS.SABACHANNEL, command: '</vote:1233256792507682860>' },
      { authorId: '1322100616369147924', service: 'SHARKBOT', pattern: PATTERNS.SHARKBOT, command: '</global up:1408658655532023855>' },
    ];

    for (const h of handlers) {
      if (message.author.id === h.authorId && (message.embeds[0] || h.pattern.SUCCESS.test(message.content))) {
        await handleBump(client, message, h.service, h.pattern, h.command);
      }
    }
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guildId) return;

    await loadBumpSettings(newMessage.guildId);
    const settings = bumpNotifySettings.get(newMessage.guildId);
    if (!settings?.enabled) return;

    const handlers = [
      {
        authorId: '761562078095867916',
        service: 'DISSOKU',
        pattern: PATTERNS.DISSOKU,
        command: '</up:1363739182672904354>',
        check: (msg) => msg.embeds?.[0]?.fields?.some(f => PATTERNS.DISSOKU.SUCCESS.test(f.value)),
        failCheck: (msg) => msg.embeds?.[0]?.fields?.some(f => PATTERNS.DISSOKU.FAILURE.test(f.value))
      },
      {
        authorId: '1222548162741538938',
        service: 'DISCADIA',
        pattern: PATTERNS.DISCADIA,
        command: '</bump:1225075208394768496>',
        check: (msg) => PATTERNS.DISCADIA.SUCCESS.test(msg.content),
        failCheck: (msg) => PATTERNS.DISCADIA.FAILURE.test(msg.content)
      },
      {
        authorId: '1402811962211176488',
        service: 'DISLIST',
        pattern: PATTERNS.DISLIST,
        command: '</up:1402872149534052353>',
        check: (msg) => msg.embeds?.[0] && PATTERNS.DISLIST.SUCCESS.test(msg.embeds[0].title),
        failCheck: (msg) => msg.embeds?.[0] && PATTERNS.DISLIST.FAILURE.test(msg.embeds[0].title)
      },
      {
        authorId: '1143814400755646504',
        service: 'KOKONATSU',
        pattern: PATTERNS.KOKONATSU,
        command: '</up:1431222365223649320>',
        check: (msg) => msg.embeds?.[0] && PATTERNS.KOKONATSU.SUCCESS.test(msg.embeds[0].title),
        failCheck: (msg) => msg.embeds?.[0] && PATTERNS.KOKONATSU.FAILURE.test(msg.embeds[0].title)
      },
    ];

    for (const h of handlers) {
      if (newMessage.author.id === h.authorId) {
        const embed = newMessage.embeds?.[0];
        if (!embed) continue;

        if (h.check(newMessage)) {
          if (hasActiveSchedule(newMessage.guildId, newMessage.channelId, h.service)) {
            continue;
          }

          await newMessage.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(`${h.service}のBUMP/UPが実行されました！`)
                .setDescription(`${Math.round(h.pattern.NOTIFY_AFTER / 3600000)}時間後にお知らせします。`)
                .setColor('#00ff00')
            ]
          });

          scheduleNotification(client, {
            guildId: newMessage.guildId,
            channelId: newMessage.channelId,
            service: h.service,
            command: h.command,
            notifyAt: Date.now() + h.pattern.NOTIFY_AFTER
          }, h.pattern.NOTIFY_AFTER);
        } else if (h.failCheck?.(newMessage)) {
          await newMessage.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(`${h.service}のBUMP/UPに失敗しました...`)
                .setDescription('後で再度お試しください。')
                .setColor('#ff0000')
            ]
          });
        }
      }
    }
  });
}

export { bumpNotifySettings, getServerSettingsPath };
