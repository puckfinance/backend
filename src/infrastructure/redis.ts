import redis from 'redis';

let client = redis.createClient({
  url: process.env.REDIS_URL,
});

export let isConnected = false;
export const connect = () => client.connect();

client.on('error', (err) => {
  console.log(`Error: ${err}`);
});

client.on('connect', () => {
  isConnected = true;
  console.log('Redis client connected');
});

export const getClient = () => client;

export const disconnect = () => {
  client.quit();
};
