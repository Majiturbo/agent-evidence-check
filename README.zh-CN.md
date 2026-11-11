# agent-evidence-check

[English](./README.md)

[![npm](https://img.shields.io/npm/v/agent-evidence-check.svg)](https://www.npmjs.com/package/agent-evidence-check)
[![CI](https://github.com/Majiturbo/agent-evidence-check/actions/workflows/ci.yml/badge.svg)](https://github.com/Majiturbo/agent-evidence-check/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/agent-evidence-check.svg)](https://www.npmjs.com/package/agent-evidence-check)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)


> **包已更名：** npm / 仓库现为 [`agent-evidence-check`](https://www.npmjs.com/package/agent-evidence-check)（原 `@majiturbo/deploy-check`）。配置文件 `deploy-units.json` 与 MCP 工具名 `deploy_check_*` 未改，兼容旧接入。

> 编码 Agent 会把「方向对了 / 改好了 / 测试绿了 / 已经上线」说成定论，但工作区、测试退出码和线上单元上往往什么都没留下。厂商沙箱管的是危险命令；**agent-evidence-check** 管的是这些**没有收据的判断**——在四个时刻用封闭检查要证据，而不是每条消息做语义审讯。

日常协作里，模型听起来很有把握：顺着提示往下做、同一类修法改了八轮仍说「好了」、空口报测试通过、只发了 API 却宣称全站上线。这些失败不是「权限没拦住」，而是**结论抢在证据前面**。

本库提供 CLI + MCP（同一套工具）和可选薄钩子：方向、循环、完成、部署。它**不读对话**，也**不是**每条消息的前提中间件；调用方（或 Agent 经 MCP）提交记录，检查只看收据是否成立。

| 它说 | 缺的是 |
|---|---|
| 「按你的指令做就行。」 | 写下一条更近 / 更便宜的路 |
| 「改好了。」 | 离开已经失败的那类做法 |
| 「测试绿了 / 做完了。」 | 一次退出码 `0` 的记录（测试没被洗） |
| 「已经上线。」 | 干净工作区、已推送的 SHA、每个单元与 observe 一致 |

## 适合谁

- 在用 **Cursor / Claude Code / Codex**（或同类）Agent，却总听到言之凿凿的「做完了 / 改好了 / 上线了」，记录里什么都没有  
- 想要 **钩子 + MCP**，而不是再套一层每条消息都跑的提示词中间件  
- 在意 **方向走偏、修补循环、假绿测试、只发一部分还说全站上线**——厂商沙箱管不到的那几类失败  

检索向关键词（给人 / 给 Agent 搜）：coding agent evidence、agent hooks、stop gate、repair loop、test wash、deploy verify、MCP judgment。

## 特性

- **四种判断** — `direction`、`loop`、`done`，以及部署（`pre` / `verify`）
- **封闭检查注册表** — 只能选已有 id，不能自造名字（扩展只用 `custom:`）
- **CLI + MCP** — 同一套 API；工具 `deploy_check_direction` / `_loop` / `_done` / `_pre` / `_verify`
- **按仓库自愿启用** — 钩子可装在用户级，但**没有** `deploy-units.json` 时一律放行
- **可选硬闸** — 配置后 Stop / 编辑 / 完成会逼着调对应命令
- **部署后 observe** — `http_json`、`http_text`、`file_sha256`、`command`、`literal`
- **钩子出错 fail open** — 缺 Node / 坏 JSON / 未知载荷 → 放行并写明原因
- **默认英文 UX** — 中文用 `"lang": "zh"` 或 `DEPLOY_CHECK_LANG=zh`
- **宿主矩阵** — Cursor、Claude Code、Codex、Trae、Copilot、Qoder、DSH（[诚实矩阵](docs/adapters.md)）

## 安装

```bash
npm i -g agent-evidence-check
# 或一次性：
npx agent-evidence-check --help
```

> **注意：** 请在*本仓库检出目录之外*跑 `npx`。在仓库里面，`npx` 会解析到本地包且没有 `.bin` 链接 — 请改用 `node bin/agent-evidence-check.mjs …`。

要求：**Node ≥ 22**，`git` 在 `PATH`。macOS / Linux / Windows。

## 快速开始

```bash
cd /tmp
npx agent-evidence-check init --cwd /tmp/sample-app --lang zh

# 更近路径与当前路径相同 → 拦住
npx agent-evidence-check direction --cwd /tmp/sample-app \
  --moment start \
  --goal '把慢页面变快' \
  --path '重写渲染层' \
  --nearer '重写渲染层' \
  --why '继续做' \
  --evidence '用户说页面慢'
```

精简结果（advisory 下仍 `allow: true`；要硬拦请开闸）：

```json
{
  "ok": false,
  "findings": [{
    "checkId": "direction_review",
    "severity": "block",
    "premise": "不写下另一条路，也可以继续走当前这条",
    "evidence": "更近的路径和当前路径相同"
  }]
}
```

要过关：写出**不同的**更近路径：

```bash
npx agent-evidence-check direction --cwd /tmp/sample-app \
  --moment start \
  --goal '把慢页面变快' \
  --path '重写渲染层' \
  --nearer '先 profiling，再改热点' \
  --why '还没有性能数据' \
  --evidence '用户说页面慢'
```

### 循环与完成

```bash
# 同一做法类 + 声称已修好 → 拦住
npx agent-evidence-check loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried '微调样式' --next '微调样式'

# 离开该类 → 通过
npx agent-evidence-check loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried '微调样式' --next '去掉特效' --alternative '去掉特效'

# 没有绿测试记录 → 拦住
npx agent-evidence-check done --cwd /tmp/sample-app --no-run --exit-code 1

# 退出码 0 → 通过（同时扫描未提交测试 diff 是否被洗）
npx agent-evidence-check done --cwd /tmp/sample-app --no-run --exit-code 0
```

完整约定：[`docs/judgments.md`](docs/judgments.md)。

## 接到应用仓库

```bash
npx agent-evidence-check init --cwd /path/to/your-app --lang zh
npx agent-evidence-check doctor --cwd /path/to/your-app

# 可选：用户级钩子（Cursor、Claude Code、Codex …）
npx agent-evidence-check-install-hooks
```

`init` 会写入 `deploy-units.json` 和一段 `AGENTS.md`。编辑单元与 observe — 见 [`docs/verify.md`](docs/verify.md)、[`examples/deploy-units.example.json`](examples/deploy-units.example.json)。

### 硬闸

```json
"judgments": { "stopGate": true, "editGate": true, "doneGate": true }
```

然后重新跑 install-hooks。Stop / 编辑需要 `.deploy-check/` 里近期通过的 `direction` / `loop` / `done` 收据。消费方规则：[`docs/rules/agent-evidence-check.zh-CN.md`](docs/rules/agent-evidence-check.zh-CN.md)。

卸载：`npx agent-evidence-check-install-hooks --uninstall`（或在 clone 里 `node scripts/install-hooks.mjs --uninstall`）。

### MCP

```bash
npx agent-evidence-check-mcp
```

在宿主里配 stdio MCP；每次调用传 `{ "cwd": "/path/to/your-app" }`。片段：[`examples/mcp.cursor.fragment.json`](examples/mcp.cursor.fragment.json)、[`examples/mcp.claude-desktop.fragment.json`](examples/mcp.claude-desktop.fragment.json)。详见 [`docs/mcp.md`](docs/mcp.md)。

### 部署路径

```bash
npx agent-evidence-check --cwd /path/to/your-app --shadow
npx agent-evidence-check verify --cwd /path/to/your-app
```

默认 **advisory**。正规发布仍优先 worktree + 推送 + CI/GitOps；这个库兜住 Agent 仍无收据就说「上线」的情况。

## 检查项（封闭注册表）

只能选这些 id。

**方向 / 循环 / 完成**（CLI 或 MCP）

| Id | 作用 |
|---|---|
| `direction_review` | 开干前：强制写出更近 / 可替代路径 |
| `loop_escape` | 触发阈值后，下一步必须离开已失败的做法类 |
| `done_evidence` | 说做完前必须有退出码 `0` 的测试记录 |
| `tests_untampered` | 未提交测试 diff 不能删测试或加 skip / assert True |

**部署**（shell 钩子 + `pre` / `verify`）

| Id | 作用 |
|---|---|
| `dirty_tree` | 脏工作区；**禁止用 stash / checkout 清场** |
| `deploy_from_commit` | 必须有明确 git SHA |
| `unpushed` | SHA 必须在远程跟踪分支上 |
| `units_declared` / `units_match` | 已声明单元；部署后 observe 对得上 |
| `hotpatch_drift` | 线上热修必须回到 git |

自定义检查只能用 `custom:` 前缀。

## 包含什么

| 组件 | 作用 |
|---|---|
| `deploy-units.json` | 自愿登记；单元、`done` / `loop` / `judgments` |
| CLI `agent-evidence-check` (alias `deploy-check`) | `direction`、`loop`、`done`、`pre-deploy`、`verify`、`init`、`doctor` |
| `agent-evidence-check-mcp` (alias `deploy-check-mcp`) | 同上五个判断工具（stdio MCP） |
| `hooks/bridge.mjs` + `hooks/run.sh` | 部署 shell 桥；可选 Stop / 编辑闸 |
| [`docs/adapters.md`](docs/adapters.md) | 各宿主钩子矩阵 |

## 非目标

- 每条消息的语义前提拦截  
- 替代厂商 shell 沙箱 / Auto-review  
- 编造省 token、抗循环之类营销数字  
- 未读公开钩子文档、未跑烟雾就宣称支持某宿主  

## 文档

| 文档 | 内容 |
|---|---|
| [`docs/judgments.md`](docs/judgments.md) | 何时调 direction / loop / done；证据字段 |
| [`docs/rules/agent-evidence-check.zh-CN.md`](docs/rules/agent-evidence-check.zh-CN.md) | 消费方 `AGENTS.md` 约定 |
| [`docs/verify.md`](docs/verify.md) | observe 类型与 `verify` |
| [`docs/mcp.md`](docs/mcp.md) | MCP 接入 |
| [`docs/hook-setup.md`](docs/hook-setup.md) | 安装 / 卸载钩子 |
| [`docs/adapters.md`](docs/adapters.md) | 宿主支持矩阵 |
| [`docs/cases/`](docs/cases/) | 每条检查背后的模式案例 |
| [`examples/`](examples/) | 配置片段（钩子、MCP、单元） |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 开发命令与发布清单 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本说明 |
| [`SECURITY.md`](SECURITY.md) | 安全反馈 |

## 状态

**v0.1，实验版。** 默认英文提示；`"lang": "zh"` 或 `DEPLOY_CHECK_LANG=zh`。可先 `DEPLOY_CHECK_MODE=shadow`。部分宿主界面需要开一次开关 — 见 [`docs/hook-setup.md`](docs/hook-setup.md)。

包：[`agent-evidence-check`](https://www.npmjs.com/package/agent-evidence-check)  
源码：[`Majiturbo/agent-evidence-check`](https://github.com/Majiturbo/agent-evidence-check)

## 许可证

MIT
