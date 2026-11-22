# Release 1 (Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new static web app that does everything ModuleDrill does, plus a real phone layout, dark mode and ModuleDrill backup import, on a codebase built to take the trainer (release 2) and polish (release 3).

**Architecture:** Vite + TypeScript + Preact single-page app, no server. Pure logic (`api`, `bank`, `score`, `review`, `session`, `store/migrate`) is framework-free and unit tested; `ui/` renders state. Questions are fetched by the browser from College Board and cached in IndexedDB; everything the student does is appended to one answer log in a versioned local state.

**Tech Stack:** Vite 5, TypeScript (strict), Preact 10 + @preact/signals, Vitest + fake-indexeddb + happy-dom, Playwright (chromium only).

**Spec:** `docs/superpowers/specs/2026-11-22-sat-practice-remake-design.md`. Reference implementation for every ported behaviour: `../moduledrill/index.html` (MIT, Martin Svitek), cited below by line.

Releases 2 (trainer) and 3 (polish) get their own plans after this one ships.

## Global Constraints

- No server, no accounts. All student data stays in the browser.
- Never commit College Board content. `questions.js` bundles stay gitignored.
- Active questions excluded by default; turning it off shows a warning; active flags refetched when the index is older than 7 days.
- No 200 to 800 score anywhere, in any wording.
- Test-day modes (full test, single module) never show correctness, hints or tags before the module is submitted.
- JS shipped gzipped under 150 KB, excluding Desmos.
- WCAG AA contrast in light and dark; every control reachable by keyboard with visible focus.
- MIT licence keeps Martin Svitek's copyright line alongside the new one; README credits ModuleDrill.
- No em dashes in code, copy, comments or commits.
- Commits are plain `git commit` with the machine's global identity; no Co-Authored-By trailer.

## Review Focus

1. **College Board unreachable on first visit (no cache).** Expect a clear error screen offering the local bundle picker, not a blank page. Test in Task 3 and Task 12.
2. **Storage full or blocked (private mode, quota).** Expect the session to keep running in memory and a one-line warning; results still shown. Test in Task 3.
3. **Tab closed mid-module, reopened after the clock would have run out.** Expect the clock paused (remaining time stored, not a deadline) and the resume card stating the gap. Test in Task 6.
4. **Pool smaller than the blueprint** (exclude-active on, narrow custom skill, or many seen). Expect top-up from other tiers, then a shorter module with a notice, never a crash or duplicate. Test in Task 4.
5. **Corrupt or foreign local state** (hand-edited, older ModuleDrill keys, half-written JSON). Expect defaults for that key only, other keys untouched. Test in Task 3.

---

## File Structure

```
remake/
  index.html                  app shell
  vite.config.ts, tsconfig.json, package.json, playwright.config.ts
  LICENSE, README.md, .gitignore (questions.js, dist, node_modules)
  scripts/refresh_questions.py   ported from ModuleDrill, same output format
  .github/workflows/pages.yml
  src/
    main.tsx                  mounts <App/>
    data/gridins.ts           export const GRIDINS: string[]   (converted from gridins.js)
    data/vocab.ts             export const VOCAB: {v:number, groups:{w:string[], d:string[]}[]}
    api/http.ts               req, pooled
    api/mathml.ts             fixMathML
    api/questions.ts          fetchIndex, normalise, hydrate, types
    store/idb.ts              Idb (meta, body stores)
    store/state.ts            AppState, load/save, migrate
    store/backup.ts           exportBackup, importBackup, importModuleDrill
    bank/spec.ts              SPEC, DOMNAME, MIX, SKILL_ORDER
    bank/build.ts             pool, draw, buildModule, buildCustom, skillsByDomain
    score/check.ts            numify, isCorrect, cleanGridIn
    review/schedule.ts        spaced review of misses
    session/machine.ts        Session type and transitions
    session/timer.ts          credit, clock
    session/resume.ts         snapshot/restore
    vocab/leitner.ts          build, record, progress
    ui/...                    screens and components (Tasks 8 to 11)
  tests/unit/*.test.ts, tests/e2e/*.spec.ts, tests/fixtures/ (synthetic questions only)
```

Fixtures are synthetic questions written for the tests (fake stems, fake ids), never real College Board items.

---

### Task 1: Scaffold, data modules, licence

