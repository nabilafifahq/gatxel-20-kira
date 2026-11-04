export const FEATURE_KEYS = ['math','english','science','olympiad-math','olympiad-english','olympiad-science','drill-math','mental-math','quiz-arena','vocab','flashcards','reading-room','english-skills','paper','kira-world','placement','dictionary','manipulatives'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]
