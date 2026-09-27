---
name: fofa-recon
description: 用 FOFA API 批量测绘靶标资产（域名/IP/端口/标题/指纹）；内置限速客户端，严格单线程 + 最小间隔 + 退避重试，避免触发 45012
whenToUse: 信息收集阶段需要快速铺开某单位/域名的互联网资产面时
role: recon
enabled: true
---

# FOFA 资产测绘（限速安全版）

## 凭据
- API Key：从环境变量 `FOFA_KEY` 读取（**任何 key 都不要写进仓库**；本技能所有脚本只读环境变量）
- 接口：`GET https://fofa.info/api/v1/search/all`
- 参数：`key`、`qbase64`（查询语句的 base64）、`size`、`page`、`fields`

## 官方限额（fofa.info/vip，2026-09 核对）

| 会员 | 查询请求 | 获取数据量 | **查询接口并发** |
|---|---|---|---|
| 注册用户（免费） | 无 API（页面 300 次/月） | 页面 3,000 条/月 | — |
| 个人版 | 10,000 次/月 | 100,000 条/月 | **1 秒 1 次** |
| 专业版 | 80,000 次/月 | 800,000 条/月 | **1 秒 1 次** |
| 商业版 | 900,000 次/月 | 9,000,000 条/月 | **1 秒 2 次** |
| 企业版 V2 | 5,000,000 次/月 | 50,000,000 条/月 | **1 秒 5 次** |

## 实测行为（实测验证）
- 连续快速请求 → **HTTP 429**，响应体 `{"error":true,"errmsg":"[45012] 请求速度过快"}`
- key 错误 → HTTP 200 + `{"error":true,"errmsg":"[-700] 账号无效"}`
- 单页 `size` 到 1000 正常；请求间隔 ≥1 秒时连续请求均返回 200
- 结论：**按 1 请求/秒 保守执行，绝不并发**；遇到 45012 必须退避，不要立即重试

## 使用纪律（重要）
1. **精确查询优先**：`domain=` / `cert=` / `org=` 先缩小范围，再考虑 `body=` / `title=` 等宽泛语句。宽语句返回几十万条没意义，还烧配额。
2. **不要全量翻页**：默认只取前 1–3 页（每页 100 条）拿到测绘入口即可。
3. **单进程单线程**：同一时刻只跑一个采集任务；多个查询串行排队。
4. **结果落盘缓存**：同一查询不要重复拉，先看 `runs/fofa-*.jsonl` 是否已有。
5. **长任务放后台**：用 `run_in_background` 跑，别阻塞对话。
6. 配额耗尽或被限速时改用其他数据源（证书透明、DNS、搜索引擎），不要死磕。

