# 部署核对（工具无关，应写入各 Agent 手册）

[English](./deploy-check.md)

本规则不依赖任何 IDE。Cursor / Claude Code / Codex 等若另有 hook，hook 是强制执行层；**本文件是所有工具的最低公约**。

## 硬约束

1. **禁止**用 `git stash` / `git checkout --` / `git restore` / `git reset --hard` / `git clean -f` 为部署清场。工作区里「不是我改的」文件，可能是另一工具（Trae、另一会话）未提交的工作。
2. 只从**已推送的明确 git SHA** 部署，不从「当前工作区」部署。
3. 声称「已上线」前，必须按仓库根目录 `deploy-units.json` 逐项核验；缺任一项就只能说「已更新：&lt;单元列表&gt;」，不能说全部上线。
4. 热修（直接改宿主机文件 / 线上 env）必须写回 git，并在回复里用阶梯说清进度：

   `本地改动 → 已提交(SHA) → 已推送 → 已部署(单元…) → 已核验(证据…)`

5. 部署前若可用，运行：

   ```bash
   npx deploy-check --cwd . --shadow
   # or: node /path/to/deploy-check/bin/check-deploy.mjs --cwd . --shadow
   ```

   有 `block` 级 finding 时先处理，再继续。

6. 部署之后、说「已上线」之前，运行：

   ```bash
   npx deploy-check verify --cwd .
   ```

   每个单元要么在 `deploy-units.json` 里写了 `observe`，要么用 `--observed` 传入证据。只发了一部分时，只能点名已更新的单元。

7. **任务开头**，以及**中途转折**（用户改了目标、否定了做法、或出现更短的路径）时，**必须**先做方向审查，再改文件或沿旧路径继续。优先用 MCP `deploy_check_direction`。要写下目标、当前路径、一条不同的更近路径、为何走或不走、以及一条事实。跳过或失败就停。说明见 [`docs/judgments.md`](../judgments.md)。

   ```bash
   npx deploy-check direction --cwd . --moment turn --goal "…" --path "…" --nearer "…" --why "…" --evidence "…"
   ```

8. 在反复修改之后、说「改好了」之前，**必须**做循环跳脱（优先 MCP `deploy_check_loop`）。提交对象、修改次数、用户否定次数、已经用过的做法类别、下一步的类别。一旦触发，下一步必须是另一个类别。还停在原类别里时，不要说已经改好。

   ```bash
   npx deploy-check loop --cwd . --target FILE --edits N --rejections N --tried "…" --next "…" --alternative "…"
   ```

   这两项不走部署用的 shell 钩子。如何加硬（Stop、按编辑次数拦截）见 [`docs/judgments.md`](../judgments.md#how-to-make-the-agent-actually-call-them)。

9. 改完之后、说「做完了 / 改好了 / 测试绿了」之前，**必须**做完成证据（优先 MCP `deploy_check_done`）。会跑 `done.testCommand`，并拒绝未提交 diff 里明显的洗测试。

   ```bash
   npx deploy-check done --cwd .
   ```

## 更近的路

- 多工具并行：各用独立 **git worktree / 分支**，合并后再发。
- 有 CI 时：提交并推送后由流水线部署，Agent 尽量不从开发机 `ssh` 直推生产。
