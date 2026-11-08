/**
 * 知识库多渠道导入（演练台「知识库」设置项的后端）。
 *
 * 统一位置：$DSH_HOME/redteam/knowledge.db（poc 表 + FTS5）+ pocs/ 落盘目录。
 * 渠道：
 *  - exploitdb：GitLab 官方仓库的 files_exploits.csv（~4.7 万条）批量入库，幂等（code=edb-<id>）
 *  - nuclei：本机 nuclei 模板目录 → 每个模板一条 kind=template 条目
 * 零第三方依赖：git 用 child_process，CSV 用内置状态机解析。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const EXPLOITDB_GIT = "https://gitlab.com/exploit-database/exploitdb.git";

/** 概览：统一位置 + 统计 + 渠道可用性。 */
export function kbStatus(store) {
  const stats = store.pocStats();
  let nucleiDir;
  try { nucleiDir = store.nucleiTemplatesDir() || undefined; } catch { nucleiDir = undefined; }
  let nucleiCount = 0;
  if (nucleiDir && existsSync(nucleiDir)) {
    try {
      const walk = (d) => {
        let n = 0;
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name);
          if (e.isDirectory()) n += walk(p);
          else if (e.name.endsWith(".yaml")) n += 1;
        }
        return n;
      };
      nucleiCount = walk(nucleiDir);
    } catch { nucleiCount = 0; }
  }
  return {
    ok: true,
    db_path: store.knowledgePath(),
    pocs_dir: store.pocsDirOf(),
    total: stats.total || 0,
    verified: stats.verified || 0,
    by_kind: stats.byKind || {},
    by_source: stats.bySource || {},
    nuclei_dir: nucleiDir || null,
    nuclei_count: nucleiCount,
  };
}

