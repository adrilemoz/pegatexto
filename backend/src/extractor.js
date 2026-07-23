import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { marked } from 'marked';

const JUNK_SELECTORS = [
  '.advertisement', '.ad', '.ads', '[class*="banner"]', '[id*="banner"]',
  '.social-share', '.share-buttons', '[class*="share"]',
  '.comments', '#comments', '.comment-section', '.disqus',
  '.newsletter', '.popup', '.modal', '[class*="cookie"]',
  'nav', 'footer', '.related-articles', '.recommended', '.sidebar',
  '[class*="paywall"]', '[class*="subscribe"]',
];

export async function extractArticle(url) {
  const fetchResult = await fetchData(url);
  let pageTitle = 'Sem título';
  const isCloud = fetchResult.source === 'cloud';

  if (isCloud) {
    pageTitle = fetchResult.data.title || pageTitle;
    const markdown = fetchResult.data.content || '';
    const html = marked.parse(markdown);
    const $ = cheerio.load(html);
    const content = [];
    const images = [];
    $('body').children().each((_, el) => walk($, el, content, images));
    const wordCount = getWordCount(content);
    if (content.length === 0) throw new Error('EXTRACTION_FAILED');
    return {
      title: pageTitle,
      byline: fetchResult.data.siteName || 'Nuvem de Extração',
      siteName: null,
      excerpt: null,
      content,
      images,
      wordCount,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    };
  }

  const dom = new JSDOM(fetchResult.html, { url });
  const doc = dom.window.document;
  pageTitle = doc.title || pageTitle;

  JUNK_SELECTORS.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const reader = new Readability(doc, { keepClasses: false });
  const article = reader.parse();
  const isArticle = article && article.textContent && article.textContent.trim().length > 250;

  if (isArticle) {
    const $ = cheerio.load(article.content);
    $('script, style, iframe, noscript, form, button').remove();
    const content = [];
    const images = [];
    $('body').children().each((_, el) => walk($, el, content, images));
    const wordCount = getWordCount(content);
    return {
      title: article.title || pageTitle,
      byline: article.byline || null,
      siteName: article.siteName || null,
      excerpt: article.excerpt || null,
      content,
      images,
      wordCount,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    };
  } else {
    const $ = cheerio.load(fetchResult.html);
    $('nav, footer, header, aside, .menu, script, style, form').remove();
    const content = [];
    let extractedWords = 0;
    const marketItems = new Set();

    $('[data-test="instrument-price-last"], .text-5xl.font-bold, .pid-ext-price').each((_, el) => {
      const val = $(el).text().trim();
      const name = $('h1').first().text().trim() || 'Ativo';
      if (val && /^[0-9.,]+$/.test(val)) marketItems.add(`💰 ${name}: ${val}`);
    });

    if (marketItems.size > 0) {
      content.push({ type: 'heading', level: 2, text: '📈 Cotações' });
      content.push({ type: 'list', ordered: false, items: Array.from(marketItems) });
      extractedWords += Array.from(marketItems).join(' ').length / 5;
    }

    const headlines = new Set();
    $('h1, h2, h3, h4, .post-title, .title').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length >= 20 && text.split(' ').length >= 3) headlines.add(text);
    });

    if (headlines.size > 0) {
      content.push({ type: 'heading', level: 2, text: '📰 Notícias' });
      content.push({ type: 'list', ordered: false, items: Array.from(headlines) });
      extractedWords += Array.from(headlines).join(' ').length / 5;
    }

    if (content.length === 0) throw new Error('EXTRACTION_FAILED');
    return {
      title: pageTitle,
      byline: 'Resumo Automático',
      content, images: [],
      wordCount: Math.round(extractedWords),
      readingTimeMinutes: Math.max(1, Math.round(extractedWords / 200)),
    };
  }
}

function getWordCount(content) {
  return content
    .filter((b) => ['paragraph', 'heading', 'quote'].includes(b.type))
    .reduce((sum, b) => sum + b.text.split(/\s+/).filter(Boolean).length, 0);
}

function walk($, el, content, images) {
  const tag = el.tagName ? el.tagName.toLowerCase() : null;
  if (!tag) return;
  const node = $(el);

  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const text = node.text().trim();
    if (text) content.push({ type: 'heading', level: Number(tag[1]), text });
    return;
  }
  if (tag === 'p') {
    const text = node.text().trim();
    if (text) content.push({ type: 'paragraph', text });
    node.find('img').each((_, img) => registerImage($, img, images, content));
    return;
  }
  if (tag === 'blockquote') {
    const text = node.text().trim();
    if (text) content.push({ type: 'quote', text });
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = [];
    node.find('> li').each((_, li) => {
      const t = $(li).text().trim();
      if (t) items.push(t);
    });
    if (items.length) content.push({ type: 'list', ordered: tag === 'ol', items });
    return;
  }
  if (tag === 'img' || tag === 'figure') {
    const img = tag === 'img' ? el : node.find('img').get(0);
    if (img) registerImage($, img, images, content);
    return;
  }
  if (node.children().length > 0) {
    node.children().each((_, child) => walk($, child, content, images));
  } else {
    const text = node.text().trim();
    if (text) content.push({ type: 'paragraph', text });
  }
}

function registerImage($, imgEl, images, content) {
  if (!imgEl) return;
  const src = $(imgEl).attr('src') || $(imgEl).attr('data-src');
  const alt = $(imgEl).attr('alt') || '';
  if (src) {
    images.push({ src, alt });
    content.push({ type: 'image', src, alt });
  }
}

async function fetchData(url) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const forceCloudDomains = ['aliexpress', 'mercadolivre', 'shopee', 'temu', 'amazon'];
  const urlObj = new URL(url);
  const isECommerce = forceCloudDomains.some(domain => urlObj.hostname.includes(domain));

  if (!isECommerce) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        const htmlLower = html.toLowerCase();
        if (!htmlLower.includes('just a moment...') && !htmlLower.includes('enable javascript')) {
          console.log(`⚡ Extraído via Fetch Nativo (Sem navegador)`);
          return { source: 'native', html };
        }
      }
    } catch (err) {
      console.log(`⚠️ Fetch nativo falhou. Tentando Nuvem...`);
    }
  }

  console.log(`☁️ Acionando extração via Nuvem (Jina) para renderizar JS/Burlar proteções...`);
  const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!jinaRes.ok) throw new Error(`HTTP_${jinaRes.status}`);
  const json = await jinaRes.json();
  if (!json.data || !json.data.content) {
    throw new Error('EXTRACTION_FAILED');
  }
  return { source: 'cloud', data: json.data };
}
