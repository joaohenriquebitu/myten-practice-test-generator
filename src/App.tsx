import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowRight,
  Award,
  Check,
  Database,
  Folder,
  Globe,
  House,
  List,
  Moon,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Sun,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
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
  | "list"
  | "moon"
  | "sun"
  | "globe";

const icons: Record<IconName, LucideIcon> = {
  settings: Settings2,
  database: Database,
  folder: Folder,
  target: Target,
  award: Award,
  play: Play,
  check: Check,
  x: X,
  skip: SkipForward,
  arrow: ArrowRight,
  refresh: RotateCcw,
  home: House,
  list: List,
  moon: Moon,
  sun: Sun,
  globe: Globe,
};

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
type QuestionRangePointer = {
  startX: number;
  startY: number;
  startedOnNumber: boolean;
  horizontalDrag: boolean;
  verticalDrag: boolean;
};

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
  const rangePointers = useRef<Record<string, QuestionRangePointer>>({});

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

  function setQuestionCount(sourceFile: string, value: number) {
    setSettings((previous) => {
      const file = previous.files.find((item) => item.sourceFile === sourceFile);
      if (!file) {
        return previous;
      }

      return updateFile(previous, sourceFile, {
        questionCount: Math.min(file.availableCount, Math.max(0, value)),
      });
    });
  }

  function questionCountAtPointer(
    event: ReactPointerEvent<HTMLSpanElement>,
    file: FileConfig,
  ) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setQuestionCount(file.sourceFile, Math.round(ratio * file.availableCount));
  }

  function handleRangePointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    file: FileConfig,
  ) {
    if (file.availableCount === 0) {
      return;
    }

    const startedOnNumber = Boolean(
      (event.target as HTMLElement).closest('input[type="number"]'),
    );
    rangePointers.current[file.sourceFile] = {
      startX: event.clientX,
      startY: event.clientY,
      startedOnNumber,
      horizontalDrag: false,
      verticalDrag: false,
    };
  }

  function handleRangePointerMove(
    event: ReactPointerEvent<HTMLSpanElement>,
    file: FileConfig,
  ) {
    const pointer = rangePointers.current[file.sourceFile];
    if (!pointer || pointer.verticalDrag) {
      return;
    }

    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.horizontalDrag && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        pointer.verticalDrag = true;
        return;
      }

      pointer.horizontalDrag = true;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (pointer.horizontalDrag) {
      questionCountAtPointer(event, file);
    }
  }

  function handleRangePointerUp(
    event: ReactPointerEvent<HTMLSpanElement>,
    file: FileConfig,
  ) {
    const pointer = rangePointers.current[file.sourceFile];
    if (
      pointer &&
      !pointer.startedOnNumber &&
      !pointer.verticalDrag &&
      !pointer.horizontalDrag
    ) {
      questionCountAtPointer(event, file);
    }
    delete rangePointers.current[file.sourceFile];
  }

  function handleRangePointerCancel(file: FileConfig) {
    delete rangePointers.current[file.sourceFile];
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
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </button>
          <button
            className="language-button"
            type="button"
            aria-label={t.languageLabel}
            aria-expanded={languageMenuOpen}
            onClick={() => setLanguageMenuOpen((open) => !open)}
          >
            <Icon name="globe" />
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
                <Icon name="database" />
                <span>{t.serverQuestionBank}</span>
              </button>
              <label className={`secondary folder-button ${questionSource === "local" ? "active" : ""}`}>
                <Icon name="folder" />
                <span>{t.chooseQuestionFolder}</span>
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
                className={layoutMode === "one-column" ? "active" : ""}
                onClick={() => setLayoutMode("one-column")}
              >
                {t.oneColumnLayout}
              </button>
              <button
                type="button"
                className={layoutMode === "two-column" ? "active" : ""}
                onClick={() => setLayoutMode("two-column")}
              >
                {t.twoColumnLayout}
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
                      <span
                        className="questions-input-field"
                        style={{
                          "--range-progress": `${file.availableCount > 0
                            ? (file.questionCount / file.availableCount) * 100
                            : 0}%`,
                        } as CSSProperties}
                        onPointerDown={(event) => handleRangePointerDown(event, file)}
                        onPointerMove={(event) => handleRangePointerMove(event, file)}
                        onPointerUp={(event) => handleRangePointerUp(event, file)}
                        onPointerCancel={() => handleRangePointerCancel(file)}
                      >
                        <input
                          id={`questions-${file.sourceFile}`}
                          type="number"
                          min={0}
                          max={file.availableCount}
                          value={file.questionCount}
                          onChange={(event) =>
                            setQuestionCount(
                              file.sourceFile,
                              parseNumber(event.target.value, 0),
                            )
                          }
                        />
                        <input
                          id={`questions-slider-${file.sourceFile}`}
                          className="question-range"
                          type="range"
                          min={0}
                          max={file.availableCount}
                          step={1}
                          value={file.questionCount}
                          disabled={file.availableCount === 0}
                          aria-label={`${t.questionsToDraw}: ${file.sourceFile}`}
                          aria-valuetext={`${file.questionCount} / ${file.availableCount}`}
                          onChange={(event) =>
                            setQuestionCount(
                              file.sourceFile,
                              parseNumber(event.target.value, 0),
                            )
                          }
                        />
                      </span>
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
                      const revealAnswer = questionLocked && !settings.revealAnswersAtEnd;
                      let className = "choice";
                      if (revealAnswer && isCorrect) className += " correct";
                      else if (revealAnswer && isSelected && answer?.status === "incorrect") className += " incorrect";
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
                          {revealAnswer && isCorrect && <Icon name="check" />}
                          {revealAnswer && isSelected && answer?.status === "incorrect" && <Icon name="x" />}
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
                  ) : !settings.revealAnswersAtEnd ? (
                    <div className={`list-feedback ${statusClass(answer?.status)}`}>
                      <Icon name={answer?.status === "correct" ? "check" : answer?.status === "incorrect" ? "x" : "skip"} />
                      <span>{feedbackText(answer, question.correctAnswer, t)}</span>
                    </div>
                  ) : null}
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
  const IconComponent = icons[name];
  return <IconComponent className="ui-icon" aria-hidden="true" />;
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
