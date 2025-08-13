// api.js - Server-side image search aggregator (Google-like crawler)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.API_PORT || 3001;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

app.use(cors());
app.use(express.json());

// Helpers
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function isValidImageUrl(url) {
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  if (/(logo|icon|avatar|sprite)/i.test(url)) return false;
  return /(\.jpg|\.jpeg|\.png|\.webp|\.bmp|\.gif)(\?|$)/i.test(url) || url.includes('images');
}

function tokenize(s) {
  return new Set(
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function relevanceScore(query, item) {
  const q = tokenize(query);
  const t = tokenize(`${item.alt || ''} ${item.highQualityUrl || ''}`);
  return jaccard(q, t); // 0..1
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.v;
}

function cacheSet(key, value) {
  cache.set(key, { t: Date.now(), v: value });
}

function dedupe(images) {
  const seen = new Set();
  return images.filter((img) => {
    const key = (img.highQualityUrl || '').split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Google Images scraping
async function searchGoogleImages(query, page = 1, timeoutMs = 5000) {
  try {
    const start = (page - 1) * 20;
  const url = `https://www.google.com/search?q=${encodeURIComponent(
      query
  )}&tbm=isch&start=${start}&ijn=0&safe=active&hl=en`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': UA,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.google.com/',
      },
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const matches = html.match(/\"ou\":\"([^\"]+)\"/g) || [];
    const results = matches
      .map((m) => m.replace('\"ou\":\"', '').replace('\"', ''))
      .filter(isValidImageUrl)
      .slice(0, 20)
      .map((url) => ({
        highQualityUrl: url,
        alt: query,
        dimensions: { width: 1200, height: 800 },
        source: 'google',
      }));
    return results;
  } catch (err) {
    return [];
  }
}

// Unsplash scraping fallback
async function searchUnsplashScrape(query, page = 1, timeoutMs = 5000) {
  try {
    const url = `https://unsplash.com/s/photos/${encodeURIComponent(query)}?page=${page}`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const $ = cheerio.load(html);
    const images = [];
    $('img[src*="images.unsplash.com"]').each((_, el) => {
      let src = $(el).attr('src');
      if (!src) return;
      src = src.replace(/w=\d+/, 'w=1600').replace(/&w=\d+/, '&w=1600');
      if (isValidImageUrl(src)) {
        images.push({
          highQualityUrl: src,
          alt: $(el).attr('alt') || query,
          dimensions: { width: 1600, height: 1200 },
          source: 'unsplash',
        });
      }
    });
    return images.slice(0, 12);
  } catch (err) {
    return [];
  }
}

// Bing Images scraping (robust via metadata in 'm' attribute on tiles)
async function searchBingImages(query, page = 1, timeoutMs = 5000) {
  try {
    const first = (page - 1) * 20 + 1;
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(
      query
    )}&first=${first}&form=HDRSC2&safeSearch=strict`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const $ = cheerio.load(html);
    const images = [];
    $('a.iusc').each((_, el) => {
      const m = $(el).attr('m');
      if (!m) return;
      try {
        const meta = JSON.parse(m);
        const url = meta.murl || (meta.m && meta.m.murl);
        const alt = meta.t || meta.pt || query;
        if (url && isValidImageUrl(url)) {
          images.push({
            highQualityUrl: url,
            alt,
            dimensions: { width: 1200, height: 800 },
            source: 'bing',
          });
        }
      } catch {}
    });
    return images.slice(0, 20);
  } catch (err) {
    return [];
  }
}

// Aggregate endpoint
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || req.query.query || '').toString().trim();
  const page = parseInt(req.query.page || '1', 10) || 1;
  if (!query) return res.status(400).json({ error: 'Missing q' });

  const cacheKey = `${query}|${page}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json({ query, page, results: cached, cached: true });

  const results = await Promise.allSettled([
    searchGoogleImages(query, page, 6000),
    searchUnsplashScrape(query, page, 6000),
    searchBingImages(query, page, 6000),
  ]);
  let all = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) all.push(...r.value);
  }
  all = dedupe(all);

  const weight = { google: 3, bing: 2.5, unsplash: 2 };
  all = all
    .map((i) => {
      const base = (weight[i.source] || 0) * 1000 + (i.dimensions.width || 0) * (i.dimensions.height || 0);
      const rel = relevanceScore(query, i); // 0..1
      const score = base + rel * 5000; // relevance strongly impacts order
      return { ...i, __score: score };
    })
    .sort((a, b) => b.__score - a.__score)
    .slice(0, 36)
    .map(({ __score, ...rest }) => rest);

  cacheSet(cacheKey, all);
  res.json({ query, page, results: all, cached: false });
});

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🔎 Image Search API running on http://localhost:${PORT}`);
});
