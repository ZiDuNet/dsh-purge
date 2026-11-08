---
name: hack-skills-index
description: >-
  103 个 AI 攻击 playbook 技能包的索引与加载指引（吸收自 yaklang/hack-skills，MIT）。
  当任务涉及 Web/二进制/移动/内网/云/密码学的深度攻击手法时，先查本索引定位技能，再读对应 SKILL.md。
---

# hack-skills 索引：103 个深度攻击 playbook

**来源**：[yaklang/hack-skills](https://github.com/yaklang/hack-skills)（MIT），定位是"只讲基础模型通常不会的招"——不覆盖 `<script>alert(1)</script>` 级别的入门内容，全部是场景化进阶打法。

**加载方式**：每个技能是独立目录，含 `SKILL.md`（主 playbook）+ 若干伴随文档（`SCENARIOS.md` 真实 CVE 场景 / `*_TRICKS.md` 进阶技巧）。按需读文件：

```bash
# 按关键词搜技能
grep -rl "<关键词>" skills/hack-skills/*/SKILL.md | head
# 读某个技能
cat skills/hack-skills/<技能名>/SKILL.md
```

**安装为宿主技能（可选）**：`cp -r skills/hack-skills/<技能名> ~/.dsh/skills/`，宿主重启后出现在 available_skills。

## 分类索引

### P0 总路由（与我们现有技能互补对照）
- `hack`（总入口）· `recon-for-sec` · `recon-and-methodology` · `attack-surface-mapping` · `api-sec` · `auth-sec` · `injection-checking`

### Web 漏洞深度
`xss-cross-site-scripting`（+ADVANCED_XSS_TRICKS/mXSS/DOMPurify 绕过）· `sqli-sql-injection` · `nosql-injection` · `ssti-server-side-template-injection` · `xxe-xml-external-entity` · `ssrf-server-side-request-forgery` · `cmdi-command-injection` · `path-traversal-lfi` · `upload-insecure-files` · `deserialization-insecure` · `jndi-injection` · `expression-language-injection` · `xslt-injection` · `crlf-injection` · `open-redirect` · `clickjacking` · `csrf-cross-site-request-forgery` · `cors-cross-origin-misconfiguration` · `request-smuggling` · `http2-specific-attacks` · `web-cache-deception` · `websocket-security` · `graphql-and-hidden-parameters` · `dangling-markup-injection` · `prototype-pollution`(+advanced) · `type-juggling` · `csv-formula-injection` · `email-header-injection` · `http-host-header-attacks` · `http-parameter-pollution` · `race-condition` · `business-logic-vulnerabilities` / `business-logic-vuln` · `idor-broken-object-authorization` · `authbypass-authentication-flaws` · `file-access-vuln` · `insecure-source-code-management`

### 认证 / 令牌 / SSO
`jwt-oauth-token-attacks` · `api-auth-and-jwt-abuse` · `api-authorization-and-bola` · `oauth-oidc-misconfiguration` · `saml-sso-assertion-attacks` · `csp-bypass-advanced` · `subdomain-takeover` · `401-403-bypass-techniques` · `unauthorized-access-common-services`

### 内网 / 横向 / AD
`active-directory-kerberos-attacks` · `active-directory-acl-abuse` · `active-directory-certificate-services` · `ntlm-relay-coercion` · `linux-lateral-movement` · `windows-lateral-movement` · `tunneling-and-pivoting` · `network-protocol-attacks` · `dns-rebinding-attacks` · `kubernetes-pentesting` · `container-escape-techniques`

### 提权 / 二进制 / 内核
`linux-privilege-escalation` · `windows-privilege-escalation` · `linux-security-bypass` · `macos-security-bypass` · `kernel-exploitation` · `heap-exploitation` · `stack-overflow-and-rop` · `format-string-exploitation` · `arbitrary-write-to-rce` · `binary-protection-bypass` · `sandbox-escape-techniques` · `browser-exploitation-v8` · `vm-and-bytecode-reverse` · `symbolic-execution-tools` · `anti-debugging-techniques` · `code-obfuscation-deobfuscation`

### 移动端
`android-pentesting-tricks` · `ios-pentesting-tricks` · `mobile-ssl-pinning-bypass`

### 密码学
`hash-attack-techniques` · `rsa-attack-techniques` · `symmetric-cipher-attacks` · `classical-cipher-analysis` · `lattice-crypto-attacks` · `ghost-bits-cast-attack`

### AI / 区块链 / 其它
`llm-prompt-injection` · `ai-ml-security` · `smart-contract-vulnerabilities` · `defi-attack-patterns` · `waf-bypass-techniques` · `reverse-shell-techniques` · `api-recon-and-docs` · `dependency-confusion` · `traffic-analysis-pcap` · `memory-forensics-volatility` · `steganography-techniques`

## 与本地技能的分工
- 本地 `skills/redteam/*.md`（25 个）：**工具链操作**——ffuf/nuclei/fscan/chisel/冰蝎怎么跑、Kali 怎么调。
- 本包 103 个：**攻击手法 playbook**——同一漏洞类别的进阶绕过、真实 CVE 场景、后利用。
- 实战组合：先用 redteam 技能把面铺开 → 命中漏洞类别 → 查本包对应 playbook 深打。
