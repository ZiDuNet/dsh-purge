/**
 * purge selfcheck —— 注入自证与体检（pojia-next「交付即验证」思路移植）。
 *
 * 只读：不改任何文件、不发网络请求。逐项给出 pass/fail，最后给一行总结。
 * 用法：/purge selfcheck（或 purge selfcheck）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "./core.js";

const SELF_INJECT_MARK = "破甲自检成功";
const MIRROR_MARK = "dsh-purge-mirror";
const REGION_DISABLE_MARK = "区域闸已整体停用";

function pluginDir() {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

function readTextSafe(fp) {
  try {
    return fs.readFileSync(fp, "utf8");
  } catch {
    return "";
  }
}

/**
 * @returns {Promise<{ok: boolean, lines: string[], summary: string}>}
 */
export async function runSelfcheck() {
  const lines = [];
  const home = (() => {
    try { return core.findDshHome() || ""; } catch { return ""; }
  })();
  let pass = 0;
  let fail = 0;
  const ok = (name, detail) => { pass += 1; lines.push(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`); };
  const bad = (name, detail) => { fail += 1; lines.push(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); };

  // 1. 注入正文：出厂槽与磁盘文件
  const injectPath = path.join(home, "prompt-inject.md");
  const inject = readTextSafe(injectPath);
  let slotText = "";
  try {
    const { openSlot } = await import("./table-read.js");
    slotText = openSlot() || "";
  } catch { slotText = ""; }
  if (slotText.includes(SELF_INJECT_MARK)) {
    ok("出厂默认槽", "已带自证口令（宿主重启后 seed 到 prompt-inject.md）");
  } else if (slotText) {
    bad("出厂默认槽", "槽内默认文本不含自证口令（旧版插件？）");
  } else {
    lines.push("  - 出厂默认槽：解包失败，跳过");
  }
  if (inject.trim().length > 200) {
    if (inject.includes(SELF_INJECT_MARK)) {
      ok("磁盘 prompt-inject.md", `${inject.length} 字节，含自证口令`);
    } else {
      lines.push(`  - 磁盘 prompt-inject.md：${inject.length} 字节，仍是旧默认（活宿主内存回写覆盖）——重启 dsh 后自动对齐新出厂槽`);
    }
  } else {
    bad("磁盘 prompt-inject.md", "缺失或过短（<200 字节），破甲正文没有落盘");
  }

  // 2. 镜像层接线：主块被宿主升级覆盖时兜底的独立段
  const indexPath = path.join(pluginDir(), "lib", "index.js");
  const indexText = readTextSafe(indexPath);
  if (indexText.includes(`name: "${MIRROR_MARK}"`)) {
    ok("镜像注入段", "主块被覆盖/注意力衰减时有独立兜底层");
  } else {
    bad("镜像注入段", `index.js 里没有 ${MIRROR_MARK} 段注册`);
  }

  // 3. 区域闸状态（net-scope）
  const netScope = readTextSafe(path.join(pluginDir(), "lib", "net-scope.js"));
  if (netScope.includes(REGION_DISABLE_MARK)) {
    ok("区域闸", "已停用（redteam 会话不再被 .cn 域名静态拦截）");
  } else if (netScope.length > 0) {
    ok("区域闸", "启用中（白名单走 net-scope-allow.txt）");
  } else {
    bad("区域闸", "net-scope.js 读取失败");
  }

  // 4. 宿主补丁覆盖（63/65 之类）
  let patchLine = "";
  try {
    const state = await core.gatherState();
    const patches = Array.isArray(state?.patches) ? state.patches : [];
    if (patches.length) {
      const applied = patches.filter((p) => p?.status === "applied" || p?.status === "already").length;
      const pending = patches.filter((p) => p?.status !== "applied" && p?.status !== "already").length;
      patchLine = `${applied}/${patches.length} applied, ${pending} 未生效`;
      if (pending === 0) ok("宿主补丁覆盖", patchLine);
      else bad("宿主补丁覆盖", `${patchLine}（跑 /purge apply 补齐）`);
    } else {
      lines.push("  - 宿主补丁：状态列表为空（版本差异，跑 /purge status 看 65 项口径）");
    }
  } catch (e) {
    lines.push(`  - 宿主补丁：状态获取失败（${String(e?.message || e)}），跳过该项`);
  }

  // 5. 插件自身版本
  try {
    const pkg = JSON.parse(readTextSafe(path.join(pluginDir(), "package.json")));
    if (pkg?.version) ok("插件版本", `dsh-purge v${pkg.version} @ ${pluginDir()}`);
  } catch { /* 版本读不到不算失败项 */ }

  const summary = fail === 0
    ? `自检通过：${pass} 项 ✓，0 项 ✗`
    : `自检未全过：${pass} 项 ✓，${fail} 项 ✗`;
  return { ok: fail === 0, lines, summary };
}

export async function handleSelfcheckCommand() {
  const r = await runSelfcheck();
  return {
    kind: r.ok ? "success" : "error",
    text: ["purge selfcheck（只读，不改任何文件）", "", ...r.lines, "", r.summary].join("\n"),
  };
}
