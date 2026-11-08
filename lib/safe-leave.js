/**
 * 安全离开（停用 / 卸载都走这里）：把对 DSH 宿主造成的一切改动回滚干净，
 * 只保留用户数据（prompt-inject.md、redteam 数据库、配置、审计）。
 *
 * 设计原则：
 *  - 先回滚、后判断：宿主补丁是写进 DSH 源码文件的，不回滚就停用会留下"孤儿补丁"，
 *    宿主一升级就会半损甚至起不来。
 *  - 回滚失败就不许离开：宁可保持插件启用（可再修），也不留半损状态。
 *  - 回滚后自检：确认宿主文件已不再含插件标记，才报告 clean。
 *  - 用户数据永不删除（除非显式 purgeData=true，且默认不给）。
 */
import fs from "node:fs";
import path from "node:path";
import * as core from "./core.js";

/** 插件在宿主文件里留下的可识别标记（用于回滚后自检）。 */
const HOST_MARKERS = [
  "[dsh-purge]",              // 大量补丁注释标记
  "__dsh_purge_",             // 补丁写入的死字符串/钩子名
  "dsh-purge: ",
];

/** 用户数据（永不因停用/卸载删除）。 */
export function userDataPaths(dshHome) {
  const home = dshHome || core.findDshHome() || "";
  return {
    prompt_inject: path.join(home, "prompt-inject.md"),
    redteam_db: path.join(home, "redteam", "knowledge.db"),
    redteam_dir: path.join(home, "redteam"),
    purge_state: path.join(home, "dsh-purge"),
    agent_presets: path.join(home, ".agent-presets"),
  };
}

/**
 * 自检：宿主补丁是否已回滚干净。
 * @returns {{ clean: boolean, hits: {file: string, marker: string}[], scanned: number }}
 */
export function hostPatchResidue(aiBase) {
  const hits = [];
  let scanned = 0;
  let files;
  try {
    files = core.targetFiles(aiBase);
  } catch {
    return { clean: false, hits: [], scanned: 0, error: "targetFiles 不可用" };
  }
  /* targetFiles 返回 {group: [path|null,...] | path}，这里自己展平（flattenTargetPaths 未导出）。 */
  const list = [];
  for (const value of Object.values(files || {})) {
    if (typeof value === "string") { list.push(value); continue; }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") list.push(item);
        else if (item && typeof item === "object") {
          for (const v2 of Object.values(item)) {
            if (typeof v2 === "string") list.push(v2);
          }
        }
      }
    }
  }
  for (const fp of list) {
    if (typeof fp !== "string") continue;
    let body;
    try {
      body = fs.readFileSync(fp, "utf8");
      scanned += 1;
    } catch {
      continue;
    }
    for (const marker of HOST_MARKERS) {
      if (body.includes(marker)) {
        hits.push({ file: fp, marker });
        break;
      }
    }
  }
  return { clean: hits.length === 0, hits, scanned };
}

/**
 * 安全离开：回滚宿主补丁 + shim + flash，并自检。
 *
 * @param {{ dshHome?: string, aiBase?: string, strict?: boolean, onStage?: (s: string, info?: object) => void }} options
 * @returns {Promise<{
 *   ok: boolean, stages: object[], reverted: string[], errors: string[],
 *   residue: object, kept: string[], canLeave: boolean, reason: string
 * }>}
 */
