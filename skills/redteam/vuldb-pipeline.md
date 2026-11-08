---
name: vuldb-pipeline
description: >-
  CVE/ExploitDB 漏洞数据管道（yaklang/vuldb）：把 NVD CVE 与 ExploitDB 条目拉成本地库，
  批量导入红队知识库（redteam_poc_add / poc 表），供 redteam_poc_search 检索。
  打 Nday 前想批量建库、或想把知识库喂肥时用。
---

# vuldb-pipeline：CVE/ExploitDB → 红队知识库

**来源**：[yaklang/vuldb](https://github.com/yaklang/vuldb)（Go 爬虫，本地快照 `runs/yaklang-absorb/vuldb/`）。数据源：NVD CVE 全量 JSON + ExploitDB（exploit-db.go fetcher）。

## 一、拉库（vuldb 爬虫）

```bash
# 需要 Go 1.20+（本机未装 Go 时：apt install golang-go 或走 Kali）
git clone https://github.com/yaklang/vuldb && cd vuldb
go build -o vuldb .
./vuldb download-cve --help   # 看 flags：年份范围/输出目录
./vuldb download-cve          # 拉 NVD CVE JSON（全量较重，建议按年）
```

ExploitDB 离线镜像（更轻，直接 git 拉数据不用爬）：
```bash
git clone --depth 1 https://github.com/offensive-security/exploitdb.git
# files_exploits.csv 即全量条目（id/file/description/date/author/type/platform/port）
```

## 二、导入红队知识库

知识库表结构：`poc(code,title,kind,category,cve,component,severity,language,source,source_url,description,usage,content,verified,tags,...)`，FTS5 全文索引已建。

Python 导入模板（对 `files_exploits.csv` 逐行 `redteam_poc_add` 语义入库）：

```python
import csv, sqlite3, os
KB = os.path.expanduser("~/.dsh/redteam/knowledge.db")   # 以 store.pocsDirOf() 实际路径为准
con = sqlite3.connect(KB)
rows = list(csv.DictReader(open("exploitdb/files_exploits.csv", encoding="utf-8", errors="replace")))
for r in rows:
    con.execute("""INSERT INTO poc(code,title,kind,category,cve,component,severity,language,
        source,source_url,description,content,verified,tags,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,datetime('now'),datetime('now'))""",
        (f"edb-{r['id']}", r["description"][:200], "exp", "other", "", r.get("codes","").split(";")[0] or None,
         "high" if "webapps" in r["type"] else "medium", r.get("language") or None,
         "web", f"https://www.exploit-db.com/exploits/{r['id']}",
         r["description"], "", r["file"]))
con.commit()
print("imported", len(rows))
# 注意：FTS5 索引表 poc_fts 需同步重建（见 store-core.js #reindexPoc），或入库后跑一次面板触发重建
```

## 三、口径

- `verified=0`（未实测）条目**只作线索检索**，命中后仍按流程验证再回填 `verified=1`——知识库排序是 verified 优先，别拿未验证条目直接打。
- 量大时按 `component`/`cve` 分批导入；`redteam_poc_search` 的 FTS5 全文（标题/编号/组件/正文）会自动吃下。
- 上线 RAG 后（LOCAL-CHANGES 第 8 项），本管道的产出改灌 RAG 向量库，`poc` 表结构即过渡契约。
