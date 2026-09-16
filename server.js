import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to persistent server-side sync configuration
const CONFIG_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'supabase-config.json');

function getServerSyncConfig() {
  let fileConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read supabase-config.json:', e.message);
  }

  const url = (process.env.SUPABASE_URL || fileConfig.url || '').trim();
  const key = (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || fileConfig.key || '').trim();
  const orgId = (process.env.SUPABASE_ORG_ID || fileConfig.orgId || 'shop1').trim();
  const autoSync = fileConfig.autoSync !== false;

  return {
    url,
    key,
    orgId,
    autoSync,
    configured: Boolean(url && key)
  };
}

// API to get cloud sync configuration for any client/device/URL
app.get('/api/sync-config', (req, res) => {
  res.json(getServerSyncConfig());
});

// API to save cloud sync configuration persistently on the server
app.post('/api/sync-config', (req, res) => {
  try {
    const { url, key, orgId, autoSync } = req.body || {};
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = getServerSyncConfig();
    const updated = {
      url: url !== undefined ? String(url).trim() : current.url,
      key: key !== undefined ? String(key).trim() : current.key,
      orgId: orgId !== undefined ? String(orgId).trim() : current.orgId,
      autoSync: autoSync !== undefined ? Boolean(autoSync) : current.autoSync,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    res.json({ ok: true, config: updated });
  } catch (err) {
    console.error('Failed to save sync config:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve static assets from workspace root
app.use(express.static(__dirname));

// Single-page fallback for routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

