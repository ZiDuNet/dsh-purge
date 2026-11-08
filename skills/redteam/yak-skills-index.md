---
name: yak-skills-index
description: >-
  Yaklang/Yakit 12 技能索引（吸收自 yaklang/yak-skills，MIT）：yak 安全语言编程、Yakit
  MITM/WebFuzzer 热加载、插件开发、数据库操作。需要写 .yak 脚本、做 MITM 动态改包、
  开发 Yakit 插件时，先查本索引再读对应 SKILL.md。
---

# yak-skills 索引：Yaklang 引擎与 Yakit 平台技能

**来源**：[yaklang/yak-skills](https://github.com/yaklang/yak-skills)（MIT）。Yaklang 是专为网络安全设计的 Go 语言 DSL（[yaklang/yaklang](https://github.com/yaklang/yaklang)，⭐652），Yakit 是其 ALL-IN-ONE 图形平台（[yaklang/yakit](https://github.com/yaklang/yakit)，⭐7865）。

**加载方式**：`cat skills/yak-skills/<技能名>/SKILL.md`

**引擎安装**：`yak` 二进制未装时从 https://github.com/yaklang/yaklang/releases 下载（Linux amd64）；Yakit 桌面版 https://github.com/yaklang/yakit/releases 。装好后本技能包的全部脚本可直接运行。

## 技能清单（12 个）

### Yaklang 编程
- `yak` — 总入口与路由
- `yaklang-syntax` — DSL 语法案例（变量/类型/并发/引擎函数）
- `yaklang-database` — db 库持久化与查询（SQLite/MySQL）
- `yaklang-toolchain` — 源码引擎（go run common/yak）与插件验证

### Yakit 平台使用
- `yakit-basic` — Yakit 安装与界面功能区导览
- `yakit-ui-binding` — yak 脚本与 Yakit UI 交互（yakit.* gRPC 机制）

### 热加载（Hot Patch，MITM 动态改包核心能力）
- `global-hotpatch` — 全局热加载：一处配置管 MITM + 全部模块
- `mitm-hotpatch` — MITM 中间人代理内用代码动态改请求/响应
- `webfuzzer-hotpatch` — Web Fuzzer 单 Tab 发包时挂代码

### 插件开发
- `yakit-native-plugin` — yak/mitm 类型原生插件与 cli 参数体系
- `yakit-rightclick-plugin` — 右键 codec 插件（单 handler 函数）
- `yakit-data-extract-plugin` — History 流量批量数据提取插件

## 与本地平台的分工
- 本地 `skills/redteam/`：Kali 工具链（nmap/nuclei/ffuf…）+ 隧道/马/凭据攻击流程。
- 本包：需要**编程化攻防**（批量 fuzz 逻辑、动态改包、协议级脚本）时用 yak DSL；脚本产物可回填 `redteam_attack_file_add`（kind=script）沉淀复用。
