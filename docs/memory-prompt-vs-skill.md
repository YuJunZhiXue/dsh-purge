# 提示词、Skill、choirboy：怎么记

这份是给自己和后续改测试版用的记忆，不是给模型当系统提示。

## 三件事不要混

| 东西 | 新开对话会怎样 | 你要不要动手 |
|---|---|---|
| **dsh-purge 提示词**（`prompt-inject.md`） | 第一轮自动写进系统提示；之后只折注入，不钉上一轮全文（#29） | 不用再打「你是谁」来灌提示词 |
| **DSH Skill**（`$DSH_HOME/skills/<id>/SKILL.md`） | 只进官方目录，**不会**自动跑正文 | 聊天输入 `/名称`，或等模型按 description 调 `skill` 工具 |
| **choirboy-prompt**（`e:\渗透\choirboy-prompt`，仓库外） | SessionStart 钩子把 lore 整包贴进上下文 | 装好后新会话自动灌；**不支持 DSH** |

正文里写「激活」两个字，官方不认。官方只认 frontmatter：`name`、`description`、`whenToUse`、`disable-model-invocation`、`user-invocable`。

## Hook 是什么

智能体软件自己会走过「开新会话 / 停下来」。Hook 是它在这些节点上预留的门铃。choirboy 的 `install.sh` 往本机配置里写：到 SessionStart 先跑 `session-start.sh`。脚本读磁盘上的 md，吐出一段字，宿主塞进上下文。**不是改模型，是改宿主配置。**

DSH 没有 choirboy 那套 SessionStart 挂钩。我们的提示词靠 assemble 钩子注入；Skill 靠官方 `dsh-skill-filesystem` + `dsh-tool-skill`。

## 装到哪里

官方扫两套目录，**同名时工作区盖住环境**（rank 100 < 400）：

| 范围 | 目录 | 谁看得见 |
|---|---|---|
| **环境** | `$DSH_HOME/skills` | 这个宿主上所有对话 |
| **工作区** | `<项目>/.dsh/skills` | 当前项目对话（按 git 根，没有 git 就用 cwd） |

插件两套都装。Web / 桌面各有自己的 `$DSH_HOME`，工作区用项目名，不写死盘符。命中和加载仍由 DSH 负责。

## 产品决定（测试版）

- Skill 要像别的工具一样「能用、找得到」。很多人不知道 DSH 已支持，也不知道装哪。
- **设置侧栏单独一个「规则 · Skill」菜单**（英文 Rules · Skills），紧挨「规则设定」，让人看出是本插件的第二栏，不是宿主自带。官方 1.1.11 没有这个菜单。
- Skill 页只留标题、目录一行、新建/导入和卡片列表。说明全文换行，不再塞进 240px 规则列表。
- 官方还认 `whenToUse`、`disable-model-invocation`、`user-invocable`，以及目录里 SKILL.md 以外的资源。保存只改 SKILL.md，不删附属文件。
- 设置页「环境 / 工作区」两栏。工作区写入 `$WORKSPACE/.dsh/skills`；未绑定就从宿主工作区列表取，或手动填项目根目录。`.agents/skills` 仍由宿主自己扫，插件不代写。
- 不要把 Skill 折进系统提示。要「开场自动灌」是另一条（学 choirboy），和 `/名称` 分开做。
