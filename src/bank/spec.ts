import type { Diff, Section } from '../api/questions';

// Real test structure, from ModuleDrill (index.html:611-633).
export const SPEC: Record<Section, { name: string; qs: number; mins: number; doms: Record<string, number>; spr?: Record<string, number>; order: string[] }> = {
  rw: { name: 'Reading and Writing', qs: 27, mins: 32, doms: { CAS: 7, INI: 6, SEC: 8, EOI: 6 }, order: ['CAS', 'INI', 'SEC', 'EOI'] },
  // about a quarter of a math module is grid-in, pinned per domain
  math: { name: 'Math', qs: 22, mins: 35, doms: { H: 7, P: 7, Q: 4, S: 4 }, spr: { H: 2, P: 2, Q: 1, S: 1 }, order: ['H', 'P', 'Q', 'S'] },
};
export const DOMNAME: Record<string, string> = {
  CAS: 'Craft and Structure', INI: 'Information and Ideas',
  SEC: 'Standard English Conventions', EOI: 'Expression of Ideas',
  H: 'Algebra', P: 'Advanced Math', Q: 'Problem-Solving and Data Analysis', S: 'Geometry and Trigonometry',
};
export type Mix = Record<Diff, number>;
export const MIX = {
  m1: { E: 0.38, M: 0.40, H: 0.22 },
  m2hard: { E: 0.06, M: 0.34, H: 0.60 },
  m2easy: { E: 0.60, M: 0.34, H: 0.06 },
} satisfies Record<string, Mix>;
// Within an rw domain the real test runs through skills in a fixed order. SEC is
// absent on purpose: its two skills appear interleaved, so it sorts by difficulty.
export const SKILL_ORDER: Record<string, string[]> = {
  CAS: ['words in context', 'text structure and purpose', 'cross-text connections'],
  INI: ['central ideas and details', 'command of evidence', 'inferences'],
  EOI: ['transitions', 'rhetorical synthesis'],
};
