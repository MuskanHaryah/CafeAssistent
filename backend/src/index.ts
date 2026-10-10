import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { menuRouter } from './routes/menu.js';
import { chatRouter } from './routes/chat.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cafe-ai-backend' });
});

app.use('/api/menu', menuRouter);
app.use('/api/chat', chatRouter);

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
