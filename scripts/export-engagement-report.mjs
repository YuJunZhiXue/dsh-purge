#!/usr/bin/env node
/**
 * 把一个靶标的得分报告导出成可移动的交付包：`<outDir>/<靶标>-红队成果复现报告.md` + `<outDir>/shots/`。
 *
 * 面板下载的 markdown 里，证据截图走绝对路径，发给别人会碎图。
 * 这里把 shots/ 一并拷到输出目录，markdown 用相对路径。
 *
 * 跑法：
 *   node scripts/export-engagement-report.mjs
 *   node scripts/export-engagement-report.mjs --out ~/交付/靶标名
 *   node scripts/export-engagement-report.mjs --engagement <id>
 */
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { RedteamStore } from "../lib/redteam/store-core.js";

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i === -1 || argv[i + 1] === undefined ? fallback : argv[i + 1];
};

const root = process.env.REDTEAM_HOME || join(process.env.DSH_HOME || join(homedir(), ".dsh"), "redteam");
const store = new RedteamStore(root);
const id = argOf("engagement", store.activeEngagementId());
if (!id) {
  console.error("没有可用靶标：先用面板创建，或用 --engagement <id> 指定");
  process.exit(1);
}
const outDir = resolve(argOf("out", process.cwd()));
mkdirSync(outDir, { recursive: true });

const shotsSrc = join(root, "engagements", id, "shots");
const shotsDst = join(outDir, "shots");
if (existsSync(shotsSrc)) {
  rmSync(shotsDst, { recursive: true, force: true });
  cpSync(shotsSrc, shotsDst, { recursive: true });
}

const rep = store.scoreReport(id, { shotRef: "relative" });
const name = String(rep.target || id).replace(/[/\\:*?"<>|]/g, "_");
const outFile = join(outDir, name + "-红队成果复现报告.md");
writeFileSync(outFile, rep.markdown, "utf8");
store.close();

const imgs = (rep.markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
console.log("✓ 报告：" + outFile);
console.log("  合计 " + rep.summary.points + " 分 · " + rep.items.length + " 条正文 · 嵌入截图 " + imgs + " 张"
  + (existsSync(shotsDst) ? "（shots/ " + readdirSync(shotsDst).length + " 个文件，随报告一起拷走即可）" : ""));
