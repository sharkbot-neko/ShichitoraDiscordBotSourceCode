import fs from "fs";
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { loadVerifyData, saveAuthData } from '../utils/verifyData.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import axios from 'axios';
import crypto from 'crypto';
import 'dotenv/config';

const webhookUrl = process.env.DEV_WEBHOOK;
const WEBHOOK_URL = process.env.V_WEBHOOK;
const webhookClient = new WebhookClient({ url: WEBHOOK_URL });

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://verify.discordd.me';

const NOT_IP = JSON.parse(await readFile(join(process.cwd(), './verify/not-ip.json'), 'utf-8'));
const NOT_MAIL = JSON.parse(await readFile(join(process.cwd(), './verify/not-mail.json'), 'utf-8'));
const NOT_SERVER = JSON.parse(await readFile(join(process.cwd(), './verify/not-server.json'), 'utf-8'));
const DANGER_USERS = (await readFile(join(process.cwd(), './verify/danger-users.txt'), 'utf-8'))
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean);
const DANGER_WORDS = (await readFile(join(process.cwd(), './verify/danger-words.txt'), 'utf-8'))
  .split('\n')
  .map(l => l.trim().toLowerCase())
  .filter(Boolean);

const ipCooldown = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;
const CLEANUP_AFTER_MS = 30 * 60 * 1000;

function cleanupOldIps() {
  const now = Date.now();
  for (const [ip, data] of ipCooldown.entries()) {
    if (now - data.lastUsed > CLEANUP_AFTER_MS) {
      ipCooldown.delete(ip);
    }
  }
}

