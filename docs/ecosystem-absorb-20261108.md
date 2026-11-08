# dsh-purge 生态甄别与吸收报告（2026-11-08）

## 已吸收（本轮）
| 来源 | 内容 | 落点 |
|---|---|---|
| kingcharleslzy-ai/dsh-purge v1.6.84 | refusal-retry 三件套（拒绝检测+单次重试+审计） | `lib/refusal-retry.js` `lib/audit.js` `lib/stream-observation.js` + index.js llm/stream 接线（默认关） |
| shenwei322/dsh-purge-ports v1.2.1 | WorkBuddy/ZCode 插件包 + 5 预设 + 破甲契约 + CLI | `multi-client/`（自包含并列插件） |
| yaklang/hack-skills · yak-skills · vuldb | 103+12 技能与数据管道 | `skills/`（见 LOCAL-CHANGES 第 9 项） |

## 社区版 1.6.84 未合并部分（52 个新模块，独立演进线）
全量合并不可行：社区版基于 1.1.72 独立重构出 1.6.x 线（patches/ 引擎目录化、core/ 拆分、86 补丁 + 25 层自检），与本树（1.1.93 + 本地补丁）为两条代码树。逐项评估：

| 模块族 | 评估 | 后续 |
|---|---|---|
| `update-*`（12 个） | 自更新体系（多镜像/socks/完整性/策略） | 我们已有 update.js（指向 ZiDuNet），结构不同不合入；RAG/分发需要时再参考 |
| `patches/` + `core/` | 引擎重构 | 我们引擎（core.js 单体）运行稳定，不动 |
| 25 层状态自检 | 与我们 `purge selfcheck`（6 项）同类 | **候选**：后续把社区版自检清单逐项对照增补 |
| `apply-gate.js` / `rollback-transaction.js` / `restore-backup.js` / `atomic-files.js` | apply 事务化 + 回滚（pojia「写后自检+自动回滚」同类） | **候选**：低耦合，下轮可移植 |
| `refusal-retry` + `audit` + `stream-observation` | 拒绝重试 | **本轮已移植** |
| `desktop-*`（6 个）/ `macos/windows-asar-handoff` | 桌面端适配 | 我们跑 web surface，暂不需要 |
| `preset-*`（5 个）/ `steering.js` / `boost.js` / `tuning.js` | 预设诊断/转向/增强 | 候选池 |
| `market-migration.js` / `installed-package.js` / `install-registry.js` | 市场迁移/安装登记 | 暂不需要 |

## 生态地图（其余仓库）
- `mmparko/dsh-purge`（⭐3336）：全量镜像，100 个历史 tag——考古用
- `z91772524-ai/pojia-next-mac`（⭐117）：WorkBuddy 六层 + Codex 双锚点的 macOS 版——出 mac 版时参考
- `MDX-Tom/gpt-instruct`（⭐11252）：Codex 破甲提示词+测试包——候选：喂 `purge selfcheck` 做对抗验证
- `dream12347/dsh-session-manager`（⭐110）：DSH 会话管理插件——可与演练台共存
- 上游 `YuJunZhiXue/dsh-purge` 原仓库**已恢复**（社区版 README 确认）——但我们已自立 ZiDuNet 线，不受影响
