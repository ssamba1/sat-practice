import type { Section } from '../api/questions';

export interface ReviewItem { sec: Section; stage: 0 | 1 | 2 | 3; due: number; okDays: string[]; misses: number; lastMiss: number }
