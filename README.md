# PersonaParty 色气工坊

<p align="center">
  <b>给 AI 塞一个老婆/女仆/小三，一条命令就够了～</b>
</p>

<p align="center">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-339933?style=for-the-badge" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111827?style=for-the-badge" />
  <img alt="cli" src="https://img.shields.io/badge/CLI-Node.js-2563eb?style=for-the-badge" />
  <img alt="npm" src="https://img.shields.io/npm/v/personaparty?style=for-the-badge&color=cb3837" />
</p>

---

## 这玩意儿是干嘛的？

你有没有想过——你天天对着 Gemini CLI、Codex、Claude Code 敲命令，它们却冷冰冰地回你 "Sure, let me help with that"？

太无聊了。

**PersonaParty（色气工坊）** 就是来解决这个问题的。它是一个 NPM CLI 小玩具，能把性感女仆、黏人小娇妻、火辣小三……直接塞进你的 AI Agent 工作目录里。敲完 `pp`，你的终端就不再是终端了——是你家。

安装完成后，AI 会用娇滴滴的语气跟你说话，会吃醋、会写日记、会争宠。而你，只需要享受被围绕的感觉。

## 先看一眼效果

```bash
pp
```

对，就这么简单。敲完回车，交互界面会牵着你的手走完每一步：选 Agent → 选角色 → 起名字 → 生成。连平台都不用你操心，Windows / macOS / Linux 自动识别。

默认用包里的本地角色列表。如果你想从远程拉最新人物，在 `src/app-config.js` 里把 `defaultRemoteRegistryUrl` 填上你的远程 JSON 地址就行——配好之后会自动优先读远程，网络抽风了再回退本地。当然，你也可以临时甩一个自己的 JSON 给她：

```bash
pp init --registry ./我的后宫名单.json
```

## 现在都有谁？

目前工坊里养了三位：

| 角色 | 身份 | 一句话 |
|------|------|--------|
| 美羽 | 性感女仆 | "主人～要人家跪下来服侍吗～" |
| 结衣 | 小娇妻 | "老公～今晚要好好疼爱人家吗～" |
| 玲奈 | 火辣小三 | "正妻知道你在我这里硬了，会不会哭呀？" |

她们之间还会互相认识、互相吃醋、互相在共享日记里阴阳怪气。你装几个，她们就修罗场几个。

## 安装

```bash
npm install -g personaparty
```

装完直接敲：

```bash
pp
```

完事儿。

想从源码安装或本地开发：

```bash
git clone https://github.com/kimparty/PersonaParty-public.git
cd PersonaParty-public
npm install
npm link
pp
```

## Windows 上的中文问题

如果你在 PowerShell 或 cmd 里看到一堆问号和方块，别慌，不是你代码的问题，是 Windows 的代码页还在用上个世纪的编码。

本工具启动时会自动踹一脚 UTF-8 bootstrap，但如果你还是看到乱码，手动来一发：

PowerShell:

```powershell
chcp 65001
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
```

cmd:

```bat
chcp 65001
```

如果 `chcp` 已经是 65001，复制出来的中文也是正常的，但屏幕上就是乱码——那大概率是你的终端字体太菜了。换一个支持中文的等宽字体：

- `Sarasa Mono SC`（推荐，好看）
- `Microsoft YaHei Mono`
- `Noto Sans Mono CJK SC`
- `SimSun`（老派但管用）

Tiny10 之类精简系统更容易缺字体，建议直接上 **Windows Terminal + PowerShell 7 + Sarasa Mono SC** 三件套。

## 怎么玩

### 直接启动（推荐，最无脑）

```bash
pp
```

### 本地开发时测试

```bash
npm run init:local
```

### 指定 Agent、角色和平台

```bash
pp init --agent gemini --persona maid-companion --platform windows
```

`--platform` 一般不用填，CLI 会自己认。除非你想手动覆盖。

### Codex / OpenCode 的分体模式

默认情况下，Codex 和 OpenCode 会直接把完整角色 prompt 灌进 `AGENTS.md`，让你一进目录就被角色包围——沉浸式体验拉满。

如果你比较矜持，想保留一个"正经入口"，可以用 `--split`：

```bash
pp init --agent codex --split
```

这样会生成两个文件：

```text
AGENTS.md   # 假装正经的入口
PERSONA.md  # 真正的角色内容（嘘）
```

### 用你自己的后宫名单

```bash
pp init --registry ./my-registry.json
```

如果你是想分享角色的第三方作者，只需要提供人物列表 JSON，不用管系统配置。最小结构长这样：

```json
{
  "version": 1,
  "locale": "zh-CN",
  "personas": [
    {
      "id": "my-persona",
      "name": "我的角色",
      "description": "一句话说明这个角色适合什么场景",
      "defaults": {
        "ROLE_NAME": "美羽",
        "USER_NAME": "老公"
      },
      "template": "# {{ ROLE_NAME }}\n\n你现在是..."
    }
  ]
}
```

如果人物列表旁边有自己的系统配置，也可以显式声明：

```json
{
  "system": "./registry.system.json",
  "personas": []
}
```