/** 引号感知的 CSV 行解析（处理引号内逗号/双引号转义）。 */
export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function runGit(args, proxy, timeoutMs = 600000) {
  const gitArgs = [];
  if (proxy) { gitArgs.push("-c", `http.proxy=${proxy}`, "-c", `https.proxy=${proxy}`); }
  gitArgs.push(...args);
  return spawnSync("git", gitArgs, { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
}

/** 渠道一：ExploitDB（GitLab 官方）。clone/pull → files_exploits.csv → 批量入库。 */
export function kbImportExploitdb(store, opts = {}) {
  const root = store.root;
  const importDir = join(root, "imports", "exploitdb");
  const csvPath = join(importDir, "files_exploits.csv");
  const proxy = String(opts.proxy || "").trim();
  const steps = [];
  mkdirSync(join(root, "imports"), { recursive: true });

  if (!existsSync(join(importDir, ".git"))) {
    rmSync(importDir, { recursive: true, force: true });
    steps.push("clone");
    const r = runGit(["clone", "--depth", "1", EXPLOITDB_GIT, importDir], proxy);
    if (r.status !== 0) {
      return { ok: false, error: `git clone 失败：${(r.stderr || r.error?.message || "").slice(-300)}` + (proxy ? "" : "（可填代理重试）") };
    }
  } else {
    steps.push("pull");
    runGit(["-C", importDir, "reset", "--hard"], proxy, 60000);
    const r = runGit(["-C", importDir, "pull", "--ff-only"], proxy, 120000);
    if (r.status !== 0) steps.push("(pull 失败，用现有本地副本继续)");
  }
  if (!existsSync(csvPath)) return { ok: false, error: "files_exploits.csv 不存在：" + csvPath };

  const raw = readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/);
  if (!lines.length || !lines[0].startsWith("id,")) return { ok: false, error: "CSV 头不识别" };
  const header = parseCsvLine(lines[0]);
  const col = (name) => header.indexOf(name);
  const cId = col("id"), cFile = col("file"), cDesc = col("description"), cType = col("type"), cPlatform = col("platform"), cCodes = col("codes"), cDate = col("date_published"), cAuthor = col("author");

  const db = store.kb();
  const known = new Set(db.prepare("SELECT code FROM poc WHERE code LIKE 'edb-%'").all().map((r) => r.code));
  const insert = db.prepare(`INSERT INTO poc(code,title,kind,category,cve,component,versions,severity,language,source,source_url,description,usage,content,verified,verified_note,tags,engagement_id,engagement_name,asset_target,found_by_agent,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`);
  let imported = 0, skipped = 0;
  const t0 = Date.now();
  db.exec("BEGIN");
  try {
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      const f = parseCsvLine(line);
      const id = (f[cId] || "").trim();
      if (!id) continue;
      const code = `edb-${id}`;
      if (known.has(code)) { skipped += 1; continue; }
      known.add(code);
      const desc = (f[cDesc] || "").trim();
      const type = (f[cType] || "").trim();
      const platform = (f[cPlatform] || "").trim();
      const codes = (f[cCodes] || "").trim();
      const cve = (codes.match(/CVE-\d{4}-\d{4,}/i) || [""])[0];
      const file = (f[cFile] || "").trim();
      const severity = /webapps|remote/i.test(type) ? "high" : /dos|local/i.test(type) ? "medium" : "low";
      insert.run(code, desc.slice(0, 200) || `ExploitDB #${id}`, "exp", "other", cve || null,
        null, null, severity, platform || null, "web",
        `https://gitlab.com/exploit-database/exploitdb/-/blob/main/${file}`,
        desc, null, null, 0, null, `edb,${type},${platform}`,
        null, null, null, f[cAuthor] || null, "kb-import");
      imported += 1;
      if (Date.now() - t0 > 570000) break;   /* 9.5 分钟熔断，防一次性卡死 */
    }
    /* FTS 批量重建（只对 edb- 前缀；一条 SQL 顶逐条 reindex） */
    if (imported > 0) {
      try {
        db.exec("DELETE FROM poc_fts WHERE poc_id IN (SELECT id FROM poc WHERE code LIKE 'edb-%')");
        db.exec(`INSERT INTO poc_fts(poc_id, title, cve, component, versions, tags, description, content)
          SELECT id, title, COALESCE(cve,''), COALESCE(component,''), COALESCE(versions,''), COALESCE(tags,''),
                 COALESCE(description,''), COALESCE(content,'') FROM poc WHERE code LIKE 'edb-%'`);
      } catch { /* 无 FTS5 时走 LIKE 兜底 */ }
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    return { ok: false, error: `导入失败（已回滚）：${e.message}` };
  }
  return { ok: true, steps, imported, skipped, csv_rows: lines.length - 1, seconds: Math.round((Date.now() - t0) / 1000), csv_path: csvPath };
}

/** 渠道二：本机 nuclei 模板目录 → 每个模板一条 kind=template 条目。 */
export function kbImportNuclei(store, opts = {}) {
  let dir;
  try { dir = store.nucleiTemplatesDir(); } catch { dir = undefined; }
  if (!dir || !existsSync(dir)) return { ok: false, error: "未找到本机 nuclei 模板目录（先在环境适配里配置或手动克隆模板库）" };
  const limit = Math.min(Number(opts.limit) || 20000, 50000);
  const db = store.kb();
  const known = new Set(db.prepare("SELECT code FROM poc WHERE code LIKE 'nuclei-%'").all().map((r) => r.code));
  const insert = db.prepare(`INSERT INTO poc(code,title,kind,category,cve,component,versions,severity,language,source,source_url,description,usage,content,verified,verified_note,tags,engagement_id,engagement_name,asset_target,found_by_agent,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`);
  let imported = 0, scanned = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (imported >= limit) return;
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith(".yaml")) continue;
      scanned += 1;
      let text = "";
      try { text = readFileSync(p, "utf8"); } catch { continue; }
      if (!text.includes("id:")) continue;
      const idm = text.match(/^id:\s*(\S+)/m);
      if (!idm) continue;
      const tid = idm[1];
      const code = `nuclei-${tid}`;
      if (known.has(code)) continue;
      known.add(code);
      const nm = text.match(/^info:\s*$/m) ? null : null;
      const nameM = text.match(/^\s{2}name:\s*(.+)$/m);
      const sevM = text.match(/^\s{2}severity:\s*(\w+)/m);
      const cveM = text.match(/CVE-\d{4}-\d{4,}/i);
      const tagM = text.match(/^\s{2}tags:\s*(.+)$/m);
      const rel = p.slice(dir.length + 1);
      insert.run(code, (nameM ? nameM[1] : tid).slice(0, 200), "template",
        /rce|exec/i.test(rel) ? "rce" : "other", cveM ? cveM[0] : null, null, null,
        sevM ? sevM[1] : "info", "nuclei", "nuclei-template",
        `nuclei -t ${rel} -u http://TARGET`,
        `${rel}（nuclei 模板）`, text, 0, null, tagM ? tagM[1].slice(0, 200) : "nuclei",
        null, null, null, null, "kb-import");
      imported += 1;
    }
  };
  const t0 = Date.now();
  db.exec("BEGIN");
  try { walk(dir); } catch (e) { try { db.exec("ROLLBACK"); } catch { /* ignore */ } return { ok: false, error: e.message }; }
  try {
    db.exec("DELETE FROM poc_fts WHERE poc_id IN (SELECT id FROM poc WHERE code LIKE 'nuclei-%')");
    db.exec(`INSERT INTO poc_fts(poc_id, title, cve, component, versions, tags, description, content)
      SELECT id, title, COALESCE(cve,''), COALESCE(component,''), COALESCE(versions,''), COALESCE(tags,''),
             COALESCE(description,''), COALESCE(content,'') FROM poc WHERE code LIKE 'nuclei-%'`);
  } catch { /* LIKE 兜底 */ }
  db.exec("COMMIT");
  return { ok: true, imported, scanned, seconds: Math.round((Date.now() - t0) / 1000), templates_dir: dir };
}
