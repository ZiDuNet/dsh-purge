---
name: redteam-attack-technique-map
description: MITRE ATT&CK 技术 → 本演练台既有技能的映射表，用于判断当前处在哪一阶段、下一步该调哪个技能，避免重复搜集或漏阶段
whenToUse: 拿到 5 阶段（recon/internet/boundary/internal/target）中的任一阶段任务，需要选具体技术路线与对应本地技能时
role: exploit
enabled: true
source: MITRE ATT&CK Techniques (3395 entries)
---

# ATT&CK 技术 → 本地技能映射

## 侦察（Reconnaissance / TA0043）

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1595 | 主动扫描 | active-scan、nuclei-scan |
| T1592 | 收集目标主机信息 | web-fingerprint |
| T1590 | 收集网络信息（网段/路由/DNS） | passive-recon |
| T1589 | 收集身份信息（邮箱/账号） | passive-recon |
| T1593/T1596 | 搜索开放网站/公开情报 | fofa-recon |

## 资源开发与初始访问（TA0001）

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1190 | 利用面向公众的应用 | nuclei-scan、unauth-exploit |
| T1133 | 外部远程服务（VPN/RDP/SSH 暴露） | credential-attack |
| T1078 | 有效账号 | credential-attack |
| T1566 | 钓鱼（仅在授权且有明确范围时） | 无默认技能，需单独评估 |

## 发现（Discovery / TA0007）

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1046 | 网络服务发现 | fscan-intranet、gogo-intranet |
| T1018 | 远程系统发现 | fscan-intranet |
| T1082/T1016 | 系统信息/网络配置查询 | shell-handler |
| T1087 | 账号发现 | lateral-movement |

## 凭据访问（TA0006）

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1110 | 暴力破解 | credential-attack |
| T1552 | 不安全存储的凭据（配置文件/脚本/历史） | credential-attack、unauth-exploit |
| T1003 | OS 凭据转储 | lateral-movement |

## 执行、持久化与提权

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1059 | 命令与脚本解释器 | shell-handler、webshell-toolkit |
| T1505.003 | Web Shell | webshell-toolkit |
| T1053 | 计划任务 | lateral-movement |
| T1543 | 服务/守护进程持久化 | lateral-movement |
| T1068 | 漏洞提权 | 无通用技能，按组件单独立项 |

## 横向移动与命令控制（TA0008 / TA0011）

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1021 | 远程服务（SMB/WinRM/SSH/RDP） | lateral-movement |
| T1570 | 横向工具传输 | lateral-movement |
| T1090 | 代理 | frp-tunnel、cn-proxy-pool |
| T1572 | 协议隧道 | chisel-tunnel、suo5-tunnel |
| T1071 | 应用层协议 C2 | vps-reverse-shell、shell-handler |

## 收集与外传（TA0009 / TA0010）

| 技术 | 内容 | 本地技能 |
|---|---|---|
| T1005 | 本地数据收集 | shell-handler |
| T1560 | 归档收集数据 | shell-handler |
| T1041 | 通过 C2 通道外传 | vps-reverse-shell |

## 阶段对齐纪律

1. 先确定当前阶段（recon / internet / boundary / internal / target），再选技术，不要跳阶段直接打内网。
2. 每个技术动作都要留下可复核的证据（请求、回显、文件），否则该步骤不计为已执行。
3. 隧道与代理只在拿到边界立足点后建立，建隧道本身不是得分点，进入内网并取到证据才是。
4. 缺少对应技能的技术（T1566 钓鱼、T1068 提权）不默认执行，需单独确认范围后立项。
