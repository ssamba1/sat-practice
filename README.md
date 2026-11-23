# SAT Practice (working name)

Digital SAT practice built on College Board's own question bank, with a trainer that
learns which skills you miss and plans what to practise next.

This is a remake of [ModuleDrill](https://github.com/Svitek0/moduledrill) by Martin Svítek
(MIT licensed). Parts of its code and its vocabulary list are reused here with thanks.

Not affiliated with, endorsed by, or connected to College Board. SAT and Bluebook are
registered trademarks of College Board.

## Privacy

Everything you do stays in your own browser (IndexedDB and localStorage). There are no
accounts and no server. Questions are requested by your browser from College Board directly.

## Questions are not hosted here

The app ships no question content. Your browser fetches questions from College Board's
public question bank API and caches them locally. `questions.js` bundles made with
`scripts/refresh_questions.py` are gitignored on purpose and must never be committed.

## Running it

```bash
npm install
npm run dev
```

`npm test` runs the unit tests. `npm run e2e` runs the browser tests in Microsoft Edge
(`channel: 'msedge'` in `playwright.config.ts`) against synthetic questions, so they never touch
College Board.

## If the API goes away

`python3 scripts/refresh_questions.py questions.js` downloads the whole bank into a bundle the
error screen can load. Never commit it. (The script also writes a `gridins.js` next to itself;
the app reads `src/data/gridins.ts` instead.)

## What release 1 covers

Everything ModuleDrill does (see `docs/parity-checklist.md`), plus a phone layout, dark mode and
ModuleDrill backup import. One intended difference: a missed question leaves the mistakes list
only after you answer it correctly on two different days.

Known limits: Module 2 routing is an approximation (60% or more on Module 1 routes to the harder
set). Highlighting uses mouse selection, so it does not yet work with touch selection on phones.
The calculator is Desmos's site and needs a connection.
