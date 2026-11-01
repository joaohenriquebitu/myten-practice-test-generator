export type Locale = "en" | "pt-BR";

type TranslationSet = {
  language: string;
  languageLabel: string;
  subtitle: string;
  homeLabel: string;
  examSetup: string;
  setupDescription: string;
  baseFolder: string;
  allowSkip: string;
  revealAnswersAtEnd: string;
  available: (count: number) => string;
  questionsToDraw: string;
  decreaseQuestions: string;
  increaseQuestions: string;
  correctPoints: string;
  decreaseCorrectPoints: string;
  increaseCorrectPoints: string;
  wrongPoints: string;
  decreaseWrongPoints: string;
  increaseWrongPoints: string;
  penaltyHint: string;
  examQuestions: string;
  maxScore: string;
  startExam: string;
  questionProgress: (current: number, total: number) => string;
  correct: string;
  wrong: string;
  confirmAnswer: string;
  skip: string;
  seeResults: string;
  nextQuestion: string;
  results: string;
  combinedScore: string;
  accuracy: string;
  correctCount: string;
  incorrect: string;
  skipped: string;
  byJsonFile: string;
  scoreSummary: (
    score: number,
    maxScore: number,
    correct: number,
    incorrect: number,
    skipped: number,
  ) => string;
  skippedFeedback: string;
  correctFeedback: (points: string) => string;
  incorrectFeedback: (correctAnswer: string, points: string) => string;
  yourAnswer: string;
  correctAnswer: string;
  retry: string;
  backToSetup: string;
};

export const translations: Record<Locale, TranslationSet> = {
  en: {
    language: "Language",
    languageLabel: "Select language",
    subtitle: "Question simulator",
    homeLabel: "Myten home",
    examSetup: "Exam setup",
    setupDescription:
      "The exam uses every JSON file in {base} together. For each file, choose how many questions to draw at random and how scoring works.",
    baseFolder: "Base",
    allowSkip: "Allow skip (no points and no penalty)",
    revealAnswersAtEnd: "Show correct answers only at the end",
    available: (count) => `${count} available`,
    questionsToDraw: "Questions to draw",
    decreaseQuestions: "Decrease questions to draw",
    increaseQuestions: "Increase questions to draw",
    correctPoints: "Points per correct answer",
    decreaseCorrectPoints: "Decrease points per correct answer",
    increaseCorrectPoints: "Increase points per correct answer",
    wrongPoints: "Points per wrong answer",
    decreaseWrongPoints: "Decrease points per wrong answer",
    increaseWrongPoints: "Increase points per wrong answer",
    penaltyHint: "Use a negative value to penalize mistakes.",
    examQuestions: "exam questions",
    maxScore: "max score",
    startExam: "Start exam",
    questionProgress: (current, total) => `Question ${current} of ${total}`,
    correct: "Correct",
    wrong: "Wrong",
    confirmAnswer: "Confirm answer",
    skip: "Skip",
    seeResults: "See results",
    nextQuestion: "Next question",
    results: "Results",
    combinedScore:
      "Combined score for the whole exam. Accuracy is calculated from answered questions only.",
    accuracy: "accuracy",
    correctCount: "correct",
    incorrect: "incorrect",
    skipped: "skipped",
    byJsonFile: "By JSON file",
    scoreSummary: (score, maxScore, correct, incorrect, skipped) =>
      `Score ${score} / ${maxScore} · ${correct} correct · ${incorrect} incorrect · ${skipped} skipped`,
    skippedFeedback: "Skipped. No points and no penalty.",
    correctFeedback: (points) => `Correct · ${points}`,
    incorrectFeedback: (correctAnswer, points) =>
      `Incorrect. The right answer is: ${correctAnswer} · ${points}`,
    yourAnswer: "Your answer",
    correctAnswer: "Correct",
    retry: "Retry with same settings",
    backToSetup: "Back to setup",
  },
  "pt-BR": {
    language: "Idioma",
    languageLabel: "Selecionar idioma",
    subtitle: "Simulador de questões",
    homeLabel: "Página inicial do Myten",
    examSetup: "Configuração do exame",
    setupDescription:
      "O exame usa todos os arquivos JSON de {base} juntos. Para cada arquivo, escolha quantas questões sortear e como será a pontuação.",
    baseFolder: "Base",
    allowSkip: "Permitir pular (sem pontos e sem penalidade)",
    revealAnswersAtEnd: "Mostrar respostas corretas apenas no final",
    available: (count) => `${count} disponíveis`,
    questionsToDraw: "Questões a sortear",
    decreaseQuestions: "Diminuir questões a sortear",
    increaseQuestions: "Aumentar questões a sortear",
    correctPoints: "Pontos por resposta correta",
    decreaseCorrectPoints: "Diminuir pontos por resposta correta",
    increaseCorrectPoints: "Aumentar pontos por resposta correta",
    wrongPoints: "Pontos por resposta errada",
    decreaseWrongPoints: "Diminuir pontos por resposta errada",
    increaseWrongPoints: "Aumentar pontos por resposta errada",
    penaltyHint: "Use um valor negativo para penalizar erros.",
    examQuestions: "questões no exame",
    maxScore: "pontuação máxima",
    startExam: "Iniciar exame",
    questionProgress: (current, total) => `Questão ${current} de ${total}`,
    correct: "Correta",
    wrong: "Errada",
    confirmAnswer: "Confirmar resposta",
    skip: "Pular",
    seeResults: "Ver resultados",
    nextQuestion: "Próxima questão",
    results: "Resultados",
    combinedScore:
      "Pontuação total do exame. A precisão é calculada apenas com as questões respondidas.",
    accuracy: "precisão",
    correctCount: "corretas",
    incorrect: "incorretas",
    skipped: "puladas",
    byJsonFile: "Por arquivo JSON",
    scoreSummary: (score, maxScore, correct, incorrect, skipped) =>
      `Pontuação ${score} / ${maxScore} · ${correct} corretas · ${incorrect} incorretas · ${skipped} puladas`,
    skippedFeedback: "Pulada. Sem pontos e sem penalidade.",
    correctFeedback: (points) => `Correta · ${points}`,
    incorrectFeedback: (correctAnswer, points) =>
      `Incorreta. A resposta certa é: ${correctAnswer} · ${points}`,
    yourAnswer: "Sua resposta",
    correctAnswer: "Correta",
    retry: "Tentar novamente com as mesmas configurações",
    backToSetup: "Voltar para configuração",
  },
};

export function getInitialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem("myten-locale");
    return saved === "pt-BR" || saved === "en" ? saved : "en";
  } catch {
    return "en";
  }
}
