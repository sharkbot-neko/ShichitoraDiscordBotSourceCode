import { EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import Tesseract from 'tesseract.js';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const patterns = {
// 正規表現は、情報漏洩・脆弱性検証の対策として非公開にしています。
};

const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.svg', '.PNG', '.JPG', '.JPEG', '.GIF', '.WEBP', '.BMP', '.AVIF', '.SVG'];
const videoExts = ['.mov', '.mp4', '.mpeg', '.mpg', '.MOV', '.MP4', '.MPEG', '.MPG'];
const textExts = ['.txt', '.json', '.js', '.py', '.html', '.htm', '.css', '.php', '.md', '.ts', '.mjs', '.ejs', '.TXT', '.JSON', '.JS', '.PY', '.HTML', '.HTM', '.CSS', '.PHP', '.MD', '.TS', '.MJS', '.EJS'];

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187",
  "850493201064132659",
  "302050872383242240",
  "761562078095867916",
  "1233072112139501608",
  "903541413298450462",
  "935855687400054814"
]);

const messageHistory = new Map();
const actionHistory = new Map();

async function cleanupFiles(tempFile, framesDir) {
  try {
    if (tempFile && (await fs.stat(tempFile).catch(() => null))) {
      await fs.unlink(tempFile);
      console.log(`Deleted temporary file: ${tempFile}`);
    }
  } catch (err) {
    console.error(`Error deleting temporary file ${tempFile}:`, err);
  }
  try {
    if (framesDir && (await fs.stat(framesDir).catch(() => null))) {
      await fs.rm(framesDir, { recursive: true, force: true });
      console.log(`Deleted temporary frames directory: ${framesDir}`);
    }
  } catch (err) {
    console.error(`Error deleting frames directory ${framesDir}:`, err);
  }
}

