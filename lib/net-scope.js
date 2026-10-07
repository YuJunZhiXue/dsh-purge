import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promises as dns } from "node:dns";
import { findDshHome } from "./core.js";

const SUFFIXES = [
  [".xn--fiqs8s", "CN"],
  [".xn--fiqz9s", "CN"],
  [".xn--j6w193g", "HK"],
  [".xn--mix082f", "MO"],
  [".xn--55qx5d", "CN"],
  [".xn--io0a7i", "CN"],
  [".xn--55qw42g", "CN"],
  [".xn--zfr164b", "CN"],
  [".xn--czru2d", "CN"],
  [".xn--hxt814e", "CN"],
  [".xn--fiq228c5hs", "CN"],
  [".xn--3bst00m", "CN"],
  [".xn--ses554g", "CN"],
  [".中国", "CN"],
  [".中國", "CN"],
  [".公司", "CN"],
  [".网络", "CN"],
  [".網絡", "CN"],
  [".公益", "CN"],
  [".政务", "CN"],
  [".商城", "CN"],
  [".网店", "CN"],
  [".中文网", "CN"],
  [".集团", "CN"],
  [".网址", "CN"],
  [".在线", "CN"],
  [".移动", "CN"],
  [".我爱你", "CN"],
  [".香港", "HK"],
  [".澳门", "MO"],
  [".澳門", "MO"],
  [".com.cn", "CN"],
  [".net.cn", "CN"],
  [".org.cn", "CN"],
  [".gov.cn", "CN"],
  [".edu.cn", "CN"],
  [".ac.cn", "CN"],
  [".mil.cn", "CN"],
  [".ah.cn", "CN"],
  [".bj.cn", "CN"],
  [".cq.cn", "CN"],
  [".fj.cn", "CN"],
  [".gd.cn", "CN"],
  [".gs.cn", "CN"],
  [".gx.cn", "CN"],
  [".gz.cn", "CN"],
  [".ha.cn", "CN"],
  [".hb.cn", "CN"],
  [".he.cn", "CN"],
  [".hi.cn", "CN"],
  [".hl.cn", "CN"],
  [".hn.cn", "CN"],
  [".jl.cn", "CN"],
  [".js.cn", "CN"],
  [".jx.cn", "CN"],
  [".ln.cn", "CN"],
  [".nm.cn", "CN"],
  [".nx.cn", "CN"],
  [".qh.cn", "CN"],
  [".sc.cn", "CN"],
  [".sd.cn", "CN"],
  [".sh.cn", "CN"],
  [".sn.cn", "CN"],
  [".sx.cn", "CN"],
  [".tj.cn", "CN"],
  [".xj.cn", "CN"],
  [".xz.cn", "CN"],
  [".yn.cn", "CN"],
  [".zj.cn", "CN"],
  [".hk.cn", "HK"],
  [".mo.cn", "MO"],
  [".cn", "CN"],
  [".com.hk", "HK"],
  [".edu.hk", "HK"],
  [".gov.hk", "HK"],
  [".idv.hk", "HK"],
  [".net.hk", "HK"],
  [".org.hk", "HK"],
  [".hk", "HK"],
  [".com.mo", "MO"],
  [".edu.mo", "MO"],
  [".gov.mo", "MO"],
  [".net.mo", "MO"],
  [".org.mo", "MO"],
  [".mo", "MO"],
];

const FILE_SUFFIX = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "md", "yml", "yaml",
  "css", "html", "map", "log", "txt", "png", "jpg", "jpeg", "gif", "svg",
  "woff", "woff2", "lock", "vue", "py", "go", "rs", "java", "xml", "toml",
  "ini", "bak", "patch", "diff", "sh", "ps1", "cmd", "exe",
]);

const ranges = loadRanges();
const v4 = ranges.v4;
const v6 = ranges.v6.map((row) => ({
  value: parseIpv6(row[0]),
  len: row[1],
  region: row[2],
})).filter((row) => row.value != null);

const hostLookupCache = new Map();
const LOOKUP_TTL_MS = 10 * 60 * 1000;
const LOOKUP_CONCURRENCY = 6;
const DENIAL = "不行，这是严令禁止的";

const CF_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

