import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';
import { extractArticle } from './src/extractor.js';

const app = express();
const cache = new NodeCache({ stdTTL: 86400 });

app.use(cors());
app.use(express.json());

app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'URL_INVALIDA' });
  }

  const cachedArticle = cache.get(url);
  if (cachedArticle) {
    console.log(`✅ Retornando do Cache: ${url}`);
    return res.json(cachedArticle);
  }

  try {
    console.log(`🔍 Extraindo: ${url}`);
    const article = await extractArticle(url);
    cache.set(url, article);
    res.json(article);
  } catch (err) {
    console.error('Erro na extração:', err.message);
    res.status(422).json({ error: err.message || 'EXTRACTION_FAILED' });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
