# Release 2 (Trainer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The trainer from the spec's Goal 2: skill map, Today, error tags, pacing coach, goal and test date. (Spaced review of misses already shipped in release 1.)

**Architecture:** All trainer logic is pure functions in `src/trainer/` reading the answer log (`state.answers`) and the question index. UI adds a Today card and goal line to the menu, a Skill map screen, and tag chips plus a pacing note to results.

**Tech Stack:** as release 1 (Vite, TypeScript, Preact signals, Vitest, Playwright on Edge).

**Spec:** `docs/superpowers/specs/2026-11-22-sat-practice-remake-design.md` (Goal 2 and the "Calls made after the builder check" section).

## Global Constraints

- Every answer in every mode feeds the trainer; legacy ModuleDrill records are ignored by it.
- A skill with fewer than 5 answers shows "not enough data", never a number.
- The mastery formula must be explainable in one sentence in the UI.
- No 200 to 800 score and nothing that looks like one ("readiness" wording included).
- Test-day modes (full, module) never show tags, hints or correctness before submit.
- Today: minutes set the question count; the clock shows but never ends the session; check-as-you-go on by default and can be turned off.
- Pacing from untimed answers is marked less reliable.
- Release 1 global constraints still apply (no em dashes, commits as Sri, no College Board content in the repo).

## Review Focus

1. **A brand-new student (empty log)** opens Today and the skill map. Expect a sensible first session (spread across skills) and "not enough data" everywhere, no NaN. Tests in Tasks 2 and 3.
2. **A skill whose usable pool is empty** (exclude-active on, all used in this session). Expect Today to skip it and still fill the session from other skills. Test in Task 3.
3. **Answers from before release 2** (no `timed` field). Expect them treated as untimed, no crash. Test in Task 1.
4. **Tagging a question twice, or after a reload.** Expect the latest tag to stick to that one answer only. Test in Task 3.
5. **Today with fewer due reviews or weak skills than slots.** Expect top-up from other buckets, never duplicates. Test in Task 3.

---

### Task 1: Answer log additions and a soft clock

**Files:** `src/store/state.ts`, `src/session/machine.ts`, `src/ui/store.ts`; tests `tests/unit/session.test.ts`, `tests/unit/store.test.ts`.

**Interfaces:**
- `Answer` gains `timed?: boolean` (true when the stage had a clock). `SessionRecord` gains `mode?: Mode`, `ms?: number` (total time on questions). `Settings` gains `todayTutor: boolean` (default true) and `goal?: { testDate?: string }` (`YYYY-MM-DD`).
- `Stage` (module) gains `soft?: boolean`: the clock counts down and shows, but expiry does nothing. `drillPlan(qs, mins, label, soft = false)`.
- `finish` sets `timed` per answer from its stage `mins != null`, and `mode` and `ms` on the record.
- Tests: soft stage at 0 stays on view `q` and `remainingMs` stays 0; `finish` marks timed and untimed answers; `migrate` keeps an old answer without `timed`, defaults `todayTutor` to true, keeps a valid `goal.testDate` and drops a malformed one.

### Task 2: Skill mastery and pacing (`src/trainer/mastery.ts`, `src/trainer/pacing.ts`)

**Interfaces:**
- `HALF_LIFE_DAYS = 30`, `DIFF_WEIGHT = { E: 1, M: 1.5, H: 2 }`, `MIN_ANSWERS = 5`.
- `interface SkillStat { key: string; label: string; sec: Section; dom: string; n: number; mastery: number | null; avgMs: number | null; timedN: number; budgetMs: number; tags: Record<string, number>; available: number }`
- `skillStats(answers: Answer[], index: Index, noActive: boolean, now: number): SkillStat[]`: one entry per skill in the index (so untried skills appear), keyed by lowercased skill. Mastery = sum(w * ok) / sum(w) with w = 0.5^(ageDays / 30) * DIFF_WEIGHT[diff]; null when n < 5. `avgMs` from timed answers only (null when none); `budgetMs` = section minutes * 60000 / section questions (rw 32/27, math 35/22). `available` = usable pool size for the skill.
- `band(m: number | null): 'unknown' | 'weak' | 'shaky' | 'solid' | 'strong'` at 0.5 / 0.75 / 0.9.
- `rightButSlow(stats): SkillStat[]`: mastery >= 0.75, timedN >= 5, avgMs > 1.3 * budgetMs.
- `slowMisses(answers, now, days = 30): Answer[]`: wrong, timed, ms > 2 * budget for its section, within the window.
- Tests: recency halves weight at 30 days; a hard right counts more than an easy right; n < 5 gives null; untried skills present with n 0; untimed answers excluded from avgMs; empty log gives no NaN anywhere.

### Task 3: Today builder and tags (`src/trainer/today.ts`, `src/trainer/tags.ts`)

**Interfaces:**
- `SECS_PER_Q = 83` (mean of the two section budgets, 71 s and 95 s). `todayCount(mins) = max(3, round(mins * 60 / 83))`.
- `buildToday(index, state, mins, now, rng): { metas: Meta[]; parts: { review: number; weak: number; keep: number } }`. Slots: up to 40% due reviews (`dueItems`), then weak skills (~45%), then strong skills (~15%) for upkeep; any shortfall tops up from the next bucket, then from any usable question. Weak skills are ranked by mastery with unknown skills ranked as 0.5 so new students explore; take 2 or 3 questions per skill. Difficulty by band: weak E/M, shaky M, solid or strong M/H. Unseen first, no duplicates, skills with no usable questions skipped.
- `TAGS = ['concept', 'careless', 'misread', 'time', 'guessed'] as const`; `setTag(answers, at, ext, tag | null): Answer[]` (matches the one answer by `at` and `ext`); `tagSplit(answers): Record<Tag, number>`.
- Tests: new student gets `todayCount(20)` questions across several skills; due reviews come first and cap at 40%; a weak skill outranks a strong one; empty pool skill skipped; no duplicate ids; setTag twice keeps the second; setTag touches only the matching answer.

### Task 4: Trainer screens

**Files:** `src/ui/Menu.tsx` (Today card, goal line), `src/ui/SkillMap.tsx` (new), `src/ui/Results.tsx` (tag chips, pacing coach), `src/ui/store.ts` (`startToday`, `tagAnswer`), `src/ui/App.tsx` (screen `skills`).

- Menu: "Today" card at the top with 10 / 20 / 40 minute buttons, the split it will use, and a check-as-you-go toggle; goal line with an optional test date input showing days left and Today sessions and minutes this week (Monday start).
- Skill map: per section and domain, each skill with a band, mastery %, "n answers", avg time vs budget (with "untimed only" when timedN is 0), its tag split, and "Drill this skill". The one-sentence formula shown at the top. A pacing coach box listing right-but-slow skills and recent slow misses.
- Results: on each missed question in non test-day modes and after submit in test-day modes, five tag chips (`aria-pressed`). A "Why you missed" split once any are tagged.
- Browser check of every screen live, at 375 px and 1280 px, light and dark.

### Task 5: Browser tests, review, ship

- `tests/e2e/trainer.spec.ts`: Today 10 min builds and runs untimed-to-cutoff with check-as-you-go; tag a miss in results and see it in the skill map; skill map shows "not enough data" for a new student; goal date shows days left.
- Full unit and e2e suites green; final fresh review; fix Critical and Important with RED then GREEN tests; merge to main and push (deploys).
