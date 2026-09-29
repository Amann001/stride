import { buildApp } from './app';
import { config } from './config';

const app = await buildApp();

// 0.0.0.0 means "accept connections from other devices", so your iPhone on the same Wi-Fi can reach it.
await app.listen({ port: config.port, host: '0.0.0.0' });