**Files:** Create everything at the repo root listed above except `src/**` logic; `src/data/gridins.ts`, `src/data/vocab.ts`; `tests/unit/data.test.ts`.

**Interfaces:**
- Produces: `GRIDINS: string[]`, `VOCAB` (shape above). `npm run dev | build | test | e2e`.

- [ ] Step 1: `git init`, `npm create vite@5` (preact-ts), add vitest, happy-dom, fake-indexeddb, @playwright/test, @preact/signals. Strict tsconfig.
- [ ] Step 2: Convert `../moduledrill/gridins.js` and `vocab.js` to TS modules with a one-off node script (not committed); the `window.X=` prefix becomes `export const X =`.
- [ ] Step 3: Test `data.test.ts`: `GRIDINS.length` equals the count in the source file; every `VOCAB.groups[i].w.length === groups[i].d.length === 4`; group count 83 and distinct word count 322 (ModuleDrill README figures; if the files disagree, assert the file's numbers and note it in README).
- [ ] Step 4: `npm test` passes; `npm run build` produces `dist/`.
- [ ] Step 5: LICENSE (MIT, both copyright lines), README stub (credit, not-affiliated notice, trademarks, privacy line, run instructions), `.gitignore`.
- [ ] Step 6: Commit `chore: scaffold app and import grid-in ids and vocab data`.

### Task 2: API client and MathML repair

**Files:** `src/api/http.ts`, `src/api/mathml.ts`, `src/api/questions.ts`; tests `tests/unit/api.test.ts`, `tests/unit/mathml.test.ts`.

**Interfaces:**
- Produces:
  - `API = { LIST, ITEM, LOOKUP }` (URLs verbatim from `moduledrill/index.html:378-382`), `SECREQ` (lines 383-386).
  - `req<T>(url: string, body?: object, tries = 3): Promise<T>`; backoff `400 * (attempt+1)` ms.
  - `pooled<I,O>(items: I[], width: number, fn: (i: I) => Promise<O>, onProgress?: (done: number, total: number) => void): Promise<O[]>`.
  - `fixMathML(html: string): string`.
  - `type Section = 'rw' | 'math'`; `type Diff = 'E'|'M'|'H'`;
    `interface Meta { id: string; ext: string; dom: string; domName: string; skill: string; diff: Diff; live: 0|1; type: 'mcq'|'spr' }`;
    `interface Body { v: number; type: 'mcq'|'spr'; sti: string; stem: string; opts: string[]; ans: string[]; rat: string }`;
    `type Question = Meta & Body`.
  - `fetchIndex(): Promise<Record<Section, Meta[]>>`, `normalise(raw: any): Body` (BODY_SCHEMA = 2), `hydrate(entries: Meta[], idb: Idb, onProgress?): Promise<Question[]>` (port of lines 577-608 including type-drift correction).

- [ ] Step 1: Tests. `fixMathML`: `<mfenced><mi>x</mi></mfenced>` becomes `<mrow><mo>(</mo><mi>x</mi><mo>)</mo></mrow>`; `open="[" close="]"`; two children get a `,` separator; nested mfenced fully expanded; HTML without `<mfenced` returned identical (same string). `req`: mocked fetch failing twice then succeeding returns the value and called 3 times; failing 3 times rejects. `pooled`: never more than `width` in flight; output order matches input. `fetchIndex` with mocked responses maps fields as in lines 488-499 and sets `live` from the lookup list and `type` from `GRIDINS`.
- [ ] Step 2: Run, see failures.
- [ ] Step 3: Implement by porting lines 389-417, 482-502, 528-608.
- [ ] Step 4: Tests pass.
- [ ] Step 5: Commit `feat: College Board client with MathML repair`.

### Task 3: Storage and versioned state

**Files:** `src/store/idb.ts`, `src/store/state.ts`; test `tests/unit/store.test.ts`.

**Interfaces:**
- Produces:
  - `Idb` with `get, put, getMany, putMany, count, clear` over stores `meta` and `body` (DB name `sat-remake`, version 1). Every write resolves even on error (port note at line 442).
  - `loadIndex(idb, onMsg?): Promise<{ index: Record<Section, Meta[]>; from: 'cache'|'network'|'stale' }>`; TTL 7 days.
  - ```ts
    interface Answer { qid: string; ext: string; sec: Section; dom: string; skill: string; diff: Diff;
      resp: number | string | null; ok: boolean; ms: number;
      mode: 'full'|'module'|'custom'|'mistakes'|'retry'|'today'; at: number; tag?: string }
    interface SessionRecord { id: string; at: number; label: string; correct: number; total: number;
      doms: Record<string, [number, number]>; legacy?: true }
    interface AppState { v: 1; answers: Answer[]; sessions: SessionRecord[]; seen: string[];
      review: Record<string, ReviewItem>; vocab: Record<string, [number, number]>;
      settings: { noActive: boolean; tutor: boolean; theme: 'system'|'light'|'dark'; calc?: CalcPos } }
    ```
  - `loadState(): AppState`, `saveState(s: AppState): { ok: boolean }`, `migrate(raw: unknown): AppState`. Stored under localStorage key `sat-remake.state`. `ReviewItem` comes from Task 5; `CalcPos = {x:number;y:number;w:number;h:number}`.

- [ ] Step 1: Tests: index cache hit inside TTL makes no fetch; expired cache refetches; network failure with cache returns `from: 'stale'`; failure without cache throws. `migrate` of `null`, `"garbage"`, `{v: 99}` returns defaults; a state with a corrupt `review` field keeps valid `answers`. `saveState` when `localStorage.setItem` throws returns `{ok:false}` and does not throw (Review Focus 2).
- [ ] Step 2: Run, fail. Step 3: Implement. Step 4: Pass.
- [ ] Step 5: Commit `feat: IndexedDB cache and versioned app state`.

### Task 4: Module and drill builders

**Files:** `src/bank/spec.ts`, `src/bank/build.ts`; test `tests/unit/build.test.ts`.

**Interfaces:**
- Consumes: `Meta`, `Section`, `Diff`.
- Produces:
  - `SPEC`, `DOMNAME`, `MIX`, `SKILL_ORDER` verbatim from lines 611-633 and 733-740.
  - `pool(index, sec, noActive): Meta[]`
  - `draw(pool: Meta[], n: number, mix: Record<Diff, number>, seen: Set<string>, rng: () => number): Meta[]`
  - `buildModule(index, sec, mix, opts: { noActive: boolean; seen: Set<string>; rng?: () => number }): { qs: Meta[]; short: boolean }`
  - `buildCustom(index, sec, doms: string[], diffs: Diff[], n: number, skills: string[], opts): Meta[]`
  - `skillsByDomain(index, sec, doms, noActive): Record<string, [string, { label: string; n: number }][]>`
  - `routeModule2(m1Correct: number, m1Total: number): 'm2hard'|'m2easy'` (hard when `m1Correct / m1Total >= 0.6`).
  - Builders do not mutate `seen`; callers add ids when a session starts.

- [ ] Step 1: Tests on a synthetic index of 400 rw and 400 math metas with a seeded rng: rw module has 27 questions with domain counts `{CAS:7, INI:6, SEC:8, EOI:6}` in order CAS, INI, SEC, EOI, skills in `SKILL_ORDER` within domain; math has 22 with `{H:7,P:7,Q:4,S:4}`, exactly 6 spr, all spr last; no duplicate ids; unseen preferred (with 10 seen ids in pool, none chosen while unseen remain); `noActive` excludes `live:1`. Small pool (Review Focus 4): an rw pool with only 3 SEC items yields `short: true`, no duplicates, no throw. Skill keys are lowercased so "Cross-Text Connections" and "Cross-text Connections" merge. `routeModule2(16,27)` is `m2easy`, `routeModule2(17,27)` is `m2hard` (17/27 = 0.63).
- [ ] Step 2: Fail. Step 3: Port lines 720-832, injecting `seen` and `rng`. Step 4: Pass.
- [ ] Step 5: Commit `feat: blueprint module and custom drill builders`.

### Task 5: Scoring and spaced review of misses

**Files:** `src/score/check.ts`, `src/review/schedule.ts`; tests `tests/unit/check.test.ts`, `tests/unit/review.test.ts`.

**Interfaces:**
- Produces:
  - `numify(s: string): number`, `isCorrect(q: Pick<Question,'type'|'ans'>, resp: number|string|null): boolean` (port lines 837-868).
  - `cleanGridIn(raw: string): string`: keep `[0-9./-]`, minus only first, cap 5 chars or 6 when starting with `-` (port line 1609-1610).
  - `interface ReviewItem { sec: Section; stage: 0|1|2|3; due: number; okDays: string[]; misses: number; lastMiss: number }`
  - `INTERVALS_DAYS = [1, 3, 7, 21]`
  - `applyAnswers(review: Record<string, ReviewItem>, answers: Answer[], now: number): { review; added: number; cleared: number }`. Rules: a miss creates or resets the item to stage 0, due `now + 1 day`, clears `okDays`. A correct answer on an item adds the local date (`YYYY-MM-DD`) to `okDays` if new and advances stage, due `now + INTERVALS_DAYS[stage]`. Item is deleted when `okDays.length >= 2`.
  - `dueItems(review, now): string[]` (ext ids, most overdue first).
- [ ] Step 1: Tests. `isCorrect` spr: `"3/4"` vs ans `["0.75"]` true; `"0.666"` and `"0.667"` vs `["2/3"]` true; `"0.67"` false (too few digits); `"-.5"` vs `["-1/2"]` true; `"1/0"` false; empty false; mcq `1` vs `["B"]` true; missing `ans` false. `cleanGridIn("3 1/2")` is `"31/2"`, `"50%"` is `"50"`, `"1-2"` is `"12"`, `"-123456"` is `"-12345"`, `"1234567"` is `"12345"`. Review: miss then correct same day then correct same day keeps the item (one date); correct on two dates removes it; a miss after one ok day resets to stage 0.
- [ ] Step 2: Fail. Step 3: Implement. Step 4: Pass.
- [ ] Step 5: Commit `feat: answer checking and spaced review of misses`.

### Task 6: Session state machine, timer, resume

**Files:** `src/session/machine.ts`, `src/session/timer.ts`, `src/session/resume.ts`; test `tests/unit/session.test.ts`.

**Interfaces:**
- Consumes: Tasks 2 to 5.
- Produces:
  - `type Stage = { kind: 'module'; sec: Section; label: string; mins: number; route?: 'm1'|'m2hard'|'m2easy'; qs: Question[] | null } | { kind: 'break'; mins: 10 }`
  - `interface Session { mode: Answer['mode']; tutor: boolean; stages: Stage[]; stage: number; idx: number;
    view: 'q'|'review'|'break'|'results'; resp: (number|string|null)[][]; marked: boolean[][]; struck: number[][][];
    hl: ({ sti: string|null; stem: string|null } | null)[][]; checked: boolean[][]; time: number[][];
    remainingMs: number; on: [number, number, number] | null }`
  - Plans: `fullTestPlan()`: rw m1 32 min, rw m2 32, break 10, math m1 35, math m2 35. `modulePlan(sec)`, `drillPlan(mode, qs, mins|null)`.
  - Transitions (pure, return new Session): `answer`, `toggleMark`, `strike`, `goTo`, `toReview`, `submitModule` (routes m2 via `routeModule2` and builds it lazily), `tick(now)` (credits time to the current question while `view==='q'`, port of `credit` line 1080; on expiry moves `q` to `review` once and `break` to next stage once), `finish(now): { answers: Answer[]; record: SessionRecord }`.
  - `snapshot(s): string` stores ids not bodies and `remainingMs` not a deadline; `restore(json, hydrateFn): Promise<Session|null>`; reject snapshots older than 7 days or wrong schema.
- [ ] Step 1: Tests: full plan has 5 stages, 98 questions after both m2 builds; `tick` charges ms only to the active question; expiry fires once (calling `tick` again after expiry does not re-enter review, port note line 1094-1097); tutor `checked` blocks `answer` on that question; snapshot then restore after a simulated 3 hour gap keeps `remainingMs` unchanged (Review Focus 3); `finish` returns one `Answer` per question with `ms` and mode.
- [ ] Step 2: Fail. Step 3: Implement. Step 4: Pass.
- [ ] Step 5: Commit `feat: session state machine with paused-clock resume`.

### Task 7: Vocabulary Leitner drill logic

**Files:** `src/vocab/leitner.ts`; test `tests/unit/vocab.test.ts`.

**Interfaces:**
- Produces: `BOX_MAX = 3` (ModuleDrill line 1942), `buildVocab(state.vocab, n = 12, rng): VocabItem[]` with `VocabItem = { gi: number; wi: number; word: string; dir: 'w2d'|'d2w' }`, `recordVocab(vocab, word, ok, now)`, `vocabProgress(vocab): { total; seen; known }`. Port lines 1946-2013.
- [ ] Step 1: Tests: about a third new (`round(12/3) = 4`) when enough of both; one word per group per session; wrong answer resets box to 0; `BOX_MAX` correct answers marks known.
- [ ] Steps 2 to 4: fail, port, pass. Step 5: Commit `feat: vocabulary Leitner drill`.

### Task 8: App shell, menu, theme, phone layout

**Files:** `src/main.tsx`, `src/ui/App.tsx`, `src/ui/Menu.tsx`, `src/ui/theme.css`, `src/ui/store.ts` (signals wrapping AppState and Session; saves state after each change).

**Interfaces:**
- Consumes: Tasks 2 to 7.
- Produces: `app` signal store with `startSession(plan)`, `resume()`, `exit()`; screens switch on `session.view` or the menu.

- [ ] Step 1: Menu with: Full length, Single module (rw or math), Custom drill (section, domain chips, skill chips with counts from `skillsByDomain`, difficulty, count, time limit, check-as-you-go box), Your mistakes (count due now and total), Vocabulary, Resume card when a snapshot exists (shows the gap), exclude-active toggle with warning on turning off, Progress by domain (2+ sessions), backup buttons (Task 11), cache-for-offline (Task 12).
- [ ] Step 2: CSS custom properties with light and dark tokens; `prefers-color-scheme` plus a theme setting; layouts checked at 375 px and 1280 px with no horizontal scroll.
- [ ] Step 3: Boot: load state, `loadIndex`; on failure with no cache show the error screen (Review Focus 1, picker wired in Task 12); on storage failure show a one-line warning banner.
- [ ] Step 4: `npm run dev`, click through the menu at both widths in the browser; no console errors.
- [ ] Step 5: Commit `feat: app shell, menu and themes`.

### Task 9: Test-day question screen

**Files:** `src/ui/Question.tsx`, `src/ui/Navigator.tsx`, `src/ui/ReviewPage.tsx`, `src/ui/GridIn.tsx`, `src/ui/Highlighter.ts`, `src/ui/Calculator.tsx`, `src/ui/Reference.tsx`, `src/ui/Break.tsx`, `src/ui/keys.ts`.

**Interfaces:**
- Consumes: session transitions from Task 6, `cleanGridIn` and `isCorrect` from Task 5.

- [ ] Step 1: Question view: stimulus and stem as HTML (College Board markup, rendered as is), options, ABC eliminator, Mark for Review, countdown with hide/show turning red under 5:00 and starting only once questions are on screen, Back/Next, navigator grid, Check Your Work page before submit, break screen.
- [ ] Step 2: Grid-in field using `cleanGridIn` with "Answer preview" and the rules text from ModuleDrill line 1658-1659.
- [ ] Step 3: Highlighter (port lines 1665-1708: skips text inside `math` and existing marks, click a mark to remove, saved per question in `hl`), toggled by button and Ctrl+H.
- [ ] Step 4: Desmos panel from `https://www.desmos.com/testing/collegeboard/graphing`, loaded on first open, draggable and resizable, position saved in `settings.calc`, offline message when unreachable (port `Calc`, lines 2121-2262). Reference sheet (port lines 2263-2310).
- [ ] Step 5: Keys: A to D answer, arrows move, M marks, Ctrl+H highlighter; ignored while typing in the grid-in.
- [ ] Step 6: Check-as-you-go (tutor only): Check button enabled once answered, shows verdict and explanation, locks the answer.
- [ ] Step 7: Playwright `tests/e2e/module.spec.ts` with the API routed to synthetic fixtures: complete a math module using keyboard only, one grid-in, a mark, a highlight that survives Next and Back, submit through Check Your Work. Run `npm run e2e`, pass.
- [ ] Step 8: Commit `feat: test-day question screen`.

### Task 10: Results, history, retry

**Files:** `src/ui/Results.tsx`, `src/ui/Progress.tsx`, `src/stats/summary.ts`; test `tests/unit/summary.test.ts`.

**Interfaces:**
- Produces: `summarise(answers: Answer[], budgetMs: number | null): { correct; total; byDomain; bySkill; byDiff; avgMs; okAvgMs; wrongAvgMs; slow: string[] }` where `slow` is questions over `2 * budgetMs`. `domainProgress(sessions, last = 5)`.

- [ ] Step 1: Tests for `summarise` on a fixed answer list (counts, averages, slow list; `budgetMs` null gives empty `slow`). `domainProgress` ignores nothing: legacy records count toward domain progress since they carry `doms`.
- [ ] Step 2: Fail, implement, pass.
- [ ] Step 3: Results screen: raw score and accuracy, domain/skill/difficulty tables with avg time, pacing note, every missed question with the official explanation and its time, "Drill these N again", review-list change ("3 added, 1 cleared"). Append answers to `state.answers`, record to `state.sessions`, apply `applyAnswers`, add ids to `seen`.
- [ ] Step 4: Commit `feat: results, pacing and progress`.

### Task 11: Backup, restore, ModuleDrill import

**Files:** `src/store/backup.ts`; test `tests/unit/backup.test.ts`; menu buttons in `Menu.tsx`.

**Interfaces:**
- Produces: `exportBackup(state): Blob` as `{ app: 'sat-remake', v: 1, at: number, state: AppState }`; `importBackup(json: unknown): AppState | Error` (runs `migrate`; rejects anything without `app: 'sat-remake'` unless it is a ModuleDrill file); `importModuleDrill(json: unknown, now: number): { state: Partial<AppState>; report: string[] } | Error` for `{ moduledrill: 1, at, data: { 'satsim.<key>': '<json string>' } }`:
  - `satsim.missed` `{v:1, m: {ext: [sec01, times, lastAt]}}` becomes `review` items at stage 0, due `now`, `misses = times`.
  - `satsim.seen` (question ids) becomes `seen`.
  - `satsim.vocab` `{v, w: {word: [box, last]}}` becomes `vocab` unchanged.
  - `satsim.history` entries `{when, what, correct, total, doms}` become `SessionRecord` with `legacy: true`, `label = what`, `at = Date.parse(when) || now`.
  - `satsim.noActive`, `satsim.tutor` become settings. `session` and `calc` ignored.
  - Merges into existing state (union of `seen`, review items keep the later `lastMiss`), never replaces.
- [ ] Step 1: Tests: round trip export then import equals the state; a file with an unknown `app` is rejected and state untouched; a ModuleDrill fixture with every key imports as specified and `report` lists counts; a value that is not valid JSON inside `data` skips that key only (Review Focus 5).
- [ ] Step 2: Fail, implement, pass.
- [ ] Step 3: Import screen text says the skill map starts fresh because ModuleDrill did not keep per-question results; confirm before merging.
- [ ] Step 4: Commit `feat: backups and ModuleDrill import`.

### Task 12: Offline cache and local bundle fallback

**Files:** `src/api/bundle.ts`, `scripts/refresh_questions.py` (port, same output), menu and error-screen wiring; test `tests/unit/bundle.test.ts`.

**Interfaces:**
- Produces: `cacheAll(index, idb, onProgress)` (hydrates every usable question, width 6); `loadBundle(file: File): Promise<{ index; bodies }>` reading ModuleDrill's `questions.js` format; app switches back to the live API on the next boot when it is reachable.
- [ ] Step 1: Read `../moduledrill/index.html:2337` onward and `refresh_questions.py` output to pin the bundle format; write `bundle.test.ts` with a tiny synthetic bundle in that format.
- [ ] Step 2: Fail, implement, pass.
- [ ] Step 3: Commit `feat: offline cache and bundle fallback`.

### Task 13: Parity check, performance, deploy

**Files:** `tests/e2e/parity.spec.ts`, `docs/parity-checklist.md`, `.github/workflows/pages.yml`, README.

- [ ] Step 1: `docs/parity-checklist.md`: one line per item in the spec's Goal 1, each with where it lives and how it was checked. "Your mistakes" clearing rule listed as an intended difference.
- [ ] Step 2: `parity.spec.ts`: full test happy path (98 questions, break, m2 routing label shown), custom drill with tutor, mistakes drill, vocab session, resume after reload, backup export then import, at 375 px and 1280 px, light and dark.
- [ ] Step 3: `npm run build` and report gzipped JS size; must be under 150 KB.
- [ ] Step 4: Manual pass against the live College Board API in the browser: boot, build one rw and one math module, render MathML, finish, no console errors.
- [ ] Step 5: GitHub Pages workflow. Creating the GitHub repo and enabling Pages is outward facing: ask Sri before doing it.
- [ ] Step 6: Commit `chore: parity checklist, e2e suite and Pages deploy`.