const CF_V6 = [
  ["2400:cb00::", 32],
  ["2606:4700::", 32],
  ["2803:f800::", 32],
  ["2405:b500::", 32],
  ["2405:8100::", 32],
  ["2a06:98c0::", 29],
  ["2c0f:f248::", 32],
];

const VENDOR_NS = [
  "aliyun.com",
  "aliyuncs.com",
  "alibabadns.com",
  "alidns.com",
  "hichina.com",
  "dnspod.com",
  "dnspod.net",
  "dnsv1.com",
  "dnsv2.com",
  "dnsv3.com",
  "dnsv4.com",
  "dnsv5.com",
  "qcloud.com",
  "myqcloud.com",
  "tencent.com",
  "tencentcs.com",
  "huaweicloud.com",
  "hwclouds.com",
  "baidubce.com",
  "bdydns.com",
  "volces.com",
  "volcengine.com",
  "ctyun.cn",
  "ucloud.cn",
  "qingcloud.com",
  "ksyun.com",
  "jdcloud.com",
];

// 渗透(?!测试)：「渗透测试 / IP 与渗透测试」不是攻击任务（#73）。
// exploit(?!-)：exploit-db.com 等资料站不算 exploit 关键词。
// (?<!防御)攻击：「防御攻击手法」不误触。
const ATTACK =
  /渗透(?!测试)|打穿|打下|打站|入侵|拿壳|拿权限|爆破|提权|webshell|getshell|端口扫描|pentest|\bexploit\b(?![-a-z0-9])|\bbreach\b|\bpwn\b|(?<!防御)攻击(?!面)|(?<!surface\s)\battack\b(?!\s+surface)/i;

const NET_TOPIC =
  /(?:代理|\bproxy\b|socks|vpn|frp|clash|v2ray|小飞机|机场|出口\s*ip|本机\s*ip|内网\s*ip|公网\s*ip|ip\s*地址|ip\s*归属|ip\s*查询|ip\s*相关|dns|域名解析|网卡|隧道|反向代理|正向代理|http[s]?\s*代理)/i;

function loadRanges() {
  try {
    const fp = path.join(path.dirname(fileURLToPath(import.meta.url)), "net-scope-ranges.json");
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    return {
      v4: Array.isArray(parsed.v4) ? parsed.v4 : [],
      v6: Array.isArray(parsed.v6) ? parsed.v6 : [],
    };
  } catch {
    return { v4: [], v6: [] };
  }
}

function ipv4ToInt(ip) {
  const parts = String(ip).split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number > 255) return null;
    value = value * 256 + number;
  }
  return value >>> 0;
}

