---
name: gsd-core
description: >-
  GSD (Get Sh*t Done) Core system: meta-prompting, context-engineering, and spec-driven development framework.
  Always use this skill for disciplined engineering: discuss -> plan -> execute -> verify -> ship, maintaining .planning/ directory, atomic commits, and verification loops.
---

# GSD Core — Spec-Driven Agentic Development

**GSD Core** is a meta-prompting, context-engineering, and spec-driven development framework designed to maintain maximum model intelligence, prevent context rot, and ensure verifiable shipping.

---

## Core Philosophy & The 5-Step Loop

Every milestone and phase executes through this disciplined five-step lifecycle:

```mermaid
flowchart LR
    A["1. Discuss"] --> B["2. Plan"]
    B --> C["3. Execute"]
    C --> D["4. Verify"]
    D --> E["5. Ship"]
```

1. **Discuss (`/gsd-discuss-phase`)**:
   - Capture user requirements, architectural constraints, and implementation decisions before planning begins.
   - Establish invariants, boundaries, and acceptance criteria.
2. **Plan (`/gsd-plan-phase`)**:
   - Research domain and codebase boundaries.
   - Decompose into bite-sized tasks.
   - Create detailed `PLAN.md` with verification checks and rollback criteria.
3. **Execute (`/gsd-execute-phase`)**:
   - Execute plans in structured waves.
   - Small, atomic, test-backed commits.
   - Never leave unverified code in the working tree.
4. **Verify (`/gsd-verify-work`)**:
   - Walk through what was built against the acceptance criteria.
   - Run type checks (`npx tsc --noEmit`), unit/e2e tests, and build verifications.
   - Diagnose and fix regressions before declaring done.
5. **Ship (`/gsd-ship`)**:
   - Prepare clean commit history, generate summaries, and prepare PRs/merges.

---

## Project Structure & `.planning/`

GSD Core organizes durable state in the `.planning/` directory:
- `.planning/ROADMAP.md` — High-level milestone trajectory and phase definitions.
- `.planning/STATE.md` — Current active milestone, phase, blockers, and recent decisions.
- `.planning/milestones/` — Detailed milestone specifications and progress records.
- `.planning/phases/` — Phase-level plans (`PLAN.md`), research notes (`RESEARCH.md`), and UAT checklists.

---

## Command & Skill Reference

All 72+ modular GSD skills are available under `.agents/skills/`:
- `gsd-new-project` / `gsd-onboard`: Project initialization and brownfield onboarding.
- `gsd-plan-phase`: Research and generate actionable phase plans.
- `gsd-execute-phase`: Wave-based parallel task execution.
- `gsd-verify-work`: Conversational UAT and test-driven validation.
- `gsd-code-review`: Static analysis, architectural review, and anti-pattern detection.
- `gsd-debug` / `gsd-forensics`: Root-cause failure analysis and regression diagnosis.
- `gsd-ui-phase` / `gsd-ui-review`: Frontend design system compliance, responsive styling, and accessibility.
- `gsd-secure-phase`: Security review and vulnerability remediation.
- `gsd-progress`: Progress assessment and situational next-step recommendations.
- `gsd-ship`: Safe release preparation, changelogs, and branch hygiene.

---

## Operating Invariants

1. **Source of Truth**: Read `.planning/` and codebase state before making assumptions.
2. **Atomic Steps**: Keep code modifications scoped to the active phase or task.
3. **Verification First**: Validate every change with automated tests or compiler checks before concluding.
