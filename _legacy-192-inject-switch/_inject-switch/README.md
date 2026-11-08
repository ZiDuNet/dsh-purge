# dsh 破甲注入开关

打开就注入破甲提示词，关闭就不再注入。除注入外一切照旧：工具调用、补丁、演练台、审批、沙箱、技能、回退全不受影响。

## 用法

双击桌面「dsh 破甲注入开关」，点中间那颗按钮切。窗口标题和状态文字就是当前状态，每秒自动跟磁盘同步，从面板或命令行改过也会立刻显示出来。

对**下一条消息**生效，不用重启 dsh。

## 原理

只切一个文件：

```
%USERPROFILE%\.dsh\.inject-off
```

存在 = 不注入，不存在 = 注入。

插件每 500ms 读一次这个文件，四个注入出口全部服从它：

| 出口 | 关掉后 |
|---|---|
| `dsh-purge` 提示词段（约 21k） | 返回空串，不做正文处理 |
| `dshpg-capabilities` 工具调度协议 | 保留（工具调用靠它） |
| `agent/pre-step` 挂全文的全局函数 | 返回空串，不再往 system 头拼 21k |
| 尾部锚点 `dsh-purge:anchor` | 一起停（没有正文的孤立法条没意义） |

补丁、工具注册、演练台、子代理接管、审批策略、沙箱策略都是独立链路，不看这个文件，所以关掉注入它们照常工作。

## 三种等价用法

```powershell
# 桌面开关
双击快捷方式

# 聊天命令（在 dsh 里发）
/inject on
/inject off
/inject status

# 命令行
& "D:\DeepSeek-\resources\runtime\primary-runtime\dependencies\node\bin\node.exe" `
  "C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-purge\bin\dsh-purge.js" --inject-off
```

参数：`--inject-on` / `--inject-off` / `--inject-toggle` / `--inject`。

## HTTP（可选，面板与开关之间走这条）

端口每次启动都变，从 `DSH_WEB_URL` 取：

```
GET  /dsh-purge/inject/status
POST /dsh-purge/inject/on | off | toggle
POST /dsh-purge/inject  {"action":"toggle"}
```

开关程序里文件是权威，HTTP 只做进程内缓存加速，走不通不影响结果。

## 实现位置

改了插件的这几处，卸载插件时 `.inject-off` 会一并清掉：

| 文件 | 改动 |
|---|---|
| `lib/inject-switch.js` | 新增，开关状态、500ms 缓存、探针 |
| `lib/index.js` | 4 处闸门 + `/inject` 命令 + `purge_inject_switch` 工具 + HTTP 路由 + status 行 |
| `lib/anchor.js` | 锚点跟随开关，与 `config.enabled` 解耦 |
| `lib/uninstall.js` | 卸载时清 `.inject-off` |
| `client.js` | Clean 页加「注入总开关」勾选 |
| `bin/dsh-purge.js` | `--inject*` 参数 |

源码：`source/InjectSwitch.cs`，编译产物 `dist/dsh-inject-switch.exe`（.NET Framework 4.x，系统自带，无需装运行时）。
