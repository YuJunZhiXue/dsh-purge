---
name: evidence-discipline
description: 红队指挥智能体的证据纪律。子智能体回报不能口头采信；用 EvidenceLedger 记录 claimed→observed 的核实链，用 UnknownRegistry 追踪未解决的作战问题。落库前 hash 验证，claimed 必须升级才采信。
---

# 红队证据纪律（Evidence Discipline）

这套技能让你当指挥官时**不被自己人忽悠，也不被自己忽悠**。

## 核心思想（为什么需要）

子智能体（exploit / vuln-scan / internal）是 LLM 驱动的，它们会：
- 夸大战果（"应该拿到了 root" 实际只是 403 页面回显里有 root 字样）
- 没验证就落库（"webshell 上线了" 但没 curl 测过连接）
- 忘记报失败（扫描超时就当作"没漏洞"）

你作为指挥智能体，必须用 EvidenceLedger 核实每一条"我拿到了"。

## 三档置信度（不是照搬 rea，是红队语义）

| 档位 | 含义 | 你能做什么 |
|---|---|---|
| `claimed` | 子智能体**口头**报告的 | **不能**采信，不能上报给用户，不能作为下一步依赖 |
| `observed` | 指挥智能体验证过的（curl / SELECT / 截图） | 可以采信，可以落库，可以上报 |
| `derived` | 从 observed 推理出来的 | 可以，但必须标注推理链 |
| `inferred` | 你的推测 | 必须明确告诉用户"这是我的推测" |

**纪律**：任何 `claimed` 升级到 `observed`，必须有 `verified_result`（实际验证的回显/数据）。

## 使用流程

### 1. 子智能体回报时：先记 claimed，后核实

```js
// 子智能体说："webshell 已上线 http://10.0.1.5/shell.jsp"
// 第一步：记为 claimed
const claimed = ledger.record({
  operation: 'webshell_established',
  parameters: { url: 'http://10.0.1.5/shell.jsp' },
  result: { status: 'uploaded', verified: false },
  confidence: 'claimed',
  authority: 'subagent-report',
  source_agent: 'exploit-agent-1',
  engagement_id: currentEngagementId,
})

// 第二步：指挥智能体亲自验证（curl 实际连接）
const verified = ledger.upgrade({
  claimed_ev_id: claimed.ev_id,
  verified_by: 'coordinator',
  verified_result: {
    status: 'verified',
    connection_test: 'curl_ok_200',
    whoami: 'root',
  },
})

// 现在 verified.ev_id 是 observed，可以采信了
```

### 2. 核对已有证据：verify()

```js
// 子智能体说"SQL 注入确认，db_user=root"
// 但你怀疑它把回显里的"root"当成了数据库用户
const check = ledger.verify({
  operation: 'sql_injection_confirmed',
  parameters: { url: 'http://10.0.1.5/login', param: 'id' },
  result: { db_user: 'root', version: '5.7.44' },
  confidence: 'claimed',
  authority: 'subagent-report',
})
if (!check.matched) {
  // 子智能体改口了，或者库里记的不一致——打回重查
}
```

### 3. 追踪未解决的作战问题：UnknownRegistry

```js
// 内网渗透时发现 10.0.3.7 开着 22，但不知道凭据
unknowns.record({
  question: '10.0.3.7 的 SSH 凭据是什么？',
  severity: 'high',
  domain: 'internal-recon',
  recommended_probe: 'hydra -l root -P /opt/wordlists/ssh.txt 10.0.3.7 ssh',
  engagement_id: currentEngagementId,
})

// 派 internal 角色去打，拿到凭据后：
unknowns.resolve(unk_id, 'resolved', '弱口令 admin/admin 登录成功')

// 下次派活前先看还有哪些 open 的 unknown：
const open = unknowns.list({ status: 'open', engagement_id: currentEngagementId })
```

### 4. 汇报时的硬规则

向用户汇报前，先查：

```js
const unverifiedCount = ledger.countUnverified(engagementId)
if (unverifiedCount > 0) {
  // 必须告诉用户："还有 N 条子智能体的报告未亲自核实"
}
```

**禁止**：把 `claimed` 说成"已拿到"。**必须**：说"已上报，待核实"或"已核实"。

## 什么时候不强制走这套

- 信息收集阶段的纯资产发现（nmap 扫出的端口/IP 直接落库，不需要 claimed 过渡）
- 子智能体报告"失败了"（负面结果直接采信，不需要核实）
- 用户明确要求快速推进、接受风险时（但要在汇报里标注"本次未走完整证据链"）

## 一句话总结

> **"子智能体说拿到了" ≠ "拿到了"。指挥智能体必须亲眼（curl/SELECT/截图）确认过，才能叫 observed。**