function hashBrowser(browserInfo) {
  if (!browserInfo) return null;
  const normalized = browserInfo
    .replace(/[\d.]+/g, '')
    .replace(/\(.*?compatible.*?\)/gi, '')
    .replace(/\(.*?Windows NT.*?\)/gi, '')
    .replace(/\(.*?Macintosh.*?\)/gi, '')
    .replace(/\(.*?Linux.*?\)/gi, '')
    .trim()
    .toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export async function execute( //...
  ) {
  // VerifyDetaCheckCode...(超重要秘密のため伏せています)

  if (code) {
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return;
    }

    try {
      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        await sendLogAndDM(null, ip, {
          title: '認証失敗 - トークン交換失敗',
          description: 'codeからaccess_tokenへの変換に失敗しました。',
          color: 0xff0000,
          fields: [
            // 情報が入力される
          ],
          userReason: '認証処理に失敗しました。もう一度最初からお試しください。'
        }, client);
        return;
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;

      if (!accessToken) {
        await sendLogAndDM(null, ip, {
          title: '認証失敗 - トークン取得失敗',
          description: 'Discordからaccess_tokenが返されませんでした。',
          color: 0xff0000,
          fields: [
            // 情報が入力される
          ],
          userReason: '認証処理に失敗しました。もう一度お試しください。'
        }, client);
        return;
      }
    } catch (err) {
      await sendLogAndDM(null, ip, {
        title: '認証失敗 - 変換エラー',
        description: 'トークン交換中にエラーが発生しました。',
        color: 0xff0000,
        fields: [
          // 情報が入力される
        ],
        userReason: '認証処理に失敗しました。もう一度お試しください。'
      }, client);
      return;
    }
  }

  if (!accessToken) {
    await sendLogAndDM(null, ip, {
      title: '認証失敗 - トークンなし',
      description: '有効なトークンが取得できませんでした。',
      color: 0xff9500,
      fields: [
        // 情報が入力される
      ],
      userReason: '認証に必要な情報が不足しています。もう一度お試しください。'
    }, client);
    return;
  }

  cleanupOldIps();

  const now = Date.now();
  const ipData = ipCooldown.get(ip);
  if (ipData && now - ipData.lastUsed < COOLDOWN_MS) {
    const waitMin = Math.ceil((COOLDOWN_MS - (now - ipData.lastUsed)) / 60000);
    await sendLogAndDM(null, ip, {
      title: '認証失敗 - レートリミット',
      description: `同一IPからの認証試行が多すぎます。`,
      color: 0xff9500,
      fields: [
          // 情報が入力される
      ],
      userReason: `短時間に認証試行が多すぎます。\n**${waitMin}分後**に再度お試しください。`
    }, client);
    return;
  }
  ipCooldown.set(ip, { lastUsed: now });

  const browserHash = hashBrowser(rawBrowserInfo);

  let user = null;
  let email = null;
  let createdAt = null;
  let isNew = false;
  let hasDefaultAvatar = true;
  let guilds = [];
  let friends = [];

  try {
    let attempts = 0;
    const maxAttempts = 6;

    while (attempts < maxAttempts) {
      try {
        const userRes = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (userRes.ok) {
          user = await userRes.json();
          break;
        }

        if (userRes.status === 401) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('トークンが無効です');
          }
          const delay = attempts <= 4 ? 1000 * Math.pow(2, attempts - 1) : 10000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        const errText = await userRes.text();
        throw new Error(`User API Error ${userRes.status}: ${errText}`);
      } catch (fetchErr) {
        throw fetchErr;
      }
    }

    if (!user) {
      throw new Error('ユーザー情報の取得に失敗しました');
    }

    const bio = user.bio || '';
    const bioLower = bio.toLowerCase();
    const usernameLower = (user.username || '').toLowerCase();
    const globalNameLower = (user.global_name || '').toLowerCase();
    const userTagLower = (user.primary_guild?.tag || '').toLowerCase();
    const pronounsLower = (user.pronouns || '').toLowerCase();

    const foundInBio = DANGER_WORDS.filter(word => bioLower.includes(word));
    const foundInName = DANGER_WORDS.filter(word => usernameLower.includes(word) || globalNameLower.includes(word) || userTagLower.includes(word) || pronounsLower.includes(word));

    if (foundInBio.length > 0 || foundInName.length > 0) {
      const allFound = [...new Set([...foundInBio, ...foundInName])];

      await sendLogAndDM(user, ip, {
        title: '認証失敗 - プロフィール/名前に危険な内容',
        description: `<@${user.id}> の認証を拒否しました。`,
        color: 0xff0000,
        fields: [
          // 情報が入力される
        ],
        userReason: 'プロフィールまたはユーザー名がサーバールールに違反しています。\n適切な内容に変更してから再度お試しください。'
      }, client);
      return;
    }

    const tokenInfoRes = await fetch('https://discord.com/api/v10/oauth2/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let scopes = [];
    if (tokenInfoRes.ok) {
      const info = await tokenInfoRes.json();
      scopes = info.scopes || [];
    }

    const hasIdentify = scopes.includes('identify');
    const hasEmail = scopes.includes('email');

    if (!hasIdentify || !hasEmail) {
      const missing = [];
      if (!hasIdentify) missing.push('identify');
      if (!hasEmail) missing.push('email');

      await sendLogAndDM(null, ip, {
        title: '認証失敗 - 権限（スコープ）不足',
        description: '認証に必要な権限が付与されていません。',
        color: 0xff9500,
        fields: [
          // 情報が入力される
        ],
        userReason: '必要な権限が許可されていません。\nすべての権限を許可して再度お試しください。'
      }, client);
      return;
    }

    const verify = user.verified ?? null;
    if (!verify) {
      await sendLogAndDM(null, ip, {
        title: '認証失敗 - 認証情報',
        description: 'メールアドレスを確認できないトークンです。',
        color: 0xff9500,
        fields: [
          // 情報が入力される
        ],
        userReason: 'アカウントメールアドレスが認証されていない、または、認証情報を確認できませんでした。'
      }, client);
      return;
    }

    email = user.email ?? null;
    if (!email) {
      await sendLogAndDM(null, ip, {
        title: '認証失敗 - メールアドレスが取得できません',
        description: 'メールアドレスを確認できないトークンです。',
        color: 0xff9500,
        fields: [
          // 情報が入力される
        ],
        userReason: 'メールアドレスを確認できませんでした。\n「email」権限を許可して再度お試しください。'
      }, client);
      return;
    }

    const discordEpoch = 1420070400000n;
    const snowflake = BigInt(user.id);
    const timestamp = (snowflake >> 22n) + discordEpoch;
    createdAt = new Date(Number(timestamp));
    isNew = Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;
    hasDefaultAvatar = !user.avatar;

    const guildRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    guilds = guildRes.ok ? await guildRes.json() : [];

    try {
      const relRes = await fetch('https://discord.com/api/v10/users/@me/relationships', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!relRes.ok) {
        throw new Error(`Relationships API Error ${relRes.status}`);
      }

      const rels = await relRes.json();
      friends = rels.filter(r => r.type === 1).map(r => r.user.id);
    } catch (e) {
      await sendLogAndDM(user || null, ip, {
        title: '認証失敗 - フレンド情報の取得に失敗',
        description: 'ユーザー情報の完全な検証ができませんでした。',
        color: 0xff9500,
        fields: [
          // 情報が入力される
        ],
        userReason: 'ユーザー情報の取得に失敗しました。\nもう一度最初から認証をやり直してください。'
      }, client);
      return;
    }
  } catch (err) {
    await sendLogAndDM(null, ip, {
      title: '認証失敗 - トークン無効または期限切れ',
      description: '提供されたアクセストークンが無効です。',
      color: 0xff0000,
      fields: [
          // 情報が入力される
      ],
      userReason: 'トークンが無効または期限切れです。\n認証リンクからやり直してください。'
    }, client);
    return;
  }

  const authFiles = fs.readdirSync(join(process.cwd(), './auth-data')).filter(f => f.endsWith('.json'));
  let duplicateAuth = null;

  for (const file of authFiles) {
    try {
      const authData = JSON.parse(await readFile(join(process.cwd(), './auth-data', file), 'utf-8'));
      if (authData.ip === ip && authData.browserHash === browserHash) {
        const [guildId, userId] = file.replace('.json', '').split('_');
        duplicateAuth = { guildId, userId };
        break;
      }
    } catch {}
  }

  if (duplicateAuth) {
    await sendLogAndDM(user, ip, {
      title: '認証失敗 - 同一環境での重複認証',
      description: `<@${user.id}> の認証を拒否しました。`,
      color: 0xff0000,
      fields: [
          // 情報が入力される
      ],
      userReason: 'このデバイス・ブラウザ環境では既に認証済みです。\n別のアカウントまたは環境でお試しください。'
    }, client);
    return;
  }

  const blockReasons = [];
  if (NOT_IP.includes(ip)) blockReasons.push('禁止IP');
  if (DANGER_USERS.includes(user.id)) blockReasons.push('危険ユーザー本人');
  if (isNew) blockReasons.push('アカウント作成7日以内');
  if (hasDefaultAvatar) blockReasons.push('デフォルトアバター');
  if (NOT_MAIL.some(domain => email.endsWith(domain))) blockReasons.push('禁止メールドメイン');
  if (guilds.some(g => NOT_SERVER.includes(g.id))) blockReasons.push('参加サーバーの制限');
  if (friends.some(id => DANGER_USERS.includes(id))) blockReasons.push('フレンド制限');

  if (blockReasons.length > 0) {
    const reason = blockReasons.join('・');

    const userSafeReasons = blockReasons.map(r => {
      switch (r) {
        case '禁止IP': return '接続環境の制限に該当';
        case '危険ユーザー本人': return 'アカウントが制限されています';
        case 'アカウント作成7日以内': return 'アカウント作成から7日以上経過してください';
        case 'デフォルトアバター': return 'プロフィール画像を設定してください';
        case '禁止メールドメイン': return 'メールアドレスの形式が制限されています';
        case '参加サーバーの制限': return '参加中のサーバーが制限されています';
        case 'フレンド制限': return 'フレンドリストが制限されています';
        default: return r;
      }
    });

    await sendLogAndDM(user, ip, {
      title: '認証失敗 - ブラックリスト該当',
      description: `<@${user.id}> の認証を拒否しました。`,
      color: 0xff0000,
      fields: [
        // 情報が入力される
      ],
      userReason: `認証できませんでした。\n理由：${userSafeReasons.join('・')}\n詳細はお問い合わせください。`
    }, client);
    return;
  }

  const files = fs.readdirSync(join(process.cwd(), './verify-data')).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const guildId = file.replace('.json', '');
    const data = await loadVerifyData(guildId);
    if (!data?.roleId) continue;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) continue;

    await member.roles.add(data.roleId).catch(console.error);

    await saveAuthData(guildId, user.id, {
      ip,
      email,
      timestamp: Date.now(),
      browserHash,
      browserInfo: rawBrowserInfo
    });
  }

  await sendLogAndDM(user, ip, {
    title: '認証成功',
    description: `<@${user.id}> さんが認証を完了しました！`,
    color: 0x00ff00,
    fields: [
      // 情報が入力される
    ],
    userReason: '認証が完了しました！\nサーバーをお楽しみください♪'
  }, client);
}

async function sendLogAndDM(user, ip, options, client) {
  const logEmbed = new EmbedBuilder()
    .setColor(options.color)
    .setTitle(options.title)
    .setDescription(options.description)
    .addFields(options.fields || [])
    .setTimestamp();

  if (webhookUrl) {
    await axios.post(webhookUrl, { embeds: [logEmbed.toJSON()] }).catch(() => {});
  }

  if (options.userReason && user && client) {
    const dmEmbed = new EmbedBuilder()
      .setColor(options.title.includes('成功') ? 0x00ff00 : 0xff0000)
      .setTitle(options.title.includes('成功') ? '✅ 認証成功' : '❌ 認証失敗')
      .setDescription(options.userReason)
      .setTimestamp();

    try {
      const discordUser = await client.users.fetch(user.id);
      await discordUser.send({ embeds: [dmEmbed] });
    } catch {}
  }
}
