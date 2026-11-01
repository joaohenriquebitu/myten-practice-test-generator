import type { LoadedQuestion, Question } from "./types";

type QuestionFile = Question | Question[] | { questions: Question[] };

const files = import.meta.glob("../Base/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, QuestionFile>;

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Question>;
  return (
    typeof candidate.statement === "string" &&
    Array.isArray(candidate.alternatives) &&
    candidate.alternatives.every((item) => typeof item === "string") &&
    typeof candidate.correctAnswer === "string"
  );
}

function extractQuestions(payload: QuestionFile): Question[] {
  if (Array.isArray(payload)) {
    return payload.filter(isQuestion);
  }

  if (isQuestion(payload)) {
    return [payload];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "questions" in payload &&
    Array.isArray(payload.questions)
  ) {
    return payload.questions.filter(isQuestion);
  }

  return [];
}

function toFileName(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

export function loadQuestions(): LoadedQuestion[] {
  const questions: LoadedQuestion[] = [];

  for (const [path, payload] of Object.entries(files)) {
    const sourceFile = toFileName(path);

    extractQuestions(payload).forEach((question, index) => {
      questions.push({
        ...question,
        id: `${sourceFile}-${index}`,
        sourceFile,
      });
    });
  }

  return questions;
}

export function listSourceFiles(): string[] {
  return Object.keys(files).map(toFileName).sort();
}

export async function loadQuestionsFromFiles(
  selectedFiles: FileList,
): Promise<{ questions: LoadedQuestion[]; invalidFiles: string[] }> {
  const questions: LoadedQuestion[] = [];
  const invalidFiles: string[] = [];
  const jsonFiles = Array.from(selectedFiles).filter((file) =>
    file.name.toLowerCase().endsWith(".json"),
  );

  for (const file of jsonFiles) {
    try {
      const payload = JSON.parse(await file.text()) as QuestionFile;
      const extracted = extractQuestions(payload);
      if (extracted.length === 0) {
        invalidFiles.push(file.name);
        continue;
      }

      extracted.forEach((question, index) => {
        questions.push({
          ...question,
          id: `${file.name}-${index}`,
          sourceFile: file.name,
        });
      });
    } catch {
      invalidFiles.push(file.name);
    }
  }

  return { questions, invalidFiles };
}