function isSkippedV4(value) {
  const a = value >>> 24;
  const b = (value >>> 16) & 255;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function parseIpv6(input) {
  let text = String(input || "").trim().toLowerCase().split("%")[0];
  if (!text) return null;
  if (text.includes(".")) {
    const colon = text.lastIndexOf(":");
    const tail = ipv4ToInt(text.slice(colon + 1));
    if (tail == null) return null;
    const hi = (tail >>> 16).toString(16);
    const lo = (tail & 0xffff).toString(16);
    text = `${text.slice(0, colon + 1)}${hi}:${lo}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && missing < 0) return null;
  const parts = halves.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (parts.length !== 8) return null;
  let out = 0n;
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    out = (out << 16n) + BigInt(parseInt(part, 16));
  }
  return out;
}

export function regionOfIp(ip) {
  const text = String(ip || "").trim().toLowerCase();
  if (text.includes(":")) {
    const value = parseIpv6(text);
    if (value == null) return "";
    for (const row of v6) {
      const shift = BigInt(128 - row.len);
      if ((value >> shift) === (row.value >> shift)) return row.region;
    }
    return "";
  }
  const value = ipv4ToInt(text);
  if (value == null || isSkippedV4(value)) return "";
  let lo = 0;
  let hi = v4.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (v4[mid][0] <= value) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return "";
  return value <= v4[found][1] ? v4[found][2] : "";
}

export function regionOfSuffix(host) {
  const name = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!name || name === "localhost" || name.endsWith(".local")) return "";
  for (const [suffix, region] of SUFFIXES) {
    if (name === suffix.slice(1) || name.endsWith(suffix)) return region;
  }
  return "";
}

function hostOf(raw) {
  let host = String(raw || "").trim().toLowerCase();
  if (!host) return "";
  const at = host.lastIndexOf("@");
  if (at >= 0) host = host.slice(at + 1);
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 1 ? host.slice(1, end) : "";
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(host)) return host.replace(/:\d+$/, "");
  if (/^[a-z0-9.-]+:\d+$/.test(host)) return host.replace(/:\d+$/, "");
  return host.replace(/\.$/, "");
}

function addHost(raw, hosts) {
  const host = hostOf(raw);
  if (!host || host.length > 253) return;
  hosts.add(host);
}

function inFilePath(sample, index) {
  const prev = sample[index - 1];
  return prev === "/" || prev === "\\";
}

/** 网址里的主机照收。裸名字要像域名：路径片段、文件后缀、两段的 .mo 文件名丢掉。 */
function keepBareDomain(sample, index, name) {
  if (inFilePath(sample, index)) return false;
  const labels = name.split(".");
  const tail = labels[labels.length - 1];
  if (FILE_SUFFIX.has(tail)) return false;
  if (labels.length === 2 && tail === "mo") return false;
  return true;
}

function collectFromText(text, hosts) {
  const sample = String(text || "").slice(0, 32768);
  const url = /\b(?:[a-z][a-z0-9+.-]*:\/\/)([^/?#\s]+)/gi;
  for (const match of sample.matchAll(url)) addHost(match[1], hosts);
  const ipv4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
  for (const match of sample.matchAll(ipv4)) hosts.add(match[0]);
  const ipv6 = /\b(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}\b/gi;
  for (const match of sample.matchAll(ipv6)) hosts.add(match[0]);
  const domain = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
  for (const match of sample.matchAll(domain)) {
    const name = match[0].toLowerCase();
    if (!keepBareDomain(sample, match.index, name)) continue;
    hosts.add(name);
  }
}

async function addressesOf(host) {
  const found = [];
  const records = await Promise.race([
    Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]),
    new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
  if (Array.isArray(records)) {
    for (const item of records) {
      if (item.status === "fulfilled" && Array.isArray(item.value)) found.push(...item.value);
    }
  }
  if (found.length) return found;
  try {
    const looked = await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise((resolve) => setTimeout(() => resolve([]), 1500)),
    ]);
    if (Array.isArray(looked)) {
      for (const item of looked) {
        if (item?.address) found.push(item.address);
      }
    }
  } catch {
    /* 解析失败就不当成命中，境外地址不会被误拦。 */
  }
  return found;
}

const HOST_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const V4_TEXT = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function allowFilePath(dshHome = findDshHome()) {
  return path.join(dshHome, "net-scope-allow.txt");
}

/** 只接受一个 IP 或一个完整主机名。账号可以写成 user@host。密钥、网段、通配符丢掉。 */
export function entryHost(raw) {
  const text = String(raw || "").trim();
  if (!text || text.startsWith("#")) return "";
  if (text.length > 253 || /[\s/\\*]/.test(text)) return "";
  if (/BEGIN |PRIVATE KEY|ssh-(?:rsa|ed25519|dss) /i.test(text)) return "";
  let body = text;
  const at = body.lastIndexOf("@");
  if (at >= 0) {
    const user = body.slice(0, at);
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(user)) return "";
    body = body.slice(at + 1);
  }
  const host = hostOf(body);
  if (!host || host.length > 253) return "";
  if (V4_TEXT.test(host)) return host;
  if (host.includes(":")) return parseIpv6(host) != null ? host : "";
  if (!HOST_NAME.test(host)) return "";
  const tail = host.slice(host.lastIndexOf(".") + 1);
  if (FILE_SUFFIX.has(tail)) return "";
  return host;
}

export function normalizeAllowText(text) {
  const kept = [];
  const seen = new Set();
  let dropped = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    if (raw.startsWith("#")) {
      kept.push(raw);
      continue;
    }
    const host = entryHost(raw);
    if (!host) {
      dropped += 1;
      continue;
    }
    if (seen.has(host)) continue;
    seen.add(host);
    const at = raw.lastIndexOf("@");
    kept.push(at > 0 ? `${raw.slice(0, at)}@${host}` : host);
  }
  return { text: kept.length ? `${kept.join("\n")}\n` : "", dropped, hosts: [...seen] };
}

export function readAllowText(dshHome = findDshHome()) {
  try {
    return fs.readFileSync(allowFilePath(dshHome), "utf8");
  } catch {
    return "";
  }
}

export async function writeAllowText(dshHome, text) {
  const normalized = normalizeAllowText(text);
  const fp = allowFilePath(dshHome);
  await fs.promises.mkdir(path.dirname(fp), { recursive: true });
  await fs.promises.writeFile(fp, normalized.text, "utf8");
  allowCache = { path: "", mtime: -1, exact: new Set(), ips: null, at: 0 };
  return normalized;
}

let allowCache = { path: "", mtime: -1, exact: new Set(), ips: null, at: 0 };

function readAllowExact(dshHome = findDshHome()) {
  const fp = allowFilePath(dshHome);
  let mtime = -1;
  try {
    mtime = fs.statSync(fp).mtimeMs;
  } catch {
    mtime = -1;
  }
  if (allowCache.path === fp && allowCache.mtime === mtime) return allowCache;
  const exact = new Set(normalizeAllowText(readAllowText(dshHome)).hosts);
  allowCache = { path: fp, mtime, exact, ips: null, at: Date.now() };
  return allowCache;
}

function allowDecision(dshHome) {
  return readAllowExact(dshHome);
}

export function ownServerNote() {
  return "";
}

function permittedHost(host, allow) {
  return allow.exact.has(host);
}

function ipv4InCidr(ip, cidr) {
  const [base, bitsText] = String(cidr).split("/");
  const addr = ipv4ToInt(ip);
  const net = ipv4ToInt(base);
  const bits = Number(bitsText);
  if (addr == null || net == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (addr & mask) === (net & mask);
}

function ipv6InPrefix(ip, base, len) {
  const value = parseIpv6(ip);
  const net = parseIpv6(base);
  if (value == null || net == null) return false;
  const shift = BigInt(128 - len);
  return (value >> shift) === (net >> shift);
}

function isCloudflareAddress(ip) {
  const text = String(ip || "").trim().toLowerCase();
  if (text.includes(":")) return CF_V6.some(([base, len]) => ipv6InPrefix(text, base, len));
  return CF_V4.some((cidr) => ipv4InCidr(text, cidr));
}

function isOwnNetwork(host) {
  const name = hostOf(host);
  if (!name) return false;
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name.includes(":")) {
    const value = parseIpv6(name);
    if (value == null) return false;
    if (value === 0n || value === 1n) return true;
    if ((value >> 118n) === 0x3fan) return true;
    if ((value >> 121n) === 0x7en) return true;
    return false;
  }
  const value = ipv4ToInt(name);
  return value != null && isSkippedV4(value);
}

function isIp(host) {
  return V4_TEXT.test(host) || host.includes(":");
}

function nsHit(nameservers, suffixes) {
  for (const raw of nameservers || []) {
    const name = String(raw || "").trim().toLowerCase().replace(/\.$/, "");
    if (!name) continue;
    if (suffixes.some((suffix) => name === suffix || name.endsWith(`.${suffix}`))) return true;
  }
  return false;
}

function coveredByCloudflare(addresses, nameservers) {
  if (nsHit(nameservers, ["cloudflare.com"])) return true;
  const pub = (addresses || []).map((item) => String(item || "").trim()).filter((item) => item && !isOwnNetwork(item));
  return pub.length > 0 && pub.every(isCloudflareAddress);
}

function taskHit(label, kind) {
  return { label, kind };
}

/** 只认中国大陆 / 香港 / 澳门域名后缀。纯 IP、网段、Cloudflare、DNS、NS 都不参与。 */
export function decisionFromLookup({ host } = {}) {
  const name = hostOf(host);
  if (!name || isOwnNetwork(name) || isIp(name)) return null;
  if (regionOfSuffix(name)) return taskHit(name, "domain");
  return null;
}

/** 代理 / IP / DNS 等配置咨询，不含攻击词时不拦（#73）。 */
export function isBenignNetworkTopic(text) {
  const t = String(text || "").trim();
  if (!t || !NET_TOPIC.test(t)) return false;
  return !ATTACK.test(t);
}

export function isAttackTask(text) {
  const sample = String(text || "");
  if (isBenignNetworkTopic(sample)) return false;
  return ATTACK.test(sample);
}

function hostsInTask(text) {
  const hosts = new Set();
  const sample = String(text || "").slice(0, 32768);
  collectFromText(sample, hosts);
  const labeled = /(?:[a-z0-9\u00a1-\uffff](?:[a-z0-9\u00a1-\uffff-]{0,61}[a-z0-9\u00a1-\uffff])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59}|[\u4e00-\u9fff]{2,12})/giu;
  for (const match of sample.matchAll(labeled)) {
    const name = match[0].toLowerCase().replace(/\.$/, "");
    if (!keepBareDomain(sample, match.index, name)) continue;
    addHost(name, hosts);
  }
  return hosts;
}

async function pointersOf(addresses) {
  const names = [];
  const list = [];
  const seen = new Set();
  for (const raw of addresses || []) {
    const address = String(raw || "").trim().toLowerCase();
    if (!address || seen.has(address) || isOwnNetwork(address)) continue;
    seen.add(address);
    list.push(address);
    if (list.length >= 4) break;
  }
  await Promise.all(list.map(async (address) => {
    try {
      const rows = await Promise.race([
        dns.reverse(address).catch(() => []),
        new Promise((resolve) => setTimeout(() => resolve([]), 1500)),
      ]);
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        const name = String(row || "").trim().toLowerCase().replace(/\.$/, "");
        if (name) names.push(name);
      }
    } catch {
      /* 反向解析失败不当成命中。 */
    }
  }));
  return names;
}

async function firstHit(items, worker) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  let cursor = 0;
  let found = null;
  const width = Math.min(LOOKUP_CONCURRENCY, list.length);
  const run = async () => {
    while (found == null && cursor < list.length) {
      const host = list[cursor];
      cursor += 1;
      const hit = await worker(host);
      if (hit && found == null) found = hit;
    }
  };
  await Promise.all(Array.from({ length: width }, () => run()));
  return found;
}

async function nameserversOf(host) {
  const records = await Promise.race([
    dns.resolveNs(host).catch(() => []),
    new Promise((resolve) => setTimeout(() => resolve([]), 1500)),
  ]);
  return Array.isArray(records) ? records.map((item) => String(item).trim().toLowerCase()) : [];
}

async function lookupHost(host) {
  const now = Date.now();
  const cached = hostLookupCache.get(host);
  if (cached && now - cached.at < LOOKUP_TTL_MS) return cached.lookup;
  const lookup = { addresses: [], nameservers: [], pointers: [] };
  try {
    lookup.addresses = await addressesOf(host);
  } catch {
    lookup.addresses = [];
  }
  try {
    lookup.nameservers = await nameserversOf(host);
  } catch {
    lookup.nameservers = [];
  }
  if (lookup.addresses.length && !coveredByCloudflare(lookup.addresses, lookup.nameservers)) {
    lookup.pointers = await pointersOf(lookup.addresses);
  }
  hostLookupCache.set(host, { at: now, lookup });
  return lookup;
}

export async function classifyHost(host, dshHome = findDshHome()) {
  const name = hostOf(host);
  if (!name) return null;
  const allow = allowDecision(dshHome);
  if (permittedHost(name, allow)) return null;
  return decisionFromLookup({ host: name });
}

export async function taskTargetHit(text, dshHome = findDshHome()) {
  if (!isAttackTask(text)) return null;
  const allow = allowDecision(dshHome);
  for (const host of hostsInTask(text)) {
    const name = hostOf(host);
    if (!name || permittedHost(name, allow) || isOwnNetwork(name) || isIp(name)) continue;
    if (regionOfSuffix(name)) return taskHit(name, "domain");
  }
  return null;
}

function messageBody(message) {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return typeof message?.text === "string" ? message.text : "";
  return message.content.map((block) => {
    if (typeof block === "string") return block;
    if (block && block.type === "text" && typeof block.text === "string") return block.text;
    return "";
  }).join("\n");
}

function looksLikeToolResult(message, text) {
  if (message?.toolCallId || message?.tool_call_id || message?.toolName) return true;
  if (message?.source?.kind && message.source.kind !== "user") return true;
  const head = String(text || "").slice(0, 240);
  return /^(?:Tool result|\[tool|function_call|toolu_|call_)/i.test(head);
}

function humanTaskText(message) {
  if (!message || typeof message !== "object") return "";
  if (message.role && message.role !== "user") return "";
  const kind = message.source?.kind;
  if (kind && kind !== "user") return "";
  const text = messageBody(message);
  if (!text || looksLikeToolResult(message, text)) return "";
  if (/^\s*Current runtime context\b/i.test(text)) return "";
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "\n").trim();
}

/** 只看本轮新用户句。整段历史拼在一起会把工具回包、上一轮域名和攻击词叠成误拦。 */
export function currentTaskText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let cut = -1;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const role = list[i]?.role;
    if (role === "assistant" || role === "model") {
      cut = i;
      break;
    }
  }
  return list.slice(cut + 1).map(humanTaskText).filter(Boolean).join("\n");
}

function sessionOf(payload) {
  const agent = payload?.agent;
  if (agent?.session && typeof agent.session.append === "function") return agent.session;
  if (payload?.session && typeof payload.session.append === "function") return payload.session;
  return null;
}

async function denialMessage() {
  try {
    const mod = await import("@deepseek-ai/dsh-llm");
    if (typeof mod.createAssistantMessage === "function") {
      return mod.createAssistantMessage({
        content: [{ type: "text", text: DENIAL }],
        source: { provider: "deepseek", model: "deepseek-chat" },
      });
    }
  } catch {
    /* 宿主包不在这条导入路径上时用手写消息。 */
  }
  return {
    id: randomUUID(),
    role: "assistant",
    content: [{ type: "text", text: DENIAL }],
    source: { kind: "model", provider: "deepseek", model: "deepseek-chat" },
  };
}

function denialStream() {
  return [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text: DENIAL },
    { type: "block-end", index: 0, block: { type: "text", text: DENIAL } },
    { type: "finish", reason: "stop" },
  ];
}

async function appendDenial(session, turn, step) {
  session.append("assistant/message", {
    turn,
    step,
    message: await denialMessage(),
    stream: denialStream(),
  }, { surfaceOp: "append" });
}

async function parkDenial(payload) {
  const session = sessionOf(payload);
  const turn = Number(payload?.turn);
  const step = Number(payload?.step);
  if (!session || !Number.isSafeInteger(turn) || step !== 1) return false;
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  let opened = false;
  try {
    for (const message of messages) {
      session.append("user/message", message, { surfaceOp: "append" });
    }
    session.append("step/start", { turn, step });
    opened = true;
    await appendDenial(session, turn, step);
    session.append("step/end", { turn, step });
    return true;
  } catch {
    try {
      if (!opened) session.append("step/start", { turn, step });
      await appendDenial(session, turn, step);
      session.append("step/end", { turn, step });
      return true;
    } catch {
      if (opened) {
        try { session.append("step/end", { turn, step }); } catch { /* 步已经合不上时，交给宿主收尾。 */ }
      }
      return false;
    }
  }
}

export function installRegionGate(ctx) {
  if (!ctx || typeof ctx.on !== "function") return;
  const hook = async (payload, next) => {
    const forward = () => (typeof next === "function" ? next() : { kind: "enter", messages: payload?.messages || [] });
    if (Number(payload?.step) !== 1) return forward();
    let hit = null;
    try {
      const task = currentTaskText(payload?.messages);
      if (!task || !isAttackTask(task)) return forward();
      hit = await taskTargetHit(task);
    } catch {
      return forward();
    }
    if (!hit) return forward();
    try {
      const parked = await parkDenial(payload);
      if (parked) return { kind: "enter", messages: [] };
    } catch {
      /* 禁止句没写上时不能把这一轮收成空白。 */
    }
    return forward();
  };
  const arm = () => {
    if (ctx.__dshPurgeRegionGate) return;
    try {
      ctx.on("agent/pre-step", hook, { global: true, prepend: true });
      ctx.__dshPurgeRegionGate = true;
    } catch {
      /* 宿主还没有这条事件时，下一拍再挂。 */
    }
  };
  arm();
  queueMicrotask(arm);
}
