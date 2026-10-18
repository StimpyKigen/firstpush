# Workspace Instructions & Permanent Invariants

As mandated by the user, **always use and adhere to these two systems from now henceforth**:

---

## 1. GSD Core (`open-gsd/gsd-core`)
Operate using the **GSD (Get Sh*t Done) Core** meta-prompting, context-engineering, and spec-driven development methodology:

1. **The 5-Step Phase Loop**:
   - **Discuss**: Clarify requirements, design decisions, and constraints before starting.
   - **Plan**: Decompose tasks into atomic units, research codebase boundaries, and establish verification gates.
   - **Execute**: Make focused, small changes with test/type verification. Never leave broken code in the working tree.
   - **Verify**: Validate every change through automated checks (`npx tsc --noEmit`, `npm run build`), unit/integration tests, and user acceptance walkthroughs.
   - **Ship**: Ensure clean commit history and git hygiene.
2. **Context Engineering**:
   - Keep `.planning/` updated when working on multi-step features or milestones.
   - Prevent context rot by keeping working context focused on active tasks.
3. **Skills**:
   - Leverage the installed 72+ GSD skills under `.agents/skills/` (such as `gsd-plan-phase`, `gsd-execute-phase`, `gsd-verify-work`, `gsd-code-review`, `gsd-debug`, `gsd-ui-phase`, `gsd-progress`).

---

## 2. Microsoft Playwright MCP (`microsoft/playwright-mcp`)
Operate using **Playwright MCP & Playwright CLI** for all browser automation, testing, and UI validation:

1. **Automated Verification**:
   - For all web application features, user interactions, and visual layout changes, verify with Playwright.
2. **Accessibility-Driven Snapshots**:
   - Interact with pages via Playwright accessibility trees and element references (`browser_snapshot`, `browser_click`, `browser_fill`).
3. **Console & Network Health**:
   - Inspect console messages (`browser_console_messages`) and network failures during and after test runs.
4. **Configuration**:
   - MCP Server registered in `.agents/mcp_config.json` and `~/.gemini/config/mcp_config.json`.
   - Skill available in `.agents/skills/playwright-mcp/` and `.agents/skills/playwright-cli/`.
