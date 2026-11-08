# 安全离开：停用 / 卸载都不破坏 DSH

插件对 DSH 有两类改动：

1. **运行时能力**（提示词注入、`/purge` 命令、演练台 UI、`redteam_*` 工具）——随插件启用/停用自然开关。
2. **宿主源码补丁**（86 条，写进 `@deepseek-ai/*` 的 `.js` 文件）——**不会随停用自动消失**。

只做 1 不做 2，就叫"孤儿补丁"：补丁还在宿主里，但没人维护、没人检测、没人能修。
宿主一升级，pattern 漂移 → 补丁半损 → 轻则功能异常，重则宿主起不来。

因此本插件的停用/卸载**强制先回滚宿主补丁**，回滚不干净就不许离开。

---

## 停用（临时不用，随时可恢复）

### 走面板
1. 打开 **⚙️ 清洗** → 点「还原」（等价 `/purge revert`）
2. 设置 → 插件 → dsh-purge → **停用**
3. 重启宿主

### 走配置（`enabled: false`）
把 profile 的 `cordis.patch.yml` 里 `dsh-purge` 那行改成 `disabled: true` 并重启。
**停用路径会自动执行安全离开**（`lib/safe-leave.js`）：

```
locate → revert-patches（回滚宿主补丁）→ revert-shims → revert-flash → verify（残留自检）
```

- 回滚干净 → 正常停用，只留用户数据
- 回滚失败 → **拒绝停用**（`ctx.__dshPurgeDisableBlocked` 记录原因），保持插件可用以便修复

### 走命令
```
/purge leave
```
输出五个阶段的结果 + 保留的用户数据清单。

---

## 卸载（彻底移除插件本体）

```
/purge uninstall
```

流程（`lib/uninstall.js`）：

```
revert-patches → residue-check（残留自检，失败即中止）
→ revert-shims → revert-flash → 删除 node_modules/dsh-purge → 提示重启
```

保护措施：
- **回滚失败即中止**，不进入删除步骤
- **残留自检**：宿主文件里还有 `[dsh-purge]` / `__dsh_purge_` 标记 → 判为未干净，中止
- **删除范围严格限定** `*/node_modules/dsh-purge`——npm link / file: 安装的不会误删源码仓库
- 不碰注册表、不碰服务、不装驱动

---

## 数据保留策略

| 数据 | 停用 | 卸载 |
|---|---|---|
| `~/.dsh/prompt-inject.md` | 保留 | 保留 |
| `~/.dsh/redteam/knowledge.db`（4.6 万条知识库） | 保留 | 保留 |
| `~/.dsh/redteam/`（资产/漏洞/凭据/证据/报告库） | 保留 | 保留 |
| `~/.dsh/dsh-purge/`（授权标记、审计日志、配置） | 保留 | 保留 |
| `~/.dsh/.agent-presets/redteam/`（红队预设） | 停用时移除 | 移除 |
| 插件源码目录 `node_modules/dsh-purge` | 保留 | 删除 |

**想彻底清空数据**（可选，需显式操作）：

```bash
rm -rf ~/.dsh/redteam ~/.dsh/dsh-purge ~/.dsh/prompt-inject.md
```

---

## 怎么确认真的离开干净了

```bash
# 1. 宿主补丁是否回滚（应无输出）
grep -rl "\[dsh-purge\]\|__dsh_purge_" \
  ~/.local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/ 2>/dev/null

# 2. 备份文件是否清干净
find ~/.local/lib/node_modules/@deepseek-ai/dsh -name "*.dshpurge.bak" | wc -l

# 3. 插件目录是否还在
ls ~/.dsh/profiles/web/node_modules/dsh-purge 2>/dev/null || echo "已移除"

# 4. 宿主能否正常启动
systemctl restart dsh-web && sleep 4 && systemctl is-active dsh-web
```

第 1 条应**无输出**、第 2 条应为 **0**（残留备份文件不影响宿主运行，但留着下次会干扰 patch 判定）、第 4 条应为 `active`。

---

## 恢复使用

停用/卸载后再装回来，数据都在，直接启用即可：

```bash
# 停用状态恢复
设置 → 插件 → dsh-purge → 启用
# 或 /purge apply 重新打补丁
```

知识库、靶标、凭据、报告全部还在，无需重新导入。