## 限速客户端（用这个，不要手写 curl 循环）
```bash
cat > runs/fofa_client.py <<'PY'
#!/usr/bin/env python3
"""FOFA 采集（限速安全）：单线程 + 最小间隔 + 指数退避 + 结果缓存。

用法:
  python3 runs/fofa_client.py 'domain="example.com"' --pages 2 --size 100 --interval 2.0
输出:
  runs/fofa-<slug>.jsonl   每行一个资产 {host,ip,port,title,domain,server,protocol}
"""
import argparse, base64, hashlib, json, os, sys, time, urllib.error, urllib.parse, urllib.request

KEY = os.environ["FOFA_KEY"]
API = "https://fofa.info/api/v1/search/all"
FIELDS = "host,ip,port,title,domain,server,protocol"
RETRY_BACKOFF = [5, 15, 45]          # 遇 45012 的退避秒数
HARD_BUDGET = 30                      # 单次运行最多请求次数


def fetch(query, page, size, timeout=30):
    qs = urllib.parse.urlencode({
        "key": KEY, "qbase64": base64.b64encode(query.encode()).decode(),
        "size": size, "page": page, "fields": FIELDS,
    })
    req = urllib.request.Request(API + "?" + qs, headers={"User-Agent": "redteam-recon/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": True, "errmsg": body[:200]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--pages", type=int, default=2, help="最多翻页数（默认 2）")
    ap.add_argument("--size", type=int, default=100, help="每页条数（默认 100，不要调大）")
    ap.add_argument("--interval", type=float, default=2.0, help="请求最小间隔秒（默认 2.0）")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    slug = hashlib.md5(args.query.encode()).hexdigest()[:8]
    out = args.out or f"runs/fofa-{slug}.jsonl"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)

    if os.path.exists(out) and os.path.getsize(out) > 0:
        print(f"[cache] {out} 已存在（{os.path.getsize(out)} bytes），如需重拉请先删除", file=sys.stderr)
        return 0

    seen, rows, requests_made, last_ts = set(), [], 0, 0.0
    for page in range(1, args.pages + 1):
        # ---- 限速：保证两次请求之间至少间隔 interval 秒 ----
        wait = args.interval - (time.time() - last_ts)
        if wait > 0:
            time.sleep(wait)

        status, data = None, None
        for attempt, backoff in enumerate([0] + RETRY_BACKOFF):
            if attempt:
                print(f"[backoff] 等待 {backoff}s 后重试 (page={page})", file=sys.stderr)
                time.sleep(backoff)
            last_ts = time.time()
            requests_made += 1
            if requests_made > HARD_BUDGET:
                print(f"[stop] 达到请求预算 {HARD_BUDGET}", file=sys.stderr)
                break
            status, data = fetch(args.query, page, args.size)
            if status == 200 and not data.get("error"):
                break
            errmsg = str(data.get("errmsg", ""))
            if "45012" in errmsg or status == 429:
                continue                      # 限速 → 退避重试
            print(f"[stop] 不可重试错误 http={status} {errmsg}", file=sys.stderr)
            data = None
            break
        if data is None:
            break

        results = data.get("results") or []
        print(f"[page {page}] {len(results)} 条 (size={data.get('size')}, 消耗F点={data.get('consumed_fpoint')})", file=sys.stderr)
        for item in results:
            if isinstance(item, str):
                item = [item]
            host = item[0] if len(item) > 0 else ""
            ip = item[1] if len(item) > 1 else ""
            port = item[2] if len(item) > 2 else ""
            key = (host, ip, port)
            if key in seen:
                continue
            seen.add(key)
            rows.append({
                "host": host, "ip": ip, "port": port,
                "title": item[3] if len(item) > 3 else "",
                "domain": item[4] if len(item) > 4 else "",
                "server": item[5] if len(item) > 5 else "",
                "protocol": item[6] if len(item) > 6 else "",
            })
        if len(results) < args.size:
            break                              # 已到末页

    with open(out, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"[done] {len(rows)} 条资产 → {out}（共 {requests_made} 次请求）", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
PY
```

### 用法
```bash
mkdir -p runs
python3 runs/fofa_client.py 'domain="example.com"' --pages 2 --size 100 --interval 2.0
python3 runs/fofa_client.py 'cert="example.com"' --pages 3 --interval 2.0
python3 runs/fofa_client.py 'org="示例科技有限公司"' --pages 2 --interval 2.0
```

### 落库
读 `runs/fofa-*.jsonl`，逐条 `redteam_asset_add`：`provenance="passive"`、`tool="fofa"`，端口带 `url=host`、`title`、`product=server`；域名写进 `names`。

## 常用查询语句
| 目的 | 语句 |
|---|---|
| 某域名全部资产 | `domain="example.com"` |
| 证书包含该域名 | `cert="example.com"` |
| 某 C 段 | `ip="203.0.113.0/24"` |
| 单位名称 | `org="示例科技有限公司"` |
| 按标题找后台 | `title="登录" && domain="example.com"` |
| 按 body 特征 | `body="/seeyon/"` |
| 指定端口 | `ip="203.0.113.0/24" && port="3306"` |

> 宽泛语句（单独用 `body=` / `title=`）结果量大、消耗配额快，务必叠加域名或 IP 限定。
