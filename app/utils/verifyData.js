import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), './verify-data');
const AUTH_DIR = join(process.cwd(), './auth-data');
await mkdir(DATA_DIR, { recursive: true });
await mkdir(AUTH_DIR, { recursive: true });

export async function saveVerifyData(guildId, data) {
  const path = join(DATA_DIR, `${guildId}.json`);
  await writeFile(path, JSON.stringify(data, null, 2));
}

export async function loadVerifyData(guildId) {
  try {
    const path = join(DATA_DIR, `${guildId}.json`);
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveAuthData(guildId, userId, data) {
  const path = join(AUTH_DIR, `${guildId}_${userId}.json`);
  await writeFile(path, JSON.stringify(data, null, 2));
}

export async function loadAuthData(guildId, userId) {
  try {
    const path = join(AUTH_DIR, `${guildId}_${userId}.json`);
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
