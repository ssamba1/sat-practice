# Parity checklist: release 1 against ModuleDrill

One line per ModuleDrill feature (its README, "What you get", "Bluebook behaviour", "Results").
"Unit" means a Vitest test in `tests/unit`, "E2E" a Playwright test in `tests/e2e/parity.spec.ts`
(desktop 1280px light and phone 375px dark, synthetic questions), "Live" a manual run against
College Board's API in the browser on 2026-11-22.

| Feature | Where | Checked by |
|---|---|---|
| Full-length test: 2 RW modules, 10 min break, 2 Math modules, 32/32/35/35 min | `session/machine.ts` `fullTestPlan` | Unit (plans), E2E (full test), Live |
| Module 2 routing (60% rule), labelled as an approximation | `bank/build.ts` `routeModule2`, `SessionView` header | Unit, E2E, Live |
| Single module, correct length and clock | `modulePlan` | E2E, Live |
| Blueprint domain counts and order, grid-ins last | `bank/build.ts` `buildModule` | Unit |
| Custom drill: section, domains, skills with counts, difficulty, count, time limit | `Menu.tsx` `CustomDrill`, `buildCustom` | Unit, E2E, Live |
| Check each answer as I go: verdict, explanation, locked answer | `machine.ts` `check`, `SessionView` | Unit, E2E, Live |
| Your mistakes drill | `store.ts` `startMistakes` | E2E |
| **Intended difference:** a mistake leaves only after correct answers on two different days (ModuleDrill: one correct answer) | `review/schedule.ts` | Unit |
| Exclude active questions, on by default, warning when turned off | `Menu.tsx` guard, `pool` | Unit, Live |
| Active flags refreshed when the index is over 7 days old | `store/idb.ts` `loadIndex` | Unit |
| Vocabulary drill: 12 items, a third new, Leitner box of 3 | `vocab/leitner.ts`, `Vocab.tsx` | Unit, E2E |
| Timer: hide/show, red under 5:00, starts once questions are on screen | `machine.ts` `tick`, `SessionView` | Unit, Live |
| Mark for Review, navigator grid | `SessionView` | E2E, Live |
| ABC answer eliminator | `SessionView` | Live |
| Check Your Work page before submitting | `ReviewPage` | E2E, Live |
| Grid-in: Bluebook characters, 5 or 6 chars, preview, truncated or rounded repeating values | `score/check.ts` | Unit, E2E, Live |
| Reference sheet | `SessionView` `Reference` | Live |
| Desmos calculator: loads on open, draggable, resizable, position remembered, offline message | `Calculator.tsx` | Live (load, panel); drag and offline message not exercised |
| Highlighter: select to highlight, click to remove, survives navigation and resume, skips MathML | `ui/highlight.ts` | Live (highlight, navigation, reload and resume) |
| Keyboard: A to D, arrows, M, Ctrl+H | `SessionView` `Keys` | E2E, Live |
| Results: score, accuracy, domain/skill/difficulty tables, every miss with explanation | `Results.tsx`, `stats/summary.ts` | Unit, E2E, Live |
| Pacing: budget per question, right vs wrong average, over twice the budget | `summarise` | Unit, Live |
| Drill these misses again | `startRetry` | E2E |
| Progress by domain from 2 sessions | `domainProgress`, `Menu.tsx` | Unit |
| Backup and restore | `store/backup.ts`, `ui/data.ts` | Unit, E2E |
| Cache every question for offline use | `ui/data.ts` `cacheAll` | Not exercised end to end |
| Local bundle fallback when the API is down | `api/bundle.ts`, boot error screen | Unit (parsing), E2E (fallback screen shown) |
| Resume after reload, clock paused while away | `session/resume.ts` | Unit, E2E, Live |
| No 200 to 800 score | `Results.tsx` note | Live |

New in release 1: phone layout, dark mode, ModuleDrill backup import (Unit).
