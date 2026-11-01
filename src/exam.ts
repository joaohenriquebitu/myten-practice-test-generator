import type {
  AnswerRecord,
  ExamQuestion,
  ExamSettings,
  FileConfig,
  FileResult,
  LoadedQuestion,
  QuizResults,
} from "./types";

export function defaultFileConfig(
  sourceFile: string,
  availableCount: number,
): FileConfig {
  return {
    sourceFile,
    availableCount,
    questionCount: availableCount,
    correctPoints: 1,
    wrongPoints: 0,
  };
}

export function defaultSettings(questions: LoadedQuestion[]): ExamSettings {
  const counts = new Map<string, number>();

  for (const question of questions) {
    counts.set(question.sourceFile, (counts.get(question.sourceFile) ?? 0) + 1);
  }

  return {
    allowSkip: false,
    revealAnswersAtEnd: false,
    files: [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceFile, availableCount]) =>
        defaultFileConfig(sourceFile, availableCount),
      ),
  };
}

function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  const limit = Math.min(Math.max(0, count), pool.length);

  for (let index = 0; index < limit; index += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(randomIndex, 1)[0]);
  }

  return chosen;
}

export function plannedQuestionCount(settings: ExamSettings): number {
  return settings.files.reduce(
    (sum, file) => sum + Math.min(file.questionCount, file.availableCount),
    0,
  );
}

export function plannedMaxScore(settings: ExamSettings): number {
  return settings.files.reduce(
    (sum, file) =>
      sum +
      Math.min(file.questionCount, file.availableCount) * file.correctPoints,
    0,
  );
}

export function buildExam(
  questions: LoadedQuestion[],
  settings: ExamSettings,
): ExamQuestion[] {
  const exam: ExamQuestion[] = [];

  for (const file of settings.files) {
    const fromFile = questions.filter(
      (question) => question.sourceFile === file.sourceFile,
    );
    const drawn = pickRandom(fromFile, file.questionCount);

    for (const question of drawn) {
      exam.push({
        ...question,
        correctPoints: file.correctPoints,
        wrongPoints: file.wrongPoints,
      });
    }
  }

  return pickRandom(exam, exam.length);
}

export function scoreAnswer(
  question: ExamQuestion,
  selected: string | null,
  skipped: boolean,
): AnswerRecord {
  if (skipped) {
    return {
      questionId: question.id,
      selected: null,
      status: "skipped",
      points: 0,
    };
  }

  const isCorrect = selected === question.correctAnswer;

  return {
    questionId: question.id,
    selected,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect ? question.correctPoints : question.wrongPoints,
  };
}

export function computeResults(
  questions: ExamQuestion[],
  answers: Record<string, AnswerRecord>,
): QuizResults {
  const records = questions.map((question) => answers[question.id]);
  const correct = records.filter((answer) => answer?.status === "correct").length;
  const incorrect = records.filter(
    (answer) => answer?.status === "incorrect",
  ).length;
  const skipped = records.filter((answer) => answer?.status === "skipped").length;
  const score = records.reduce((sum, answer) => sum + (answer?.points ?? 0), 0);
  const maxScore = questions.reduce(
    (sum, question) => sum + question.correctPoints,
    0,
  );
  const attempted = correct + incorrect;
  const accuracyPercent =
    attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

  const files = [...new Set(questions.map((question) => question.sourceFile))];
  const byFile: FileResult[] = files.map((sourceFile) => {
    const fileQuestions = questions.filter(
      (question) => question.sourceFile === sourceFile,
    );
    const fileRecords = fileQuestions.map((question) => answers[question.id]);

    return {
      sourceFile,
      total: fileQuestions.length,
      correct: fileRecords.filter((answer) => answer?.status === "correct")
        .length,
      incorrect: fileRecords.filter((answer) => answer?.status === "incorrect")
        .length,
      skipped: fileRecords.filter((answer) => answer?.status === "skipped")
        .length,
      score: fileRecords.reduce((sum, answer) => sum + (answer?.points ?? 0), 0),
      maxScore: fileQuestions.reduce(
        (sum, question) => sum + question.correctPoints,
        0,
      ),
    };
  });

  return {
    total: questions.length,
    correct,
    incorrect,
    skipped,
    score,
    maxScore,
    accuracyPercent,
    byFile,
  };
}
