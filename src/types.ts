export type Question = {
  statement: string;
  alternatives: string[];
  correctAnswer: string;
};

export type LoadedQuestion = Question & {
  id: string;
  sourceFile: string;
};

export type FileConfig = {
  sourceFile: string;
  availableCount: number;
  questionCount: number;
  correctPoints: number;
  wrongPoints: number;
};

export type ExamSettings = {
  files: FileConfig[];
  allowSkip: boolean;
  revealAnswersAtEnd: boolean;
};

export type ExamQuestion = LoadedQuestion & {
  correctPoints: number;
  wrongPoints: number;
};

export type AnswerStatus = "correct" | "incorrect" | "skipped";

export type AnswerRecord = {
  questionId: string;
  selected: string | null;
  status: AnswerStatus;
  points: number;
};

export type FileResult = {
  sourceFile: string;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  maxScore: number;
};

export type QuizResults = {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  maxScore: number;
  accuracyPercent: number;
  byFile: FileResult[];
};