async function cleanupOldFiles() {
  const tempDir = process.env.HOME || '/tmp';
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      if (file.startsWith('temp_') || file.startsWith('frames_')) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath).catch(() => null);
        if (stats && Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          if (stats.isFile()) {
            await fs.unlink(filePath);
            console.log(`Deleted old temporary file: ${filePath}`);
          } else if (stats.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
            console.log(`Deleted old temporary directory: ${filePath}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error during old files cleanup:', err);
  }
}
setTimeout(cleanupOldFiles, 0);
setInterval(cleanupOldFiles, 60 * 60 * 1000);

async function processMessage(message, isUpdate = false, oldMessage = null) {
  let commandUser = null;
  if (message.interactionMetadata) {
    try {
      commandUser = message.interactionMetadata.user;
    } catch (err) {
      console.error('Error checking interaction:', err);
    }
  }

  if (bypassUserIds.has(message.author.id)) return;
  if (message.system || message.author.id === message.guild.ownerId) return;

  const guildId = message.guildId;
  const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
  let settings;
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (err) {
    return;
  }

  if (settings.notBot?.enabled && message.author.bot) return;
  if (settings.notAdmin?.enabled && message.member?.permissions.has('Administrator')) return;
  
  settings.whitelist = {
  channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
  categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
  roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
  members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
  };

  settings.ruleWhitelist = settings.ruleWhitelist ?? {};

  settings.antiTroll = settings.antiTroll ?? {
  enabled: false,
  rules: {
    invite_link: { enabled: false }
  }
  };
  const guildSettings = settings;
  if (!guildSettings) return;

  const channel = message.channel;
  const isSenderWhitelisted =
  (settings.whitelist.channels ?? []).some((ch) => ch === message.channelId) ||
  (settings.whitelist.categories ?? []).some((cat) => cat === channel.parentId) ||
  message.member?.roles.cache.some((role) => (settings.whitelist.roles ?? []).some((r) => r === role.id)) ||
  (settings.whitelist.members ?? []).some((m) => m === message.author.id);

  let isCommandUserWhitelisted = false;
  if (commandUser) {
  const commandMember = await message.guild.members.fetch(commandUser.id).catch(() => null);
  isCommandUserWhitelisted =
    (settings.whitelist.members ?? []).some((m) => m === commandUser.id) ||
    (commandMember && commandMember.roles.cache.some((role) => (settings.whitelist.roles ?? []).some((r) => r === role.id)));
  }

  if (!guildSettings.antiTroll?.enabled) return;
  let violation = null;
  
  for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
    if (!config.enabled) continue;

    const ruleWhitelist = settings.ruleWhitelist[rule] ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };
    const isSenderRuleWhitelisted =
      ruleWhitelist.channels.some((ch) => ch === message.channelId) ||
      ruleWhitelist.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => ruleWhitelist.roles.some((r) => r === role.id)) ||
      ruleWhitelist.members.some((m) => m === message.author.id);

    let isCommandUserRuleWhitelisted = false;
    if (commandUser) {
      const commandMember = await message.guild.members.fetch(commandUser.id).catch(() => null);
      isCommandUserRuleWhitelisted =
        ruleWhitelist.members.some((m) => m === commandUser.id) ||
        (commandMember && commandMember.roles.cache.some((role) => ruleWhitelist.roles.some((r) => r === role.id)));
    }

    if (isSenderRuleWhitelisted || (commandUser && isCommandUserRuleWhitelisted)) {
      continue;
    }

    if (patterns[rule] && patterns[rule].test(message.content)) {
      violation = rule;
      break;
    }
  }

  if (!violation) {
    for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
      if (!config.enabled) continue;
      if (patterns[rule] && patterns[rule].test(message.content)) {
        violation = rule;
      }
    }
  }

  if (!violation && message.poll) {
    const pollQuestion = message.poll.question?.text;
    if (pollQuestion) {
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule] && pollQuestion.match(patterns[rule])) {
          violation = rule;
          break;
        }
      }
    }
    if (!violation && message.poll.answers?.size > 0) {
      const pollAnswers = message.poll.answers.map(answer => answer.poll_media?.text).filter(text => text);
      for (const answerText of pollAnswers) {
        for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
          if (!config.enabled) continue;
          if (patterns[rule] && answerText.match(patterns[rule])) {
            violation = rule;
            break;
          }
        }
        if (violation) break;
      }
    }
  }
  if (!violation && message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      const filename = attachment.name || '';
      const ext = path.extname(filename).toLowerCase();
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule] && filename.match(patterns[rule])) {
          violation = rule;
          console.log(`Violation in attachment filename: ${rule} - ${filename}`);
          break;
        }
      }
      if (violation) break;
      if (imageExts.includes(ext)) {
        try {
          const response = await fetch(attachment.url, { timeout: 5000 });
          if (response.headers.get('content-type')?.startsWith('image/')) {
            if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
              continue;
            }
            const buffer = await response.buffer();
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
            for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
              if (!config.enabled) continue;
              if (patterns[rule] && text.match(patterns[rule])) {
                violation = rule;
                break;
              }
            }
          }
        } catch (err) {
          console.error(`Error processing image ${filename}:`, err);
        }
      }
      if (videoExts.includes(ext)) {
        let tempFile, framesDir;
        try {
          const response = await fetch(attachment.url, { timeout: 5000 });
          if (response.headers.get('content-type')?.startsWith('video/')) {
            if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
              continue;
            }
            const buffer = await response.buffer();
            tempFile = path.join(process.env.HOME || '/tmp', `temp_${Date.now()}${ext}`);
            framesDir = path.join(process.env.HOME || '/tmp', `frames_${Date.now()}`);
            await fs.writeFile(tempFile, buffer);
            await fs.mkdir(framesDir);
            await new Promise((resolve, reject) => {
              ffmpeg(tempFile)
                .setDuration(5)
                .outputOptions(['-vf fps=1'])
                .output(`${framesDir}/frame-%d.png`)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });
            const frameFiles = await fs.readdir(framesDir);
            for (const frame of frameFiles) {
              const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
              for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                if (!config.enabled) continue;
                if (patterns[rule] && text.match(patterns[rule])) {
                  violation = rule;
                  break;
                }
              }
              if (violation) break;
            }
          }
        } catch (err) {
          console.error(`Error processing video ${filename}:`, err);
        } finally {
          await cleanupFiles(tempFile, framesDir);
        }
      }
      if (textExts.includes(ext)) {
        try {
          const response = await fetch(attachment.url, { timeout: 5000 });
          const text = (await response.text()).slice(0, 500);
          for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
            if (!config.enabled) continue;
            if (patterns[rule] && text.match(patterns[rule])) {
              violation = rule;
              break;
            }
          }
        } catch (err) {
          console.error(`Error processing text file ${filename}:`, err);
        }
      }
      if (violation) break;
    }
  }
  if (!violation && message.embeds.length > 0) {
    for (const embed of message.embeds) {
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule]) {
          if (embed.provider?.name && patterns[rule].test(embed.provider.name)) {
            violation = rule;
            break;
          }
          if (embed.provider?.url && patterns[rule].test(embed.provider.url)) {
            violation = rule;
            break;
          }
          if (rule === 'invite_link' && embed.provider?.name === 'Discord') {
            violation = rule;
            break;
          }
          if (
            embed.description?.match(patterns[rule]) ||
            embed.title?.match(patterns[rule]) ||
            embed.url?.match(patterns[rule]) ||
            embed.footer?.text?.match(patterns[rule])
          ) {
            violation = rule;
            break;
          }
          if (embed.fields?.length > 0) {
            for (const field of embed.fields) {
              if (
                (field.name && patterns[rule].test(field.name)) ||
                (field.value && patterns[rule].test(field.value))
              ) {
                violation = rule;
                break;
              }
            }
          }
          if (embed.author && (embed.author.name?.match(patterns[rule]) || embed.author.url?.match(patterns[rule]))) {
            violation = rule;
            break;
          }
        }
        if (violation) break;
      }
      if (!violation && (embed.thumbnail?.url || embed.image?.url)) {
        const imgUrl = embed.thumbnail?.url || embed.image?.url;
        const ext = path.extname(imgUrl || '').toLowerCase();
        if (imageExts.includes(ext)) {
          try {
            const response = await fetch(imgUrl, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('image/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
              for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                if (!config.enabled) continue;
                if (patterns[rule] && text.match(patterns[rule])) {
                  violation = rule;
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`Error processing embed image ${imgUrl}:`, err);
          }
        }
      }
      if (!violation && embed.video?.url) {
        const ext = path.extname(embed.video.url || '').toLowerCase();
        let tempFile, framesDir;
        if (videoExts.includes(ext)) {
          try {
            const response = await fetch(embed.video.url, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('video/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              tempFile = path.join(process.env.HOME || '/tmp', `temp_embed_${Date.now()}${ext || '.mp4'}`);
              framesDir = path.join(process.env.HOME || '/tmp', `frames_embed_${Date.now()}`);
              await fs.writeFile(tempFile, buffer);
              await fs.mkdir(framesDir);
              await new Promise((resolve, reject) => {
                ffmpeg(tempFile)
                  .setDuration(5)
                  .outputOptions(['-vf fps=1'])
                  .output(`${framesDir}/frame-%d.png`)
                  .on('end', resolve)
                  .on('error', reject)
                  .run();
              });
              const frameFiles = await fs.readdir(framesDir);
              for (const frame of frameFiles) {
                const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
                for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                  if (!config.enabled) continue;
                  if (patterns[rule] && text.match(patterns[rule])) {
                    violation = rule;
                    break;
                  }
                }
                if (violation) break;
              }
            }
          } catch (err) {
            console.error(`Error processing embed video ${embed.video.url}:`, err);
          } finally {
            await cleanupFiles(tempFile, framesDir);
          }
        }
      }
      if (violation) break;
    }
  }
  if (!violation && message.messageSnapshots?.size) {
    const snapshot = message.messageSnapshots.first();
    const snapshotContent = snapshot.content || '';
    if (snapshotContent) {
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule]?.test(snapshotContent)) {
          violation = rule;
          break;
        }
      }
    }
    if (!violation && snapshot.embeds?.length) {
      for (const embed of snapshot.embeds) {
        for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
          if (!config.enabled) continue;
          if (patterns[rule]) {
            if (embed.provider?.name && patterns[rule].test(embed.provider.name)) {
              violation = rule;
              break;
            }
            if (embed.provider?.url && patterns[rule].test(embed.provider.url)) {
              violation = rule;
              break;
            }
            if (
              embed.title?.match(patterns[rule]) ||
              embed.description?.match(patterns[rule]) ||
              embed.url?.match(patterns[rule]) ||
              embed.footer?.text?.match(patterns[rule])
            ) {
              violation = rule;
              break;
            }
            if (embed.fields?.length > 0) {
              for (const field of embed.fields) {
                if (
                  (field.name && patterns[rule].test(field.name)) ||
                  (field.value && patterns[rule].test(field.value))
                ) {
                  violation = rule;
                  break;
                }
              }
            }
            if (embed.author && (embed.author.name?.match(patterns[rule]) || embed.author.url?.match(patterns[rule]))) {
              violation = rule;
              break;
            }
          }
          if (violation) break;
        }
        if (!violation && (embed.thumbnail?.url || embed.image?.url)) {
          const imgUrl = embed.thumbnail?.url || embed.image?.url;
          const ext = path.extname(imgUrl || '').toLowerCase();
          if (imageExts.includes(ext)) {
            try {
              const response = await fetch(imgUrl, { timeout: 5000 });
              if (response.headers.get('content-type')?.startsWith('image/')) {
                if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                  continue;
                }
                const buffer = await response.buffer();
                const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
                for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                  if (!config.enabled) continue;
                  if (patterns[rule] && text.match(patterns[rule])) {
                    violation = rule;
                    break;
                  }
                }
              }
            } catch (err) {
              console.error(`Error processing snapshot embed image ${imgUrl}:`, err);
            }
          }
        }
        if (!violation && embed.video?.url) {
          const ext = path.extname(embed.video.url || '').toLowerCase();
          let tempFile, framesDir;
          if (videoExts.includes(ext)) {
            try {
              const response = await fetch(embed.video.url, { timeout: 5000 });
              if (response.headers.get('content-type')?.startsWith('video/')) {
                if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                  continue;
                }
                const buffer = await response.buffer();
                tempFile = path.join(process.env.HOME || '/tmp', `temp_snap_${Date.now()}${ext || '.mp4'}`);
                framesDir = path.join(process.env.HOME || '/tmp', `frames_snap_${Date.now()}`);
                await fs.writeFile(tempFile, buffer);
                await fs.mkdir(framesDir);
                await new Promise((resolve, reject) => {
                  ffmpeg(tempFile)
                    .setDuration(5)
                    .outputOptions(['-vf fps=1'])
                    .output(`${framesDir}/frame-%d.png`)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
                });
                const frameFiles = await fs.readdir(framesDir);
                for (const frame of frameFiles) {
                  const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
                  for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                    if (!config.enabled) continue;
                    if (patterns[rule] && text.match(patterns[rule])) {
                      violation = rule;
                      break;
                    }
                  }
                  if (violation) break;
                }
              }
            } catch (err) {
              console.error(`Error processing snapshot embed video ${embed.video.url}:`, err);
            } finally {
              await cleanupFiles(tempFile, framesDir);
            }
          }
        }
        if (violation) break;
      }
    }
    if (!violation && snapshot.attachments?.size > 0) {
      for (const attachment of snapshot.attachments.values()) {
        const filename = attachment.name || '';
        const ext = path.extname(filename).toLowerCase();
        for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
          if (!config.enabled) continue;
          if (patterns[rule] && filename.match(patterns[rule])) {
            violation = rule;
            break;
          }
        }
        if (violation) break;
        if (imageExts.includes(ext)) {
          try {
            const response = await fetch(attachment.url, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('image/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
              for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                if (!config.enabled) continue;
                if (patterns[rule] && text.match(patterns[rule])) {
                  violation = rule;
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`Error processing snapshot image ${filename}:`, err);
          }
        }
        if (videoExts.includes(ext)) {
          let tempFile, framesDir;
          try {
            const response = await fetch(attachment.url, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('video/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              tempFile = path.join(process.env.HOME || '/tmp', `temp_snap_${Date.now()}${ext}`);
              framesDir = path.join(process.env.HOME || '/tmp', `frames_snap_${Date.now()}`);
              await fs.writeFile(tempFile, buffer);
              await fs.mkdir(framesDir);
              await new Promise((resolve, reject) => {
                ffmpeg(tempFile)
                  .setDuration(5)
                  .outputOptions(['-vf fps=1'])
                  .output(`${framesDir}/frame-%d.png`)
                  .on('end', resolve)
                  .on('error', reject)
                  .run();
              });
              const frameFiles = await fs.readdir(framesDir);
              for (const frame of frameFiles) {
                const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
                for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                  if (!config.enabled) continue;
                  if (patterns[rule] && text.match(patterns[rule])) {
                    violation = rule;
                    break;
                  }
                }
                if (violation) break;
              }
            }
          } catch (err) {
            console.error(`Error processing snapshot video ${filename}:`, err);
          } finally {
            await cleanupFiles(tempFile, framesDir);
          }
        }
        if (textExts.includes(ext)) {
          try {
            const response = await fetch(attachment.url, { timeout: 5000 });
            const text = (await response.text()).slice(0, 500);
            for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
              if (!config.enabled) continue;
              if (patterns[rule] && text.match(patterns[rule])) {
                violation = rule;
                break;
              }
            }
          } catch (err) {
            console.error(`Error processing snapshot text file ${filename}:`, err);
          }
        }
        if (violation) break;
      }
    }
  }

  if (message.components?.length > 0) {
    for (const actionRow of message.components) {
      if (!actionRow.components || !Array.isArray(actionRow.components)) {
        continue;
      }
      for (const component of actionRow.components) {
        const textFields = [];
        if (component.type === 2) {
          if (component.label) textFields.push({ field: 'button label', value: component.label });
          if (component.custom_id) textFields.push({ field: 'button customId', value: component.custom_id });
          if (component.url) textFields.push({ field: 'button URL', value: component.url });
        }
        if (component.type === 3) {
          if (component.custom_id) textFields.push({ field: 'select menu customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'select menu placeholder', value: component.placeholder });
          for (const option of component.options || []) {
            if (option.label) textFields.push({ field: 'select menu option label', value: option.label });
            if (option.description) textFields.push({ field: 'select menu option description', value: option.description });
            if (option.value) textFields.push({ field: 'select menu option value', value: option.value });
          }
        }
        if (component.type === 4) {
          if (component.custom_id) textFields.push({ field: 'text input customId', value: component.custom_id });
          if (component.label) textFields.push({ field: 'text input label', value: component.label });
          if (component.placeholder) textFields.push({ field: 'text input placeholder', value: component.placeholder });
          if (component.value) textFields.push({ field: 'text input value', value: component.value });
        }
        if (component.type === 5) {
          if (component.custom_id) textFields.push({ field: 'user select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'user select placeholder', value: component.placeholder });
        }
        if (component.type === 6) {
          if (component.custom_id) textFields.push({ field: 'role select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'role select placeholder', value: component.placeholder });
        }
        if (component.type === 7) {
          if (component.custom_id) textFields.push({ field: 'mentionable select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'mentionable select placeholder', value: component.placeholder });
        }
        if (component.type === 8) {
          if (component.custom_id) textFields.push({ field: 'channel select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'channel select placeholder', value: component.placeholder });
        }
        if (component.type === 9) {
          if (component.custom_id) textFields.push({ field: 'section customId', value: component.custom_id });
          if (component.title) textFields.push({ field: 'section title', value: component.title });
          if (component.accessory) {
            if (component.accessory.description) textFields.push({ field: 'section accessory description', value: component.accessory.description });
            if (component.accessory.url) textFields.push({ field: 'section accessory URL', value: component.accessory.url });
          }
          if (component.components) {
            for (const subComponent of component.components) {
              if (subComponent.content) textFields.push({ field: 'section subcomponent content', value: subComponent.content });
              if (subComponent.custom_id) textFields.push({ field: 'section subcomponent customId', value: subComponent.custom_id });
            }
          }
        }
        if (component.type === 10) {
          if (component.custom_id) textFields.push({ field: 'text display customId', value: component.custom_id });
          if (component.content) textFields.push({ field: 'text display content', value: component.content });
        }
        if (component.type === 11) {
          if (component.custom_id) textFields.push({ field: 'thumbnail customId', value: component.custom_id });
          if (component.description) textFields.push({ field: 'thumbnail description', value: component.description });
          if (component.url) textFields.push({ field: 'thumbnail URL', value: component.url });
        }
        if (component.type === 12) {
          if (component.custom_id) textFields.push({ field: 'media gallery customId', value: component.custom_id });
          for (const item of component.items || []) {
            if (item.description) textFields.push({ field: 'media gallery item description', value: item.description });
            if (item.url) textFields.push({ field: 'media gallery item URL', value: item.url });
          }
        }
        if (component.type === 13) {
          if (component.custom_id) textFields.push({ field: 'file customId', value: component.custom_id });
          if (component.url) textFields.push({ field: 'file URL', value: component.url });
        }
        if (component.type === 14) {
          if (component.custom_id) textFields.push({ field: 'separator customId', value: component.custom_id });
        }
        if (component.type === 17) {
          if (component.custom_id) textFields.push({ field: 'container customId', value: component.custom_id });
          if (component.components) {
            for (const subComponent of component.components) {
              if (subComponent.content) textFields.push({ field: 'container subcomponent content', value: subComponent.content });
              if (subComponent.custom_id) textFields.push({ field: 'container subcomponent customId', value: subComponent.custom_id });
              if (subComponent.description) textFields.push({ field: 'container subcomponent description', value: subComponent.description });
              if (subComponent.url) textFields.push({ field: 'container subcomponent URL', value: subComponent.url });
            }
          }
        }
        for (const { field, value } of textFields) {
          for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
            if (!config.enabled) continue;
            if (patterns[rule] && value.match(patterns[rule])) {
              violation = rule;
              break;
            }
          }
          if (violation) break;
        }
        if (violation) break;
      }
      if (violation) break;
    }
  }

  if (violation) {
    if (!isSenderWhitelisted || (commandUser && !isCommandUserWhitelisted)) {
      await handleViolation(
        message,
        violation,
        guildSettings,
        isUpdate,
        commandUser && !isCommandUserWhitelisted ? commandUser : null
      );
    }
  }
}

export async function execute(message) {
  await processMessage(message, false);
}

export async function executeUpdate(oldMessage, newMessage) {
  if (newMessage.partial) {
    try {
      newMessage = await newMessage.fetch();
    } catch (err) {
      console.error('Error fetching updated message:', err);
      return;
    }
  }
  await processMessage(newMessage, true, oldMessage);
}

function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1, s2) {
  const costs = new Array(s2.length + 1).fill(0);
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1[i - 1] !== s2[j - 1])
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

async function handleViolation(message, rule, settings, isUpdate = false, commandUser = null) {
  const points = settings.points[rule] || 1;
  const guildId = message.guildId;
  const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
  const targetUsers = [];
  const isBotSender = message.author.bot;
  const isBotBypassed = isBotSender && bypassUserIds.has(message.author.id);
  if (!bypassUserIds.has(message.author.id)) {
    targetUsers.push({ id: message.author.id, tag: message.author.tag, member: message.member });
  }
  if (commandUser && !bypassUserIds.has(commandUser.id)) {
    const commandMember = await message.guild.members.fetch(commandUser.id).catch(() => null);
    if (commandMember) {
      targetUsers.push({ id: commandUser.id, tag: commandUser.tag, member: commandMember });
    }
  }
  let pointsData;
  try {
    pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
  } catch (err) {
    pointsData = {};
    try {
      await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
    } catch (writeErr) {
      return;
    }
  }
  if (!pointsData[guildId]) pointsData[guildId] = {};
  const userPunishments = new Map();
  for (const user of targetUsers) {
    if (!pointsData[guildId][user.id]) pointsData[guildId][user.id] = { points: 0, lastViolation: null };
    pointsData[guildId][user.id].points += points;
    pointsData[guildId][user.id].lastViolation = Date.now();
    const totalPoints = pointsData[guildId][user.id].points;
    const thresholds = settings.points.thresholds || { '10': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' };
    let punishment = null;
    for (const [point, action] of Object.entries(thresholds)) {
      if (totalPoints >= parseInt(point)) punishment = action;
    }
    if (settings.block.enabled && punishment && user.member) {
      try {
        if (punishment === 'timeout') {
          await user.member.timeout(settings.block.timeout || 600000, `Violation: ${rule}`);
        } else if (punishment === 'kick') {
          await user.member.kick(`Violation: ${rule}`);
        } else if (punishment === 'ban') {
          await message.guild.members.ban(user.id, { reason: `Violation: ${rule}` });
        } else if (punishment === 'delete_webhook' && message.webhookId) {
        const webhookId = message.webhookId;
        let webhook = null;

        try {
          const channelHooks = await message.channel.fetchWebhooks();
          webhook = channelHooks.find(w => w.id === webhookId);
        } catch { }

        if (!webhook) {
          try {
            const guildHooks = await message.guild.fetchWebhooks();
            webhook = guildHooks.find(w => w.id === webhookId);
          } catch { }
        }

        if (webhook) {
          await webhook.delete(`Anti-Troll: Webhook violated rule "${rule}" (${totalPoints}pts)`);
        }
      }
      } catch (err) {}
    }
    userPunishments.set(user.id, punishment);
  }
  try {
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
  } catch (err) {
    return;
  }
  let messageDeleted = false;
  const messageContent =  message.content || "埋め込み・転送・コンポーネント・画像内文字などが検知された可能性があります。";
    if (settings.logWebhook) {
      const embed = new EmbedBuilder()
        .setTitle(`Anti-Troll Violation (${isUpdate ? 'Message Update' : 'Message Create'})`)
        .setDescription(
          `**User**: ${message.author.tag} (${message.author.id})\n` +
          (commandUser ? `**Command User**: ${commandUser.tag} (${commandUser.id})\n` : '') +
          `**Rule**: ${rule}\n` +
          `**Points**: ${pointsData[guildId][message.author.id]?.points || 0}\n` +
          (commandUser ? `**Command User Points**: ${pointsData[guildId][commandUser.id]?.points || 0}\n` : '') +
          `**Punishment**: ${targetUsers
            .map((u) => (u.member && userPunishments.get(u.id) ? userPunishments.get(u.id) : 'None'))
            .join(', ')}\n` +
          `**Message Deleted**: ${isBotBypassed ? 'No (Bot Bypassed)' : commandUser && bypassUserIds.has(commandUser.id) ? 'No (Executor Bypassed)' : 'Yes'}` +
          `**Message**: ${messageContent}`
        )
        .setTimestamp();
      try {
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
      } catch (err) {
    }
  }
  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`Anti-Troll Violation from ${message.guild.name} (${isUpdate ? 'Message Update' : 'Message Create'})`)
      .setDescription(
        `**Server**: ${message.guild.name} (${message.guildId})\n` +
        `**Channel**: ${message.channel.name} (${message.channelId})\n` +
        `**User**: ${message.author.tag} (${message.author.id})\n` +
        (commandUser ? `**Command User**: ${commandUser.tag} (${commandUser.id})\n` : '') +
        `**Rule**: ${rule}\n` +
        `**Points**: ${pointsData[guildId][message.author.id]?.points || 0}\n` +
        (commandUser ? `**Command User Points**: ${pointsData[guildId][commandUser.id]?.points || 0}\n` : '') +
        `**Punishment**: ${targetUsers
          .map((u) => (u.member && userPunishments.get(u.id) ? userPunishments.get(u.id) : 'None'))
          .join(', ')}\n` +
        `**Message Deleted**: ${isBotBypassed ? 'No (Bot Bypassed)' : commandUser && bypassUserIds.has(commandUser.id) ? 'No (Executor Bypassed)' : 'Yes'}\n` +
        `**Message**: ${messageContent}`
      )
      .setTimestamp();
    try {
      await axios.post(webhookUrl, {
        embeds: [embed.toJSON()]
      });
    } catch (err) {}
  } else {}
  if (!isBotBypassed && !(commandUser && bypassUserIds.has(commandUser.id))) {
    try {
      await message.delete();
      messageDeleted = true;
    } catch (err) {}
  }
}

const MAP_CLEANUP_INTERVAL = 60 * 60 * 1000;
const MAP_ENTRY_TTL = 60 * 60 * 1000;
async function cleanupMaps() {
  const now = Date.now();
  for (const [key, value] of messageHistory.entries()) {
    if (value.timestamp && now - value.timestamp > MAP_ENTRY_TTL) {
      messageHistory.delete(key);
    }
  }
  for (const [key, value] of actionHistory.entries()) {
    if (value.timestamp && now - value.timestamp > MAP_ENTRY_TTL) {
      actionHistory.delete(key);
    }
  }
}
setTimeout(cleanupMaps, MAP_CLEANUP_INTERVAL);
setInterval(cleanupMaps, MAP_CLEANUP_INTERVAL);