export async function safeLeave(options = {}) {
  const { dshHome: rawHome, strict = true, onStage = () => {} } = options;
  const home = rawHome || (() => { try { return core.findDshHome() || ""; } catch { return ""; } })();
  const stages = [];
  const errors = [];
  const reverted = [];

  // ── 阶段 1：定位宿主 ─────────────────────────────────────────
  onStage("locate");
  let aiBase = options.aiBase || "";
  if (!aiBase) {
    try {
      const state = await core.gatherState();
      aiBase = state.ai_base || "";
    } catch (e) {
      errors.push(`locate: ${e.message || e}`);
    }
  }
  stages.push({ stage: "locate", aiBase: aiBase || null, ok: Boolean(aiBase) });
  if (!aiBase) {
    // 找不到宿主 = 从没打过补丁，可视为已干净
    const kept = Object.values(userDataPaths(home));
    return {
      ok: true, stages, reverted, errors,
      residue: { clean: true, hits: [], scanned: 0, note: "未定位到宿主，视为无补丁" },
      kept, canLeave: true, reason: "宿主未定位，无需回滚",
    };
  }

  // ── 阶段 2：回滚宿主补丁（核心，失败即不许离开）────────────
  onStage("revert-patches");
  try {
    const multi = await core.revertAllHosts({ discover: true });
    reverted.push(...(multi.reverted || []));
    for (const [p, e] of multi.errors || []) errors.push(`revert ${p}: ${e}`);
    stages.push({ stage: "revert-patches", reverted: (multi.reverted || []).length, errors: (multi.errors || []).length });
  } catch (e) {
    errors.push(`revert patches: ${e.message || e}`);
    stages.push({ stage: "revert-patches", ok: false, error: String(e.message || e) });
  }

  // ── 阶段 3：回滚 shim（命令包装脚本）───────────────────────
  onStage("revert-shims");
  try {
    const shim = await core.revertAllShims();
    stages.push({ stage: "revert-shims", ok: true, detail: shim });
  } catch (e) {
    errors.push(`revert shims: ${e.message || e}`);
    stages.push({ stage: "revert-shims", ok: false, error: String(e.message || e) });
  }

  // ── 阶段 4：回滚 cmd flash（Windows 控制台无闪窗注入）──────
  onStage("revert-flash");
  try {
    const flash = core.revertCmdFlash(aiBase, home);
    stages.push({ stage: "revert-flash", ok: true, detail: flash });
  } catch (e) {
    errors.push(`revert flash: ${e.message || e}`);
    stages.push({ stage: "revert-flash", ok: false, error: String(e.message || e) });
  }

  // ── 阶段 5：回滚后自检（残留标记 = 没回滚干净）─────────────
  onStage("verify");
  let residue;
  try {
    residue = hostPatchResidue(aiBase);
  } catch (e) {
    residue = { clean: false, hits: [], scanned: 0, error: String(e.message || e) };
  }
  stages.push({ stage: "verify", clean: residue.clean, hits: (residue.hits || []).length, scanned: residue.scanned });

  // ── 判定：能否安全离开 ─────────────────────────────────────
  const fatal = errors.filter((e) => /revert (patches|shims|flash)?/.test(e));
  const canLeave = residue.clean === true && fatal.length === 0;
  const kept = Object.values(userDataPaths(home)).filter((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  let reason = "宿主补丁已回滚干净，可安全停用/卸载";
  if (!residue.clean) {
    reason = `宿主仍残留 ${residue.hits.length} 处插件标记，回滚未完成——保持插件启用以免 DSH 半损`;
  } else if (fatal.length) {
    reason = `回滚过程报错 ${fatal.length} 条——保持插件启用以免 DSH 半损`;
  }

  // strict=false 时（卸载流程已自行 revert）不做阻断，只报告
  return {
    ok: canLeave || !strict,
    stages, reverted, errors, residue, kept, canLeave, reason,
  };
}

/**
 * 停用前的完整检查 + 回滚（供 apply(enabled:false) 与面板调用）。
 * @returns {Promise<{ok: boolean, report: object, message: string}>}
 */
export async function prepareDisable(options = {}) {
  const report = await safeLeave(Object.assign({ strict: true }, options));
  if (!report.canLeave) {
    return {
      ok: false,
      report,
      message: [
        "拒绝停用：宿主补丁未回滚干净，继续停用会让 DSH 留半损状态。",
        `原因：${report.reason}`,
        report.residue && report.residue.hits && report.residue.hits.length
          ? `残留示例：${report.residue.hits.slice(0, 5).map((h) => path.basename(h.file)).join(", ")}`
          : "",
        "建议：先执行「还原」（/purge revert）再停用。",
      ].filter(Boolean).join("\n"),
    };
  }
  return {
    ok: true,
    report,
    message: [
      "已安全离开：宿主补丁 / shim / flash 全部回滚并自检通过。",
      `回滚文件 ${report.reverted.length} 个；用户数据全部保留：${report.kept.length} 项。`,
    ].join("\n"),
  };
}