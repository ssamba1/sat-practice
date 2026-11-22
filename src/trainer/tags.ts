import type { Answer } from '../store/state';

export const TAGS = ['concept', 'careless', 'misread', 'time', 'guessed'] as const;
export type Tag = typeof TAGS[number];
export const TAG_LABEL: Record<Tag, string> = {
  concept: "Didn't know how", careless: 'Careless slip', misread: 'Misread it', time: 'Ran out of time', guessed: 'Guessed',
};

/** Tag (or untag, with null) the one answer given at `at` to question `ext`. */
export const setTag = (answers: Answer[], at: number, ext: string, tag: Tag | null): Answer[] =>
  answers.map(a => {
    if (a.at !== at || a.ext !== ext) return a;
    const { tag: _old, ...rest } = a;
    return tag ? { ...rest, tag } : rest;
  });

export const tagSplit = (answers: Answer[]): Record<Tag, number> => {
  const out = Object.fromEntries(TAGS.map(t => [t, 0])) as Record<Tag, number>;
  for (const a of answers) if (a.tag && a.tag in out) out[a.tag as Tag]++;
  return out;
};
