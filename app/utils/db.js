import fs from 'fs';
import path from 'path';

function getDBPath(guildId) {
  const dir = './money';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${guildId}.json`);
}

function initializeDB(guildId) {
  const DB_PATH = getDBPath(guildId);
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log(`Creating file: ${DB_PATH}`);
      fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
    }
  } catch (error) {
    console.error('Error initializing DB:', error);
    throw error;
  }
}

export function loadDB(guildId) {
  initializeDB(guildId);
  const DB_PATH = getDBPath(guildId);
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading DB:', error);
    return {};
  }
}

export function saveDB(guildId, data) {
  initializeDB(guildId);
  const DB_PATH = getDBPath(guildId);
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving DB:', error);
    throw error;
  }
}

export function getUserData(guildId, userId) {
  const db = loadDB(guildId);
  const key = `${guildId}_${userId}`;
  if (!db[key]) {
    db[key] = {
      guildId,
      userId,
      balance: 0,
      lastWork: 0,
      lastLottery: 0,
      lastSlot: 0,
      lastLife: 0,
      lastGive: 0
    };
    saveDB(guildId, db);
  }
  return db[key];
}

export function updateUserData(guildId, userId, data) {
  const db = loadDB(guildId);
  const key = `${guildId}_${userId}`;
  db[key] = { ...db[key], ...data };
  saveDB(guildId, db);
}

export function getGuildRanking(guildId) {
  const db = loadDB(guildId);
  return Object.values(db)
    .filter(user => user.guildId === guildId && user.userId)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);
}

export function getCurrencyName(guildId) {
  const db = loadDB(guildId);
  if (!db.guilds) db.guilds = {};
  if (!db.guilds[guildId]) db.guilds[guildId] = { currencyName: 'コイン' };
  saveDB(guildId, db);
  return db.guilds[guildId].currencyName || 'コイン';
}

export function setCurrencyName(guildId, currencyName) {
  const db = loadDB(guildId);
  if (!db.guilds) db.guilds = {};
  if (!db.guilds[guildId]) db.guilds[guildId] = {};
  db.guilds[guildId].currencyName = currencyName;
  saveDB(guildId, db);
}

export function getShopPanels(guildId, channelId) {
  const db = loadDB(guildId);
  if (!db.shops) db.shops = {};
  if (!db.shops[guildId]) db.shops[guildId] = {};
  if (!db.shops[guildId][channelId]) db.shops[guildId][channelId] = { panels: [] };
  return db.shops[guildId][channelId].panels;
}

export function addShopPanel(guildId, channelId, panelData) {
  const db = loadDB(guildId);
  if (!db.shops) db.shops = {};
  if (!db.shops[guildId]) db.shops[guildId] = {};
  if (!db.shops[guildId][channelId]) db.shops[guildId][channelId] = { panels: [] };
  db.shops[guildId][channelId].panels.push(panelData);
  saveDB(guildId, db);
}

export function removeShopPanel(guildId, channelId, messageId) {
  const db = loadDB(guildId);
  if (db.shops?.[guildId]?.[channelId]) {
    db.shops[guildId][channelId].panels = db.shops[guildId][channelId].panels.filter(
      panel => panel.messageId !== messageId
    );
    saveDB(guildId, db);
  }
}
