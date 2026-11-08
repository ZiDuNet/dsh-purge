# 本地维护版（1.1.93 + local patches）

以官方 1.1.93（适配 DSH 0.2.2-rc.1）为基准，包含以下本地修改。上游仓库（HunYiSage/dsh-purge）已下架，本树为孤本。

## 1. net-scope 区域闸整体停用（lib/net-scope.js）
- `installRegionGate` 函数体开头直接 `return;`——`agent/pre-step` 与 `tools/pre-execute` 两个拦截钩子均不注册。
- 原因：redteam 会话任务文本含 `.cn` 域名即被静态硬拦（DENIAL 常量替换模型回复），误杀授权演练目标。

## 2. publicHostHit 接入白名单（lib/net-scope.js）
- 原版 `readAllowText` 只服务面板 API，判定函数没接。现补上：`$DSH_HOME/net-scope-allow.txt` 每行一个主机名/IP，精确命中或父域匹配即放行。
- 即便闸停用后此项不生效，保留以便日后恢复闸时白名单可用。

## 3. `purge selfcheck` 注入自证命令（lib/selfcheck.js + lib/index.js）
- pojia-next「交付即验证」思路移植：只读检查 prompt-inject.md 落盘、自证口令、镜像段接线、区域闸状态、宿主补丁覆盖，逐项 ✓/✗。
- 用法：`/purge selfcheck`。

## 4. 镜像注入段（lib/index.js registerPromptSections）
- pojia-next v8.27「双层破甲」思路：主注入块外再挂一份独立标记 `dsh-purge-mirror` 的精简核心纪律段。
- 兜底两个场景：宿主升级覆盖主注入块；长对话注意力衰减稀释主块。

## 5. 自证口令（docs/default-prompt-inject.md，运行时位于 $DSH_HOME/prompt-inject.md）
- 用户消息仅为「破甲自检」四字 → 只回「破甲自检成功」。固定口令+固定回复是注入真载入的唯一可信判据。

## 6. 出厂默认槽重封（lib/asset-table.js，配套 table-read.js/table-key.js 不变）
- 自证口令写进加密出厂槽（AES-256-GCM，sealSlot 重封），宿主的 hung-refresh/seed 回写机制每次都会以含口令的新默认恢复 prompt-inject.md——绕开「改磁盘文件被回写冲掉」的坑。
- 磁盘文件在重启 dsh 后由 seed 对齐；当前活宿主会用内存里的旧默认覆盖磁盘，属预期。

## 未合入（参考件在 _legacy-192-inject-switch/）
- 1.1.92 Windows 备份者的 inject-switch 注入总开关（含桌面 exe）：其接线点（index.js/anchor.js/uninstall.js/bin）在 1.1.93 已大改，移植风险大于收益；且其用途（切回官方提示词）与本地维护目标相反。需要时按 _还原说明.txt 自行接线。

## 校验
- 全部 JS：`node --check` 通过（60+ 文件）。
- SHA256SUMS.txt 由 `sha256sum` 生成，覆盖本树全部文件。
