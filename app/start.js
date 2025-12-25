// Sharding
// node start.js

import { ShardingManager } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manager = new ShardingManager(path.join(__dirname, 'server.js'), {
  token: process.env.TOKEN,
  totalShards: 3,
  respawn: true,
  shardArgs: ['--no-warnings'],
  execArgv: ['--max-old-space-size=4096'], 
  timeout: -1,
});

manager.on('shardCreate', (shard) => {
  console.log(`Shard ${shard.id} を起動しました`);
});

manager.spawn({
  amount: 3,
  delay: 5000,
  timeout: -1
})
  .then(() => console.log('全てのシャードが起動しました'))
  .catch(console.error);
