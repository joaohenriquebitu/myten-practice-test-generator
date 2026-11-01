import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import logo from "../assets/myten_logo.png";
import {
  getInitialLocale,
  getInitialLayout,
  getInitialTheme,
  translations,
  type Locale,
  type LayoutMode,
  type Theme,
} from "./i18n";
import { loadQuestions, loadQuestionsFromFiles } from "./loadQuestions";
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

type Screen = "home" | "setup" | "quiz" | "results";
type IconName =
  | "settings"
  | "database"
  | "folder"
  | "target"
  | "award"
  | "play"
  | "check"
  | "x"
  | "skip"
  | "arrow"
  | "refresh"
  | "home"
  | "list";
  // layout icon is intentionally text-neutral for both locales

const defaultBank = loadQuestions();

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
type QuestionSource = "server" | "local";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [bank, setBank] = useState(() => defaultBank);
  const [questionSource, setQuestionSource] = useState<QuestionSource>("server");
  const [settings, setSettings] = useState<ExamSettings>(() =>
    defaultSettings(defaultBank),
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [exam, setExam] = useState<ExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(getInitialLayout);
  const [listSelections, setListSelections] = useState<Record<string, string | null>>({});
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("myten-theme", theme);
    } catch {
      // Theme selection still works for the current session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem("myten-layout", layoutMode);
    } catch {
      // Layout selection still works for the current session when storage is unavailable.
    }
  }, [layoutMode]);

  function startExam() {
    const nextExam = buildExam(bank, settings);
    setExam(nextExam);
    setIndex(0);
    setSelected(null);
    setLocked(false);
    setAnswers({});
    setListSelections({});
    setScreen("quiz");
  }

  async function handleFolderChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = event.target.files;
    if (!selectedFiles) {
      return;
    }

    const folderName = selectedFiles[0]?.webkitRelativePath.split("/")[0] ?? selectedFiles[0]?.name;
    const loaded = await loadQuestionsFromFiles(selectedFiles);
    if (loaded.questions.length === 0) {
      setFolderError(t.noQuestionsInFolder);
      return;
    }

    setBank(loaded.questions);
    setSettings(defaultSettings(loaded.questions));
    setQuestionSource("local");
    setSelectedFolder(folderName ?? null);
    setFolderError(
      loaded.invalidFiles.length > 0
        ? t.invalidQuestionFiles(loaded.invalidFiles.length)
        : null,
    );
    event.target.value = "";
  }

  function useServerBank() {
    setBank(defaultBank);
    setSettings(defaultSettings(defaultBank));
    setQuestionSource("server");
    setSelectedFolder(null);
    setFolderError(null);
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

  function submitListAnswer(question: ExamQuestion, skipped = false) {
    const answer = skipped
      ? scoreAnswer(question, null, true)
      : scoreAnswer(question, listSelections[question.id] ?? null, false);

    if (!skipped && !listSelections[question.id]) {
      return;
    }

    const nextAnswers = { ...answers, [question.id]: answer };
    setAnswers(nextAnswers);
    if (Object.keys(nextAnswers).length === exam.length) {
      setScreen("results");
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          aria-label={t.homeLabel}
          onClick={() => setScreen("home")}
        >
          <img src={logo} alt="Myten" />
        </button>
        <div className="topbar-copy">
          <p className="brand-name">Myten</p>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="language-picker">
          <button
            className="theme-button"
            type="button"
            aria-label={theme === "dark" ? t.lightTheme : t.darkTheme}
            title={theme === "dark" ? t.lightTheme : t.darkTheme}
            onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {theme === "dark" ? (
                <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              )}
            </svg>
          </button>
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

      {screen === "home" && (
        <section className="card home-card">
          <div className="home-mark">
            <img src={logo} alt="" />
          </div>
          <h1>{t.homeTitle}</h1>
          <p className="home-description">{t.homeDescription}</p>
          <div className="home-actions-area">
            <div className="question-source-options" role="group">
              <button
                type="button"
                className={`source-option ${questionSource === "server" ? "active" : ""}`}
                onClick={useServerBank}
              >
                <Icon name="database" />{t.serverQuestionBank}
              </button>
              <label className={`secondary folder-button ${questionSource === "local" ? "active" : ""}`}>
                <Icon name="folder" />{t.chooseQuestionFolder}
                <input
                  type="file"
                  accept=".json,application/json"
                  {...{ webkitdirectory: "", directory: "" }}
                  onChange={handleFolderChange}
                />
              </label>
            </div>
            <div className="selected-source">
              {questionSource === "local" && selectedFolder
                ? t.selectedQuestionFolder(selectedFolder)
                : t.localFolderHint}
            </div>
            <div className="home-action-row">
              <button className="primary home-action" onClick={() => setScreen("setup")}>
                <Icon name="play" />{t.openSetup}
              </button>
            </div>
          </div>
          {folderError && <p className="folder-error">{folderError}</p>}
        </section>
      )}

      {screen === "setup" && (
        <section className="card">
          <h1><Icon name="settings" />{t.examSetup}</h1>
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

          <div className="layout-choice">
            <span className="layout-choice-label">
              <Icon name="list" />
              {t.layoutLabel}
            </span>
            <div className="layout-choice-options" role="group" aria-label={t.layoutLabel}>
              <button
                type="button"
                className={layoutMode === "single" ? "active" : ""}
                onClick={() => setLayoutMode("single")}
              >
                {t.singleLayout}
              </button>
              <button
                type="button"
                className={layoutMode === "two-column" ? "active" : ""}
                onClick={() => setLayoutMode("two-column")}
              >
                {t.twoColumnLayout}
              </button>
              <button
                type="button"
                className={layoutMode === "one-column" ? "active" : ""}
                onClick={() => setLayoutMode("one-column")}
              >
                {t.oneColumnLayout}
              </button>
            </div>
          </div>

          <div className="file-configs">
            {settings.files.map((file) => (
              <article
                key={file.sourceFile}
                className={`file-config${
                  file.questionCount === 0 ? " is-unused" : ""
                }`}
              >
                <header>
                  <h2><Icon name="database" />{file.sourceFile}</h2>
                  <span>{t.available(file.availableCount)}</span>
                </header>
                <div className="fields">
                  <div className="field field-questions">
                    <label htmlFor={`questions-${file.sourceFile}`}>
                      {t.questionsToDraw}
                    </label>
                    <span
                      className={`number-control questions-control${
                        file.questionCount === 0 ? " is-empty" : ""
                      }`}
                    >
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
                  <div className="field field-correct">
                    <label htmlFor={`correct-points-${file.sourceFile}`}>
                      {t.correctPoints}
                    </label>
                    <span className="number-control">
                      <button
                        type="button"
                        disabled={file.questionCount === 0}
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
                        disabled={file.questionCount === 0}
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
                        disabled={file.questionCount === 0}
                        aria-label={t.increaseCorrectPoints}
                        onClick={() =>
                          adjustFileValue(file.sourceFile, "correctPoints", 1)
                        }
                      >
                        +
                      </button>
                    </span>
                  </div>
                  <div className="field field-wrong">
                    <label htmlFor={`wrong-points-${file.sourceFile}`}>
                      {t.wrongPoints}
                    </label>
                    <span className="number-control">
                      <button
                        type="button"
                        disabled={file.questionCount === 0}
                        aria-label={t.decreaseWrongPoints}
                        onClick={() =>
                          adjustFileValue(file.sourceFile, "wrongPoints", -1)
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        disabled={file.questionCount === 0}
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
                        disabled={file.questionCount === 0}
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

          <div className="setup-summary">
            <ul className="stats">
            <li>
              <Icon name="target" />
              <span className="stat-copy">
                <strong>{totalPlanned}</strong>
                <span>{t.examQuestions}</span>
              </span>
            </li>
            <li>
              <Icon name="award" />
              <span className="stat-copy">
                <strong>{maxPlanned}</strong>
                <span>{t.maxScore}</span>
              </span>
            </li>
            </ul>
            <button
              className="primary start-button"
              disabled={totalPlanned === 0}
              onClick={startExam}
            >
              <Icon name="play" />{t.startExam}
            </button>
          </div>
        </section>
      )}

      {screen === "quiz" && current && layoutMode === "single" && (
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
          <p className="scoring-hint"><Icon name="award" />
            {t.correct}: {formatPoints(current.correctPoints)} · {t.wrong}:{" "}
            {formatPoints(current.wrongPoints)}
          </p>
          <h2 className="question-title">{current.statement}</h2>
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
                  <span className="choice-indicator" aria-hidden="true" />
                  {locked && isCorrect && <Icon name="check" />}
                  {locked &&
                    isSelected &&
                    answers[current.id]?.status === "incorrect" && <Icon name="x" />}
                  {alternative}
                </button>
              );
            })}
          </div>
          {!locked ? (
            <div className="actions quiz-actions">
              <button
                className="primary"
                disabled={!selected}
                onClick={confirmAnswer}
              >
                <Icon name="check" />{t.confirmAnswer}
              </button>
              {settings.allowSkip && (
                <button className="secondary skip-button" onClick={skipQuestion}>
                  <Icon name="skip" />{t.skip}
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
                <Icon name="arrow" />{index + 1 >= exam.length ? t.seeResults : t.nextQuestion}
              </button>
            </div>
          )}
        </section>
      )}

      {screen === "quiz" && layoutMode !== "single" && (
        <section className="card list-quiz">
          <div className="progress">
            <span>
              {layoutMode === "two-column"
                ? t.twoColumnLayout
                : t.oneColumnLayout}
            </span>
            <span>{Object.keys(answers).length} / {exam.length}</span>
          </div>
          <div className="progress-bar">
            <div style={{ width: `${(Object.keys(answers).length / exam.length) * 100}%` }} />
          </div>
          <div
            className={`question-list ${
              layoutMode === "one-column" ? "one-column" : ""
            }`}
          >
            {exam.map((question, questionIndex) => {
              const answer = answers[question.id];
              const questionSelection = listSelections[question.id] ?? null;
              const questionLocked = Boolean(answer);

              return (
                <article className="list-question" key={question.id}>
                  <div className="list-question-heading">
                    <span>{questionIndex + 1}</span>
                    <span>{question.sourceFile}</span>
                  </div>
                  <h2 className="question-title">{question.statement}</h2>
                  <div className="alternatives" role="listbox">
                    {question.alternatives.map((alternative) => {
                      const isSelected = questionSelection === alternative;
                      const isCorrect = alternative === question.correctAnswer;
                      let className = "choice";
                      if (questionLocked && isCorrect) className += " correct";
                      else if (questionLocked && isSelected && answer?.status === "incorrect") className += " incorrect";
                      else if (isSelected) className += " selected";

                      return (
                        <button
                          key={alternative}
                          className={className}
                          disabled={questionLocked}
                          onClick={() =>
                            setListSelections((previous) => ({
                              ...previous,
                              [question.id]: alternative,
                            }))
                          }
                        >
                          <span className="choice-indicator" aria-hidden="true" />
                          {questionLocked && isCorrect && <Icon name="check" />}
                          {questionLocked && isSelected && answer?.status === "incorrect" && <Icon name="x" />}
                          {alternative}
                        </button>
                      );
                    })}
                  </div>
                  {!questionLocked ? (
                    <div className="actions quiz-actions">
                      {settings.allowSkip && (
                        <button className="secondary skip-button" onClick={() => submitListAnswer(question, true)}>
                          <Icon name="skip" />{t.skip}
                        </button>
                      )}
                      <button
                        className="primary"
                        disabled={!questionSelection}
                        onClick={() => submitListAnswer(question)}
                      >
                        <Icon name="check" />{t.confirmAnswer}
                      </button>
                    </div>
                  ) : (
                    <div className={`list-feedback ${statusClass(answer?.status)}`}>
                      <Icon name={answer?.status === "correct" ? "check" : answer?.status === "incorrect" ? "x" : "skip"} />
                      <span>{feedbackText(answer, question.correctAnswer, t)}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {screen === "results" && (
        <section className="card">
          <h1><Icon name="award" />{t.results}</h1>
          <p className="score">
            {results.score}
            <span className="score-max"> / {results.maxScore}</span>
          </p>
          <p>
            {t.combinedScore}
          </p>
          <ul className="stats">
            <li>
              <Icon name="target" />
              <span className="stat-copy">
                <strong>{results.accuracyPercent}%</strong>
                <span>{t.accuracy}</span>
              </span>
            </li>
            <li>
              <Icon name="check" />
              <span className="stat-copy">
                <strong>{results.correct}</strong>
                <span>{t.correctCount}</span>
              </span>
            </li>
            <li>
              <Icon name="x" />
              <span className="stat-copy">
                <strong>{results.incorrect}</strong>
                <span>{t.incorrect}</span>
              </span>
            </li>
            <li>
              <Icon name="skip" />
              <span className="stat-copy">
                <strong>{results.skipped}</strong>
                <span>{t.skipped}</span>
              </span>
            </li>
          </ul>

          <h2><Icon name="database" />{t.byJsonFile}</h2>
          <div className="file-results">
            {results.byFile.map((file) => (
              <article key={file.sourceFile}>
                <h3><Icon name="database" />{file.sourceFile}</h3>
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
                  <div className="review-heading">
                    <span className="review-number">{questionIndex + 1}</span>
                    <p>{question.statement}</p>
                  </div>
                  <div className={`review-result ${statusClass(answer?.status)}`}>
                    <span className="review-status-icon">
                      <Icon name={answer?.status === "correct" ? "check" : answer?.status === "incorrect" ? "x" : "skip"} />
                    </span>
                    {answer?.status === "skipped" ? (
                      <span className="review-status-text">{t.skippedFeedback}</span>
                    ) : (
                      <>
                        <span><strong>{t.yourAnswer}</strong> {answer?.selected ?? "—"}</span>
                        <span><strong>{t.correctAnswer}</strong> {question.correctAnswer}</span>
                        <span className="review-points">{formatPoints(answer?.points ?? 0)}</span>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="actions">
            <button className="secondary" onClick={startExam}>
              <Icon name="refresh" />{t.retry}
            </button>
            <button className="primary" onClick={() => setScreen("home")}>
              <Icon name="home" />{t.backToHome}
            </button>
          </div>
        </section>
      )}

      <footer className="footer">{t.createdBy}</footer>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" /><path d="M3 10h18" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
    award: <><path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H5a3 3 0 0 0 3 4M17 6h2a3 3 0 0 1-3 4M9 15l-1 6 4-2 4 2-1-6" /></>,
    play: <path d="m9 6 9 6-9 6V6Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
    skip: <><path d="m5 5 7 7-7 7M14 5h5v14h-5" /></>,
    arrow: <><path d="M5 12h13M13 6l6 6-6 6" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.65-4.35L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14.65 4.35L21 15" /><path d="M21 20v-5h-5" /></>,
    home: <><path d="m3 11 9-8 9 8v10H3V11Z" /><path d="M9 21v-7h6v7" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  };

  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
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