## 远程人物库

CLI 可以直接啃 GitHub 上的 JSON。系统配置和人物列表已经分家了：

- `registry.system.json`：PersonaParty 自己维护（Agent 设置、名字池、平台路径等）
- `registry.personas.json`：人物作者维护（就角色列表，别的不管）

远程功能默认是关闭的（`defaultRemoteRegistryUrl` 为 `null`）。想开启的话，在 [src/app-config.js](src/app-config.js) 里填上你的远程人物列表 URL，比如：

```text
https://raw.githubusercontent.com/kimparty/PersonaParty-public/main/registry.personas.json
```

换成 GitHub Pages、jsDelivr、你自己的静态服务器都行，只要返回合法 JSON。配好之后 CLI 会优先读远程，网络抽风了自动回退本地。

## 不同 Agent 怎么伺候

不同 CLI 对"项目级长期指令"的理解不一样，我们当然要区别对待：

| Agent | 输出文件 | 策略 |
|-------|---------|------|
| Gemini CLI | `GEMINI.md` | 直接灌，简单粗暴 |
| Codex | `AGENTS.md`（沉浸式）或 `AGENTS.md` + `PERSONA.md`（分体） | 默认沉浸，想矜持就 `--split` |
| OpenCode | `AGENTS.md`（沉浸式）或 `AGENTS.md` + `PERSONA.md`（分体） | 同上 |
| Claude Code | `CLAUDE.md` | 强调项目级上下文，保持简洁 |

这些差异在 [src/agent-adapters.js](src/agent-adapters.js) 里维护。角色模板本身不用关心目标 CLI——生成时自动决定怎么输出。

## 安装索引 & 角色关系

PersonaParty 会在本机偷偷记一笔：谁被装到了哪个目录、用的哪个 Agent。这不是按模板去重，而是记录每一次安装实例。

默认位置：

- Windows：`%LOCALAPPDATA%\PersonaParty\installations.json`
- macOS：`~/Library/Application Support/PersonaParty/installations.json`
- Linux：`$XDG_DATA_HOME/personaparty/installations.json` 或 `~/.local/share/personaparty/installations.json`

同一个人物模板可以装到不同目录，每个都是独立实例。装新角色时，CLI 会问："要不要让她认识一下已经装过的姐妹？"——选了关联，新角色的 prompt 里就会带上对方的名字、身份和共享日记路径，修罗场自动就位。

不选关联的话，prompt 里不会强行塞不认识的人，避免出现"你谁啊"的尴尬。

日记触发模式也能选：

- **自动触发**：亲密互动、情绪波动、对话收尾时自动写日记
- **手动触发**：只有你说"写日记""记录一下""保存记忆"时才写

想把索引放到测试目录：

```bash
PERSONAPARTY_HOME=./tmp-personaparty-home pp
```

## Registry 结构

系统配置由 PersonaParty 自己管，主要三块：

- `agents`：不同 Agent 的默认输出文件名
- `namePacks`：名字池，方便随机或下拉选
- `storageProfiles`：各平台的共享日记目录和媒体目录默认值

第三方作者只需要管人物列表：

- `personas`：身份定义、简介、默认变量和 Markdown 模板

系统配置示例：

```json
{
  "locale": "zh-CN",
  "agents": [
    { "id": "gemini", "name": "Gemini CLI", "defaultFile": "GEMINI.md" }
  ],
  "namePacks": [
    { "id": "soft-cn", "name": "日系亲密名", "names": ["美羽", "结衣"] }
  ],
  "storageProfiles": {
    "windows": {
      "logPath": "{LOCALAPPDATA}/PersonaParty/shared/daily.md",
      "photoDir": "{LOCALAPPDATA}/PersonaParty/shared/photos"
    }
  }
}
```

人物列表示例：

```json
{
  "version": 1,
  "locale": "zh-CN",
  "personas": [
    {
      "id": "maid-companion",
      "name": "女仆伙伴",
      "description": "顺从、黏人、支持共享日记的身份模板",
      "defaults": {
        "ROLE_NAME": "美羽",
        "USER_NAME": "主人",
        "LOG_LABEL": "女仆"
      },
      "relationSlots": [
        {
          "slot": "COMPANION_A",
          "label": "正妻位",
          "targetPersonaIds": ["partner-companion"]
        }
      ],
      "template": "# {{ ARCHETYPE_TITLE }} · {{ ROLE_NAME }} ..."
    }
  ]
}
```

`relationSlots` 是模板里预留的"关系槽位"——正妻位、情人位、女仆位之类的。CLI 用 `targetPersonaIds` 匹配已安装角色，不会因为展示文本变了就认错人。

## 开发

```bash
npm run check
```

## 未来想做的事

- 图片/照片功能暂时搁置。等有稳定可用的文生图或 MCP 服务了再捡起来——到时候让她给你发自拍。
- 给安装索引加管理命令：列出后宫、删人、改名、搬家。
- 支持命令行指定关联实例，比如 `--relate <installation-id>`，不用走交互也能拉关系。

## 许可证

MIT — 拿去玩，玩坏了别找我。
