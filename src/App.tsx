import { useEffect, useMemo, useState } from "react";
import logo from "../assets/myten_logo.png";
import { getInitialLocale, translations, type Locale } from "./i18n";
import { loadQuestions } from "./loadQuestions";
import {
  buildExam,
  computeResults,
  defaultSettings,
  plannedMaxScore,
  plannedQuestionCount,
  scoreAnswer,
} from "./exam";
import type {
  AnswerRecord,
  ExamQuestion,
  ExamSettings,
  FileConfig,
} from "./types";

type Screen = "start" | "quiz" | "results";

const bank = loadQuestions();

function updateFile(
  settings: ExamSettings,
  sourceFile: string,
  patch: Partial<FileConfig>,
): ExamSettings {
  return {
    ...settings,
    files: settings.files.map((file) =>
      file.sourceFile === sourceFile ? { ...file, ...patch } : file,
    ),
  };
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type NumericFileField = "questionCount" | "correctPoints" | "wrongPoints";

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [settings, setSettings] = useState<ExamSettings>(() =>
    defaultSettings(bank),
  );
  const [exam, setExam] = useState<ExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const current = exam[index];
  const t = translations[locale];
  const results = useMemo(() => computeResults(exam, answers), [exam, answers]);
  const totalPlanned = plannedQuestionCount(settings);
  const maxPlanned = plannedMaxScore(settings);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem("myten-locale", locale);
    } catch {
      // Language selection still works for the current session when storage is unavailable.
    }
  }, [locale]);

  function startExam() {
    const nextExam = buildExam(bank, settings);
    setExam(nextExam);
    setIndex(0);
    setSelected(null);
    setLocked(false);
    setAnswers({});
    setScreen("quiz");
  }

  function adjustFileValue(
    sourceFile: string,
    field: NumericFileField,
    delta: number,
    minimum = Number.NEGATIVE_INFINITY,
    maximum = Number.POSITIVE_INFINITY,
  ) {
    setSettings((previous) => {
      const file = previous.files.find((item) => item.sourceFile === sourceFile);
      if (!file) {
        return previous;
      }

      const value = Math.min(maximum, Math.max(minimum, file[field] + delta));
      return updateFile(previous, sourceFile, { [field]: value });
    });
  }

  function lockAnswer(record: AnswerRecord) {
    setAnswers((previous) => ({
      ...previous,
      [record.questionId]: record,
    }));

    if (settings.revealAnswersAtEnd) {
      goNext();
    } else {
      setLocked(true);
    }
  }

  function confirmAnswer() {
    if (!current || !selected || locked) {
      return;
    }

    lockAnswer(scoreAnswer(current, selected, false));
  }

  function skipQuestion() {
    if (!current || locked) {
      return;
    }

    lockAnswer(scoreAnswer(current, null, true));
  }

  function goNext() {
    if (index + 1 >= exam.length) {
      setScreen("results");
      return;
    }

    setIndex((value) => value + 1);
    setSelected(null);
    setLocked(false);
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <img src={logo} alt="Myten" />
        </div>
        <div className="topbar-copy">
          <p className="brand-name">Myten</p>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="language-picker">
          <button
            className="language-button"
            type="button"
            aria-label={t.languageLabel}
            aria-expanded={languageMenuOpen}
            onClick={() => setLanguageMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" />
            </svg>
            <span>{locale === "en" ? "EN" : "PT"}</span>
          </button>
          {languageMenuOpen && (
            <div className="language-menu" role="menu" aria-label={t.languageLabel}>
              <button
                type="button"
                role="menuitem"
                className={locale === "en" ? "active" : ""}
                onClick={() => {
                  setLocale("en");
                  setLanguageMenuOpen(false);
                }}
              >
                English
              </button>
              <button
                type="button"
                role="menuitem"
                className={locale === "pt-BR" ? "active" : ""}
                onClick={() => {
                  setLocale("pt-BR");
                  setLanguageMenuOpen(false);
                }}
              >
                Português (Brasil)
              </button>
            </div>
          )}
        </div>
      </header>

      {screen === "start" && (
        <section className="card">
          <h1>{t.examSetup}</h1>
          <p>
            {t.setupDescription.split("{base}")[0]}
            <code>{t.baseFolder}</code>
            {t.setupDescription.split("{base}")[1]}
          </p>

          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.allowSkip}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  allowSkip: event.target.checked,
                }))
              }
            />
            {t.allowSkip}
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.revealAnswersAtEnd}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  revealAnswersAtEnd: event.target.checked,
                }))
              }
            />
            {t.revealAnswersAtEnd}
          </label>

          <div className="file-configs">
            {settings.files.map((file) => (
              <article key={file.sourceFile} className="file-config">
                <header>
                  <h2>{file.sourceFile}</h2>
                  <span>{t.available(file.availableCount)}</span>
                </header>
                <div className="fields">
                  <div className="field">
                    <label htmlFor={`questions-${file.sourceFile}`}>
                      {t.questionsToDraw}
                    </label>
                    <span className="number-control">
                      <button
                        type="button"
                        aria-label={t.decreaseQuestions}
                        onClick={() =>
                          adjustFileValue(
                            file.sourceFile,
                            "questionCount",
                            -1,
                            0,
                            file.availableCount,
                          )
                        }
                      >
                        −
                      </button>
                      <input
                        id={`questions-${file.sourceFile}`}
                        type="number"
                        min={0}
                        max={file.availableCount}
                        value={file.questionCount}
                        onChange={(event) =>
                          setSettings((previous) =>
                            updateFile(previous, file.sourceFile, {
                              questionCount: Math.min(
                                file.availableCount,
                                Math.max(0, parseNumber(event.target.value, 0)),
                              ),
                            }),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={t.increaseQuestions}
                        onClick={() =>
                          adjustFileValue(
                            file.sourceFile,
                            "questionCount",
                            1,
                            0,
                            file.availableCount,
                          )
                        }
                      >
                        +
                      </button>
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor={`correct-points-${file.sourceFile}`}>
                      {t.correctPoints}
                    </label>
                    <span className="number-control">
                      <button
                        type="button"
                        aria-label={t.decreaseCorrectPoints}
                        onClick={() =>
                          adjustFileValue(
                            file.sourceFile,
                            "correctPoints",
                            -1,
                          )
                        }
                      >
                        −
                      </button>
                      <input
                        id={`correct-points-${file.sourceFile}`}
                        type="number"
                        value={file.correctPoints}
                        onChange={(event) =>
                          setSettings((previous) =>
                            updateFile(previous, file.sourceFile, {
                              correctPoints: parseNumber(event.target.value, 0),
                            }),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={t.increaseCorrectPoints}
                        onClick={() =>
                          adjustFileValue(file.sourceFile, "correctPoints", 1)
                        }
                      >
                        +
                      </button>
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor={`wrong-points-${file.sourceFile}`}>
                      {t.wrongPoints}
                    </label>
                    <span className="number-control">
                      <button
                        type="button"
                        aria-label={t.decreaseWrongPoints}
                        onClick={() =>
                          adjustFileValue(file.sourceFile, "wrongPoints", -1)
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={file.wrongPoints}
                        onChange={(event) =>
                          setSettings((previous) =>
                            updateFile(previous, file.sourceFile, {
                              wrongPoints: parseNumber(event.target.value, 0),
                            }),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={t.increaseWrongPoints}
                        onClick={() =>
                          adjustFileValue(file.sourceFile, "wrongPoints", 1)
                        }
                      >
                        +
                      </button>
                    </span>
                    <small>{t.penaltyHint}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <ul className="stats">
            <li>
              <strong>{totalPlanned}</strong>
              <span>{t.examQuestions}</span>
            </li>
            <li>
              <strong>{maxPlanned}</strong>
              <span>{t.maxScore}</span>
            </li>
          </ul>

          <button
            className="primary"
            disabled={totalPlanned === 0}
            onClick={startExam}
          >
            {t.startExam}
          </button>
        </section>
      )}

      {screen === "quiz" && current && (
        <section className="card">
          <div className="progress">
            <span>
              {t.questionProgress(index + 1, exam.length)}
            </span>
            <span>{current.sourceFile}</span>
          </div>
          <div className="progress-bar">
            <div
              style={{
                width: `${((index + 1) / exam.length) * 100}%`,
              }}
            />
          </div>
          <p className="scoring-hint">
            {t.correct}: {formatPoints(current.correctPoints)} · {t.wrong}:{" "}
            {formatPoints(current.wrongPoints)}
          </p>
          <h2>{current.statement}</h2>
          <div className="alternatives" role="listbox">
            {current.alternatives.map((alternative) => {
              const isSelected = selected === alternative;
              const isCorrect = alternative === current.correctAnswer;
              let className = "choice";

              if (locked && isCorrect) {
                className += " correct";
              } else if (
                locked &&
                isSelected &&
                answers[current.id]?.status === "incorrect"
              ) {
                className += " incorrect";
              } else if (isSelected) {
                className += " selected";
              }

              return (
                <button
                  key={alternative}
                  className={className}
                  disabled={locked}
                  onClick={() => setSelected(alternative)}
                >
                  {alternative}
                </button>
              );
            })}
          </div>
          {!locked ? (
            <div className="actions">
              <button
                className="primary"
                disabled={!selected}
                onClick={confirmAnswer}
              >
                {t.confirmAnswer}
              </button>
              {settings.allowSkip && (
                <button className="secondary" onClick={skipQuestion}>
                  {t.skip}
                </button>
              )}
            </div>
          ) : (
            <div className="feedback-row">
              <p className={statusClass(answers[current.id]?.status)}>
                {feedbackText(
                  answers[current.id],
                  current.correctAnswer,
                  t,
                )}
              </p>
              <button className="primary" onClick={goNext}>
                {index + 1 >= exam.length ? t.seeResults : t.nextQuestion}
              </button>
            </div>
          )}
        </section>
      )}

      {screen === "results" && (
        <section className="card">
          <h1>{t.results}</h1>
          <p className="score">
            {results.score}
            <span className="score-max"> / {results.maxScore}</span>
          </p>
          <p>
            {t.combinedScore}
          </p>
          <ul className="stats">
            <li>
              <strong>{results.accuracyPercent}%</strong>
              <span>{t.accuracy}</span>
            </li>
            <li>
              <strong>{results.correct}</strong>
              <span>{t.correctCount}</span>
            </li>
            <li>
              <strong>{results.incorrect}</strong>
              <span>{t.incorrect}</span>
            </li>
            <li>
              <strong>{results.skipped}</strong>
              <span>{t.skipped}</span>
            </li>
          </ul>

          <h2>{t.byJsonFile}</h2>
          <div className="file-results">
            {results.byFile.map((file) => (
              <article key={file.sourceFile}>
                <h3>{file.sourceFile}</h3>
                <p>
                  {t.scoreSummary(
                    file.score,
                    file.maxScore,
                    file.correct,
                    file.incorrect,
                    file.skipped,
                  )}
                </p>
              </article>
            ))}
          </div>

          <div className="review">
            {exam.map((question, questionIndex) => {
              const answer = answers[question.id];
              return (
                <article key={question.id}>
                  <p>
                    {questionIndex + 1}. {question.statement}
                  </p>
                  <p className={statusClass(answer?.status)}>
                    {answer?.status === "skipped"
                      ? t.skippedFeedback
                      : `${t.yourAnswer}: ${answer?.selected ?? "—"} · ${t.correctAnswer}: ${question.correctAnswer} · ${formatPoints(answer?.points ?? 0)}`}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="actions">
            <button className="primary" onClick={startExam}>
              {t.retry}
            </button>
            <button className="secondary" onClick={() => setScreen("start")}>
              {t.backToSetup}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function formatPoints(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function statusClass(status: AnswerRecord["status"] | undefined): string {
  if (status === "correct") {
    return "ok";
  }
  if (status === "incorrect") {
    return "bad";
  }
  return "muted";
}

function feedbackText(
  answer: AnswerRecord | undefined,
  correctAnswer: string,
  t: (typeof translations)[Locale],
): string {
  if (answer?.status === "skipped") {
    return t.skippedFeedback;
  }
  if (answer?.status === "correct") {
    return t.correctFeedback(formatPoints(answer.points));
  }
  return t.incorrectFeedback(
    correctAnswer,
    formatPoints(answer?.points ?? 0),
  );
}
