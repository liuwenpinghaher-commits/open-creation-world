# Open Creation World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable MVP for the PRD "创造世界 - 开放创造的可解释模拟世界".

**Architecture:** A React + TypeScript app with tldraw as the open creation canvas, focused domain modules for semantic objects, affordances, interaction resolution, rules, replay, event logging, and parent summaries. The browser UI exposes the whole learning loop: create an object, confirm semantics, simulate, replay, modify, retest, and save evidence locally.

**Tech Stack:** Vite, React, TypeScript, tldraw, json-rules-engine, xstate, dexie, Vitest, Testing Library, Playwright.

---

## File Structure

- `package.json`: app scripts and dependencies.
- `vite.config.ts`: Vite and Vitest configuration.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript configuration.
- `index.html`: app entry HTML.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: application shell and workflow wiring.
- `src/App.css`: product UI styles.
- `src/domain/types.ts`: shared PRD data types.
- `src/domain/capabilities.ts`: child-friendly capabilities, constraints, and mapping helpers.
- `src/domain/semantic.ts`: create and update WorldObject semantic cards.
- `src/domain/affordances.ts`: capability-based affordance matching.
- `src/domain/interactions.ts`: transform child intent into InteractionDecision.
- `src/domain/rules.ts`: RulePack simulation.
- `src/domain/replay.ts`: keyframe generation and replay state.
- `src/domain/events.ts`: event log reducer and evidence helpers.
- `src/domain/summary.ts`: parent summary generator.
- `src/domain/challenge.ts`: first validation scenario pack.
- `src/persistence/db.ts`: Dexie local-first persistence.
- `src/components/TldrawWorld.tsx`: tldraw canvas integration.
- `src/components/SemanticCard.tsx`: child-confirmed semantic card UI.
- `src/components/InteractionPanel.tsx`: simulate, explain, modify, and retest UI.
- `src/components/ReplayPanel.tsx`: keyframe viewer.
- `src/components/ParentSummaryPanel.tsx`: parent summary UI.
- `src/test/*.test.ts`: unit tests for all domain modules.
- `src/test/App.test.tsx`: smoke test for the app flow.
- `e2e/open-creation.spec.ts`: Playwright user-flow verification.

## Tasks

### Task 1: Project Scaffold and Test Harness

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/setupTests.ts`

- [ ] **Step 1: Create project configuration**

Add scripts for `dev`, `test`, `build`, and `e2e`. Configure Vitest with jsdom.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

- [ ] **Step 3: Verify test harness**

Run: `npm test -- --run`
Expected: Vitest starts and reports no tests or the first intentional failures.

### Task 2: Domain Tests First

**Files:**
- Create: `src/test/semantic.test.ts`
- Create: `src/test/affordances.test.ts`
- Create: `src/test/interactions.test.ts`
- Create: `src/test/rules.test.ts`
- Create: `src/test/events-summary.test.ts`

- [ ] **Step 1: Write failing tests**

Tests must cover:
- A free-form child creation becomes a WorldObject semantic card.
- Unknown object names are accepted when capabilities match.
- Missing facts trigger one concrete question.
- RulePacks simulate terrain, load, support, and energy outcomes.
- EventLog creates replayable learning evidence and parent summary.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/test`
Expected: FAIL because domain modules do not exist.

### Task 3: Domain Implementation

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/capabilities.ts`
- Create: `src/domain/semantic.ts`
- Create: `src/domain/affordances.ts`
- Create: `src/domain/interactions.ts`
- Create: `src/domain/rules.ts`
- Create: `src/domain/replay.ts`
- Create: `src/domain/events.ts`
- Create: `src/domain/summary.ts`
- Create: `src/domain/challenge.ts`

- [ ] **Step 1: Implement minimal code to pass domain tests**

Implement pure TypeScript modules with no UI dependencies.

- [ ] **Step 2: Verify GREEN**

Run: `npm test -- --run src/test`
Expected: PASS.

### Task 4: Persistence

**Files:**
- Create: `src/persistence/db.ts`
- Create: `src/test/persistence.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Tests must prove a session saves and reloads WorldObject, events, replay, and summary.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/test/persistence.test.ts`
Expected: FAIL because persistence is not implemented.

- [ ] **Step 3: Implement Dexie persistence**

Use local IndexedDB tables for sessions, objects, events, replays, and summaries.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run src/test/persistence.test.ts`
Expected: PASS.

### Task 5: React UI and tldraw Integration

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/components/TldrawWorld.tsx`
- Create: `src/components/SemanticCard.tsx`
- Create: `src/components/InteractionPanel.tsx`
- Create: `src/components/ReplayPanel.tsx`
- Create: `src/components/ParentSummaryPanel.tsx`
- Create: `src/test/App.test.tsx`

- [ ] **Step 1: Write failing app smoke test**

Test that the app renders open creation, semantic card, simulation, replay, and parent summary regions.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/test/App.test.tsx`
Expected: FAIL because UI files do not exist.

- [ ] **Step 3: Implement app UI**

Build a dense, work-focused interface with tldraw canvas, semantic card, interaction controls, replay, and parent summary.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- --run src/test/App.test.tsx`
Expected: PASS.

### Task 6: Browser Verification

**Files:**
- Create: `e2e/open-creation.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Write Playwright flow**

Verify: create a free-form object, confirm capabilities, simulate, show keyframes, modify, retest, and show parent summary.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run dev server and e2e**

Run: `npm run e2e`
Expected: PASS.

---

## Spec Coverage

This plan maps the PRD to implementation:

- Open creation canvas: Task 5.
- Semantic card: Tasks 2, 3, 5.
- Capability and constraint vocabulary: Tasks 2, 3.
- Affordance Graph: Tasks 2, 3.
- Interaction Resolver: Tasks 2, 3.
- RulePack system: Tasks 2, 3.
- Keyframe replay: Tasks 2, 3, 5.
- AI semantic compile placeholder: Task 3 implements deterministic local AI-draft behavior for MVP.
- Learning Opportunity Detector: Tasks 2, 3.
- EventLog and local-first persistence: Tasks 3, 4.
- Parent summary: Tasks 2, 3, 5.
- First validation scenario pack: Tasks 3, 5, 6.

