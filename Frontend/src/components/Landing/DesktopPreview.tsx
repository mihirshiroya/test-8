import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Coffee,
  Flame,
  LayoutGrid,
  ListTodo,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";

const initialTasks = [
  {
    name: "A little movement, a clearer mind",
    tag: "Personal",
    time: "08:00",
    done: true,
  },
  {
    name: "Make progress on the big idea",
    tag: "Deep work",
    time: "09:30",
    done: false,
  },
  {
    name: "Read a chapter. Find a new perspective.",
    tag: "Learning",
    time: "12:00",
    done: false,
  },
];
const tabs = [
  { name: "My day", icon: LayoutGrid },
  { name: "Focus", icon: Target },
  { name: "Notes", icon: BookOpen },
  { name: "Projects", icon: ListTodo },
];

export default function DesktopPreview() {
  const [tab, setTab] = useState("My day");
  const [tasks, setTasks] = useState(initialTasks);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [running]);
  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);
  const complete = tasks.filter((task) => task.done).length;
  return (
    <div
      className="c-desktop"
      aria-label="Interactive Consistent desktop preview with example content"
    >
      <div className="c-windowbar">
        <span className="c-windowdots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>consistent — a little better, every day</span>
        <span className="c-window-icon">
          <Settings2 size={12} />
        </span>
      </div>
      <div className="c-desktop-body">
        <aside className="c-app-sidebar">
          <div className="c-mini-brand">
            <span className="c-brandmark">
              <Check size={16} strokeWidth={3} />
            </span>{" "}
            consistent
          </div>
          <div className="c-workspace-name">
            <span>My workspace</span>
            <ChevronDown size={12} />
          </div>
          <div className="c-app-nav" aria-label="Preview pages">
            {tabs.map(({ name, icon: Icon }) => (
              <button
                type="button"
                key={name}
                className={tab === name ? "is-active" : ""}
                aria-pressed={tab === name}
                onClick={() => setTab(name)}
              >
                <Icon size={14} />
                {name}
                {name === "My day" && <span className="c-nav-count">3</span>}
              </button>
            ))}
          </div>
          <div className="c-sidebar-label">
            YOUR SPACE <Plus size={11} />
          </div>
          <span className="c-project-link">
            <i /> Personal growth
          </span>
          <span className="c-project-link">
            <i /> Something worth building
          </span>
          <div className="c-sidebar-bottom">
            <span className="c-user-avatar">J</span>
            <div>
              Jamie&apos;s workspace<small>A fresh start, every day</small>
            </div>
          </div>
        </aside>
        <div className="c-app-main">
          <div className="c-app-breadcrumb">
            Workspace <span>/</span> {tab} <Search size={13} />
          </div>
          {tab === "My day" && (
            <>
              <div className="c-app-heading">
                <div>
                  <div className="c-preview-date">MONDAY, A NEW BEGINNING</div>
                  <h3>
                    A good day to grow<span>.</span>
                  </h3>
                  <p>You don&apos;t have to do it all. Just what matters.</p>
                </div>
                <span className="c-sun" aria-hidden="true">
                  ☼
                </span>
              </div>
              <div className="c-stats-row">
                <div>
                  <span>
                    <Clock3 size={12} /> Focus time
                  </span>
                  <strong>
                    2h 45m <small>+25%</small>
                  </strong>
                  <div className="c-mini-bars" aria-hidden="true">
                    {[
                      35, 65, 45, 80, 65, 95, 80, 100, 85, 110, 90, 130, 110,
                      145, 120, 155,
                    ].map((height, index) => (
                      <i key={index} style={{ height: height / 6 }} />
                    ))}
                  </div>
                </div>
                <div>
                  <span>
                    <Check size={12} /> Small wins
                  </span>
                  <strong>
                    {complete}
                    <em>/3</em>
                  </strong>
                  <div className="c-completion-track">
                    <i style={{ width: `${(complete / 3) * 100}%` }} />
                  </div>
                </div>
                <div className="c-streak-stat">
                  <span>
                    <Flame size={12} /> Showing up
                  </span>
                  <strong>
                    7 <em>days</em>
                  </strong>
                  <p>One day at a time.</p>
                </div>
              </div>
              <div className="c-task-heading">
                <h4>
                  Today&apos;s intentions <span>{tasks.length}</span>
                </h4>
                <MoreHorizontal size={16} />
              </div>
              <div className="c-task-list">
                {tasks.map((task, index) => (
                  <div
                    className={`c-preview-task ${task.done ? "is-done" : ""}`}
                    key={task.name}
                  >
                    <button
                      type="button"
                      aria-label={`${task.done ? "Uncomplete" : "Complete"} ${task.name}`}
                      aria-pressed={task.done}
                      onClick={() =>
                        setTasks((current) =>
                          current.map((item, taskIndex) =>
                            taskIndex === index
                              ? { ...item, done: !item.done }
                              : item,
                          ),
                        )
                      }
                    >
                      {task.done && <Check size={10} />}
                    </button>
                    <span>
                      {task.name}
                      <small>{task.tag}</small>
                    </span>
                    <time>{task.time}</time>
                    <ArrowUpRight size={12} />
                  </div>
                ))}
              </div>
              <div className="c-gentle-note">
                <Sparkles size={13} />
                <span>
                  Progress isn&apos;t always loud. Sometimes, it&apos;s simply
                  showing up.
                </span>
              </div>
            </>
          )}
          {tab === "Focus" && (
            <div className="c-preview-focus">
              <span className="c-section-kicker">[ One thing at a time ]</span>
              <h3>Make room for deep work.</h3>
              <p>Make progress on the big idea</p>
              <div className="c-focus-clock">
                {String(Math.floor(seconds / 60)).padStart(2, "0")}
                <span>:</span>
                {String(seconds % 60).padStart(2, "0")}
              </div>
              <div className="c-focus-controls">
                <button
                  className="c-button c-button-lime"
                  type="button"
                  disabled={seconds === 0}
                  onClick={() => setRunning((value) => !value)}
                >
                  {running ? <Pause size={14} /> : <Play size={14} />}
                  {running ? "Pause session" : "Start focusing"}
                </button>
                <button
                  className="c-reset-focus"
                  type="button"
                  aria-label="Reset focus timer"
                  onClick={() => {
                    setRunning(false);
                    setSeconds(1500);
                  }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <small>
                <Coffee size={12} /> A little break is part of the process.
              </small>
            </div>
          )}
          {tab === "Notes" && (
            <div className="c-preview-notes">
              <div className="c-preview-date">
                YOUR PERSONAL KNOWLEDGE SPACE
              </div>
              <h3>Good ideas deserve a home.</h3>
              <p>Learning / Building better habits</p>
              <div className="c-note-document">
                <span className="c-note-document-label">
                  <BookOpen size={13} /> Building better habits.md
                </span>
                <h4>Start smaller than you think.</h4>
                <p>
                  Make it easy enough to do on an ordinary day. Consistency
                  comes from returning, not from being perfect.
                </p>
                <h5>A few things worth remembering</h5>
                <ul>
                  <li>Attach one small habit to an existing routine.</li>
                  <li>Keep your next step clear and achievable.</li>
                  <li>Celebrate showing up, not just finishing.</li>
                </ul>
                <blockquote>A little progress is still progress.</blockquote>
              </div>
            </div>
          )}
          {tab === "Projects" && (
            <div className="c-preview-projects">
              <div className="c-preview-date">
                LESS OVERWHELM. MORE MOMENTUM.
              </div>
              <h3>Make the big things smaller.</h3>
              <p>A clear home for your next big idea.</p>
              <div className="c-preview-board">
                {[
                  {
                    title: "Next up",
                    tasks: [
                      "Gather a little inspiration",
                      "Map out the first step",
                    ],
                  },
                  {
                    title: "In progress",
                    tasks: ["Build something meaningful"],
                  },
                  {
                    title: "Done",
                    tasks: ["Give the idea a name", "Show up for day one"],
                  },
                ].map((column, index) => (
                  <div key={column.title}>
                    <h4>
                      <Circle size={8} />
                      {column.title}
                      <span>{column.tasks.length}</span>
                    </h4>
                    {column.tasks.map((task) => (
                      <article key={task}>
                        <span className={`c-board-label label-${index}`}>
                          {["Planning", "Making progress", "Small win"][index]}
                        </span>
                        <p>{task}</p>
                        <div>
                          <span>Personal growth</span>
                          <ArrowDownRight size={12} />
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="c-preview-caption">
        <span>
          <i /> YOUR SPACE. YOUR PACE.
        </span>
        <span>Interactive product preview</span>
      </div>
    </div>
  );
}
