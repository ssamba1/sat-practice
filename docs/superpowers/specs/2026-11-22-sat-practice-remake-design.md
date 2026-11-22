# SAT practice app: a remake of ModuleDrill (design)

Working name: **[TBD]** (see Open questions). Date: 2026-11-22.

## Intent

Build a free digital-SAT practice app that students would choose over ModuleDrill
(https://moduledrill.com, MIT licensed, Martin Svitek). "Better in every aspect": it must
match everything ModuleDrill does, then beat it where ModuleDrill is thin.

Why the trainer matters most: College Board already offers official full-length practice
tests in Bluebook (https://bluebook.collegeboard.org/students/practice), and anyone can call
the same question bank ModuleDrill uses. Neither the test nor the questions are a moat. What a
student does with 3,000+ questions is. So the app is built around a trainer that knows the
student's weak skills and pacing and decides what to practise next, with a faithful test-day
mode on top.

## Goals

1. **Parity with ModuleDrill** (every item in its README "What you get", "Bluebook behaviour",
   "Results" sections): full-length test, single module, custom drill, mistakes drill,
   check-as-you-go, vocabulary drill, blueprint-correct modules, exclude-active-questions on by
   default, timer rules, mark for review, navigator, answer eliminator, Check Your Work page,
   grid-in rules, reference sheet, embedded Desmos, highlighter, keyboard shortcuts, per-question
   timing and pacing, domain/skill/difficulty breakdowns, retry misses, progress by domain,
   backup and restore, offline cache, local-bundle fallback, resume after reload.
2. **The trainer** (the reason to switch):
   - **Skill map.** Every one of the bank's skills gets a mastery level from the student's own
     answers: recency-weighted accuracy, weighted by difficulty, shown with how many answers it
     rests on. Average time per skill against the budget. No made-up precision: a skill with
     fewer than 5 answers shows "not enough data".
   - **Today.** One button builds a session of a chosen length (10/20/40 min) from: misses due
     for review, the weakest skills with enough retired questions, and a small share of strong
     skills so they do not decay.
   - **Spaced review of misses.** A missed question comes back after 1, 3, 7, then 21 days. It
     leaves the list only after being answered correctly on two different days. (ModuleDrill
     drops it after one correct answer.)
   - **Why did I miss it.** On a wrong answer in results, one tap tags it: concept, careless,
     misread, ran out of time, guessed. Results and the skill map show the split, because
     "careless" and "concept" need different fixes.
   - **Pacing coach.** Flags skills where the student is right but slow, and questions they
     spent more than 2x the budget on and still missed.
   - **Goal and test date.** Optional. Shows days left and what Today has covered this week.
3. **Test-day mode closer to Bluebook**: everything in ModuleDrill, plus highlight notes
   (Bluebook's Highlights & Notes has notes, ModuleDrill does not), text zoom, and line reader
   if Bluebook has one (builder to verify on bluebook.collegeboard.org/students/tools before
   building it).
4. **Better everywhere else**: installable (PWA) and fully offline after the cache is
   filled; works on phones as a first-class layout, not a squeezed desktop; dark mode;
   accessible (keyboard only, screen reader labels, visible focus, WCAG AA contrast); fast
   first load (target under 150 KB of JS gzipped, excluding Desmos).
5. **Switching is free**: imports a ModuleDrill backup file
   (`{moduledrill: 1, at, data: {"satsim.<key>": "<json>"}}`, keys history, missed, seen,
   vocab, noActive, tutor, calc, session) so a student's history, mistakes and vocab progress
   come with them.

## Non-goals

- No accounts, no server, no sync (decided). Backup files cover moving devices.
- No hosting of College Board content. The browser fetches from College Board and caches
  locally, same as ModuleDrill. Any downloaded bundle stays out of the repo.
- No new questions written by us or by AI.
- No social features or leaderboards.

## Anti-goals (would make it a failure even if it works)

- **An invented 200 to 800 score.** The bank is not equated or adaptive. ModuleDrill refuses
  to show one for that reason and is right. We show skill-level evidence instead, and any
  "readiness" wording must not look like a score.
- Spoiling real tests: active questions excluded by default, warning to turn it off, flags
  refreshed weekly.
- Anything that sends a student's data off the device (analytics beyond cookieless page
  counts, if any; see Open questions).
- Being heavier or slower than ModuleDrill on a cheap phone.
- Breaking test-day faithfulness for the sake of trainer features: in full-test and module
  mode there is no checking, no hints, no tags until the module is submitted.

## Constraints

- The College Board question bank API is undocumented
  (base `https://qbank-api.collegeboard.org/msreportingquestionbank-prod`, endpoints
  `questionbank/digital/get-questions`, `questionbank/digital/get-question`,
  `questionbank/lookup`, as used in ModuleDrill `index.html`). It can change without notice.
  Keep ModuleDrill's mitigations: aggressive IndexedDB cache, fetch at most one module at a
  time, and a local bundle fallback built by a script.
- Known API quirks carried over from ModuleDrill: question type (multiple choice vs grid-in)
  is not in the metadata, so ship the grid-in id list (`gridins.js`) as a seed; content uses
  MathML `<mfenced>`, which must be rewritten to `<mo>` delimiters; items whose math is images
  are skipped.
- ModuleDrill code and `vocab.js` are MIT licensed and may be reused with the copyright notice
  kept and credit in the README.
- Desmos is a third-party frame (`https://www.desmos.com/testing/collegeboard/graphing`), the
  only part that needs a connection.
- Not affiliated with College Board; trademarks noted in README and footer.

## Approaches considered

1. **Proper app, no backend (picked by Sri).** Vite + TypeScript, modular source, automated
   tests, static hosting, all data in the browser. Picked because the single file is already
   about 2,400 lines and "better in every aspect" needs room and tests.
2. Single file again, written cleaner. No build step, but hits the same wall.
3. Accounts and a server. Sync and leaderboards, but hosting cost, minors' privacy duties,
   and nothing that makes drilling better on day one.

## How it is built (decided and proposed)

- **Stack** (my call, from approach 1): Vite, TypeScript strict, Preact for UI (about 4 KB,
  keeps 15+ screens manageable), Vitest for unit tests, Playwright for a few end-to-end flows.
  Hand-written service worker rather than a PWA plugin. Small hand-written IndexedDB wrapper.
  No CSS framework.
- **Hosting** (my call): GitHub Pages from a new public repo under Sri's account. The domain
  is an open question.
- **Modules** (proposed layout):
  - `api/` fetch, retry, pooling, MathML fix, normalise (ported from ModuleDrill)
  - `store/` IndexedDB question cache, versioned local state with migrations, backup/restore,
    ModuleDrill import
  - `bank/` index, active flags, pools, blueprint module builder, custom and Today builders
  - `trainer/` mastery model, review scheduler, error tags, pacing analysis (pure functions,
    heavily unit tested)
  - `session/` session state machine (module, break, review, results), timer, resume
  - `ui/` screens and test-day components (question, navigator, review page, calculator panel,
    reference sheet, highlighter and notes)
- **State**: one versioned schema with explicit migrations from day one, so later releases do
  not lose history. Every stored answer keeps question id, skill, domain, difficulty, response,
  correct, ms, mode, timestamp, and error tag. The trainer derives everything from that log.

## Release order (proposed)

Each release is usable on its own; nothing ships publicly until release 1 has full parity.

1. **Parity**: engine, every ModuleDrill feature listed in Goal 1, phone layout, dark mode,
   ModuleDrill import. Gate: a side-by-side checklist against moduledrill.com passes.
2. **Trainer**: skill map, Today, spaced review, error tags, pacing coach, goal and date.
3. **Polish**: highlight notes, zoom, PWA install and full offline, accessibility audit,
   performance budget check.

## Calls made after the builder check (Claude's, for Sri to check)

- **One mistakes list, not two.** "Your mistakes" is the spaced-review list. This is a
  deliberate change from ModuleDrill's rule (one correct answer clears it,
  `moduledrill/index.html:681-682`) and is listed as an intended difference on the parity
  checklist.
- **Every answer counts.** Answers from full tests, modules, drills and Today all feed the
  answer log, mastery, and the "two different days" rule. Only the test-day UI rules differ by
  mode.
- **What a ModuleDrill import brings.** ModuleDrill stores only per-session totals in
  `history` (date string, correct/total, per-domain tallies, last 40 sessions,
  `index.html:1803-1811`) and `[section, timesMissed, lastMissedAt]` per missed id
  (`index.html:674`). So the import brings: missed ids into spaced review, due now; `seen` ids
  so new sessions still prefer unseen questions; vocab progress; settings. Old sessions are
  kept as a read-only "From ModuleDrill" record shown in history, and the trainer ignores them.
  The import screen says plainly that the skill map starts fresh because ModuleDrill did not
  record per-question detail.
- **Today is sized, not cut off.** The chosen minutes set the question count from per-question
  budgets. A clock runs and is shown, but the session ends when the questions do, not when
  time does. Check-as-you-go is on by default in Today and can be turned off. The pacing coach
  uses timed modes and Today alike, and marks per-skill timing from untimed answers as less
  reliable.

## Left to the builder

Exact mastery formula and weights (must be explainable in one sentence in the UI), visual
design, copy, the Module 2 routing rule (start from ModuleDrill's: 60% or more on Module 1
routes to the harder set, labelled as an approximation), test structure, file names.

## Open questions (Sri's)

- Name, and whether to buy a domain.
- Analytics: none, or cookieless page counts like ModuleDrill's Cloudflare Web Analytics.
- Whether to tell Svitek0 about the remake (courtesy, not a licence requirement).
