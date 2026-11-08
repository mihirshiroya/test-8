import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Coffee,
  Command,
  Flame,
  Focus,
  Layers,
  ListTodo,
  LockKeyhole,
  Monitor,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import WelcomeSplit from "../WelcomeSplit";

export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      to="/"
      className={`c-brand ${footer ? "c-brand-footer" : ""}`}
      aria-label="Consistent home"
    >
      <span className="c-brandmark">
        <Layers size={19} strokeWidth={2.5} />
      </span>
      consistent<span className="c-brand-period">.</span>
    </Link>
  );
}

export function IntroSection() {
  return (
    <section
      className="c-section c-intro"
      id="about"
      aria-labelledby="c-about-title"
    >
      <div className="c-section-meta">
        <span className="c-section-kicker">[ A little about us ]</span>
        <span>LESS NOISE. MORE YOU.</span>
      </div>
      <h2 id="c-about-title">
        Big goals don&apos;t need bigger to-do lists.
        <br />
        <span>They need a little </span>
        <em>consistency.</em>
      </h2>
      <p className="c-intro-copy">
        Meet the desktop companion that brings your tasks, focus, and ideas into
        one calm space. Less jumping between apps. More making time for what
        matters.
      </p>
      <div className="c-intro-grid">
        <div className="c-intro-landscape">
          <span className="c-photo-caption">
            A clearer head.
            <br />
            <em>A little more possibility.</em>
          </span>
          <span className="c-photo-bottom">
            <Sparkles size={15} /> Make space for your best work.
          </span>
        </div>
        <div className="c-intro-quote">
          <span className="c-eyebrow">THE CONSISTENT WAY</span>
          <span className="c-big-quote">“</span>
          <p>
            You don&apos;t need to change everything.
            <br />
            <em>Just one small thing, today.</em>
          </p>
          <div className="c-mini-line">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <small>Small steps. Real momentum.</small>
        </div>
        <div className="c-intro-last">
          <div className="c-one-space">
            <span>Built around your day</span>
            <strong>
              One <em>space.</em>
            </strong>
            <div>
              <ListTodo />
              <Focus />
              <BookOpen />
            </div>
          </div>
          <a className="c-black-link" href="#workspace">
            A calmer way to work <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

export function FeatureSections() {
  return (
    <>
      <section
        className="c-section c-feature-section"
        id="features"
        aria-labelledby="c-features-title"
      >
        <div className="c-feature-copy">
          <span className="c-section-kicker">
            [ Everything, a little more connected ]
          </span>
          <h2 id="c-features-title">
            All the things you do.
            <br />
            <em>Finally, together.</em>
          </h2>
          <p>
            Your next step, your best idea, your time to focus. Give them a home
            that doesn&apos;t get in your way.
          </p>
          <div className="c-feature-list">
            <div>
              <ListTodo size={18} />
              <span>
                <strong>A plan you can actually follow</strong>
                <small>
                  Bring your day into focus with tasks and projects.
                </small>
              </span>
            </div>
            <div>
              <BookOpen size={18} />
              <span>
                <strong>A second brain, without the noise</strong>
                <small>Keep notes, Markdown docs, and ideas connected.</small>
              </span>
            </div>
            <div>
              <LockKeyhole size={18} />
              <span>
                <strong>A workspace that feels like yours</strong>
                <small>Thoughtful desktop tools, right where you work.</small>
              </span>
            </div>
          </div>
          <Link className="c-button c-button-dark" to="/register">
            Find your flow <ArrowUpRight size={15} />
          </Link>
        </div>
        <div
          className="c-connected-visual"
          aria-label="Illustration of connected tasks and notes"
        >
          <div className="c-paper-note">
            <span>
              <BookOpen size={14} /> My next big idea <MoreDots />
            </span>
            <h3>
              Make something
              <br />
              <em>worth showing up for.</em>
            </h3>
            <p>Less perfect. More possible.</p>
            <div className="c-paper-rule" />
            <div className="c-paper-rule short" />
            <span className="c-note-tag"># a little inspiration</span>
          </div>
          <div className="c-floating-tasks">
            <span>
              One step closer <span className="c-lime-dot" />
            </span>
            {["Find the spark", "Make a little progress", "Keep going"].map(
              (item, index) => (
                <div key={item}>
                  <span className={index < 2 ? "checked" : ""}>
                    {index < 2 ? <Check size={12} /> : null}
                  </span>
                  {item}
                </div>
              ),
            )}
            <small>
              2 of 3 small wins{" "}
              <span>
                Looking good <ArrowUpRight size={11} />
              </span>
            </small>
          </div>
          <div className="c-sticky-note">
            <Sparkles size={15} />
            <span>
              You&apos;re closer
              <br />
              than you think.
            </span>
          </div>
        </div>
      </section>
      <section
        className="c-focus-section"
        id="focus"
        aria-labelledby="c-focus-title"
      >
        <div className="c-focus-section-inner">
          <div className="c-focus-art">
            <div className="c-floating-notch">
              <span className="c-notch-indicator" />
              <span>Time for your big idea</span>
              <strong>24:59</strong>
              <span className="c-notch-pause">Ⅱ</span>
            </div>
            <div className="c-focus-card">
              <div>
                <span>
                  <Target size={13} /> DEEP WORK
                </span>
                <span className="c-lime-dot" />
              </div>
              <span className="c-focus-time">
                25<span>:</span>00
              </span>
              <span className="c-focus-subtitle">
                A little space to do your thing.
              </span>
              <div className="c-focus-art-button">
                <Focus size={13} /> Just you and what matters{" "}
                <ArrowUpRight size={13} />
              </div>
            </div>
            <div className="c-break-card">
              <Coffee size={18} />
              <span>
                A moment to breathe.
                <small>Your next break is part of the plan.</small>
              </span>
            </div>
          </div>
          <div className="c-feature-copy">
            <span className="c-section-kicker">
              [ A little less distraction ]
            </span>
            <h2 id="c-focus-title">
              Find your focus.
              <br />
              <em>Keep your flow.</em>
            </h2>
            <p>
              Some work needs a little breathing room. Start a focus session,
              settle into one thing, and let everything else wait.
            </p>
            <div className="c-focus-benefits">
              <span>
                <Check size={15} /> A focus timer that stays close
              </span>
              <span>
                <Check size={15} /> A gentle rhythm of work and rest
              </span>
              <span>
                <Check size={15} /> Session history to see your progress
              </span>
            </div>
            <a className="c-text-link" href="#workspace">
              Try the focus preview <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
function MoreDots() {
  return <span aria-hidden="true">···</span>;
}

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Make a little space.",
      text: "Bring your tasks, projects, and ideas together. Start with what’s already on your mind.",
      icon: Layers,
    },
    {
      n: "02",
      title: "Choose what matters.",
      text: "Set a clear intention for today. Not everything at once. Just your next meaningful step.",
      icon: Target,
    },
    {
      n: "03",
      title: "Show up. Then repeat.",
      text: "Find your focus, celebrate a small win, and return tomorrow. That’s how momentum grows.",
      icon: Flame,
    },
  ];
  return (
    <section
      className="c-section c-how"
      id="how-it-works"
      aria-labelledby="c-how-title"
    >
      <div className="c-centered-heading">
        <span className="c-section-kicker">
          [ A simpler kind of productive ]
        </span>
        <h2 id="c-how-title">
          Small steps.
          <br />
          <em>A beautiful way forward.</em>
        </h2>
        <p>
          You don&apos;t need a whole new routine. Just a better place to begin.
        </p>
      </div>
      <div className="c-steps">
        {steps.map(({ n, title, text, icon: Icon }) => (
          <article key={n}>
            <div className="c-step-art">
              <span className="c-step-number">{n}</span>
              <div className="c-step-symbol">
                <Icon size={35} strokeWidth={1.3} />
              </div>
              <span className="c-step-spark">
                <Plus size={20} />
              </span>
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ForYouSection() {
  return (
    <section className="c-section c-for-you" aria-labelledby="c-for-you-title">
      <div className="c-section-meta">
        <span className="c-section-kicker">[ For your kind of everyday ]</span>
        <span>NOT MORE BUSY. MORE INTENTIONAL.</span>
      </div>
      <div className="c-for-you-heading">
        <h2 id="c-for-you-title">
          Made for people.
          <br />
          <em>Not productivity machines.</em>
        </h2>
        <p>
          For the side project you believe in, the skill you&apos;re learning,
          and the everyday things that move life forward.
        </p>
      </div>
      <div className="c-persona-grid">
        {[
          {
            icon: Command,
            title: "The makers.",
            text: "Less context switching. More time to turn a small idea into something real.",
            label: "BUILD WITH INTENTION",
          },
          {
            icon: BookOpen,
            title: "The curious.",
            text: "A home for everything you learn, and a little focus to go a little deeper.",
            label: "STAY A LITTLE CURIOUS",
          },
          {
            icon: Sparkles,
            title: "The everyday dreamers.",
            text: "Big plans, small habits. Find your own rhythm, one ordinary day at a time.",
            label: "GROW AT YOUR OWN PACE",
          },
        ].map(({ icon: Icon, title, text, label }) => (
          <article key={title}>
            <Icon size={23} strokeWidth={1.3} />
            <h3>{title}</h3>
            <p>{text}</p>
            <span>
              {label} <ArrowUpRight size={13} />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FaqSection() {
  const questions = [
    {
      question: "What is Consistent?",
      answer:
        "Consistent is a calm productivity workspace for your tasks, projects, notes, and focus sessions. It brings the everyday tools you need into one place, so you can spend less energy organizing and more energy doing.",
    },
    {
      question: "Is Consistent a desktop app?",
      answer:
        "Yes. Consistent is being built as a desktop companion, with a floating focus timer and a workspace for your daily work. Desktop downloads are being prepared; you can create an account and explore the web workspace today.",
    },
    {
      question: "Can I keep my notes and projects together?",
      answer:
        "Absolutely. Organize your ideas into topics, write Markdown documentation, and manage your projects in the same workspace. Your next step and the context behind it stay close together.",
    },
    {
      question: "How does the focus timer work?",
      answer:
        "Choose a task, start a focus session, and give one thing your attention. The desktop floating timer keeps your session visible while you work, and your session history helps you see where your time went.",
    },
    {
      question: "Do I need a perfect routine to get started?",
      answer:
        "Not at all. Add one task, write down one idea, or start one focus session. Consistent is built around returning to what matters—not keeping up with an impossible routine.",
    },
  ];
  return (
    <section className="c-section c-faq" id="faq" aria-labelledby="c-faq-title">
      <div>
        <span className="c-section-kicker">
          [ A few things you might be wondering ]
        </span>
        <h2 id="c-faq-title">
          Good questions.
          <br />
          <em>Simple answers.</em>
        </h2>
        <div className="c-faq-aside">
          <span className="c-brandmark">
            <Layers size={18} />
          </span>
          <p>
            Less friction.
            <br />
            More forward.
          </p>
          <a className="c-text-link" href="#get-started">
            Let&apos;s get you started <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      <div className="c-faq-list">
        {questions.map(({ question, answer }, index) => (
          <details key={question} name="consistent-faq" open={index === 0}>
            <summary>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{question}</h3>
              <Plus size={17} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function BottomSection() {
  return (
    <>
     
      <footer className="c-footer">
        <div className="c-footer-top">
          <Brand footer />
          <a href="#top" className="c-back-top" aria-label="Back to top">
            <ArrowUpRight size={19} />
          </a>
        </div>
        <div className="c-footer-columns">
          <div>
            <p>
              A little better.
              <br />
              <em>A little more you.</em>
            </p>
            <span>Your calm companion for meaningful progress.</span>
          </div>
          <div>
            <h3>Explore</h3>
            <a href="#features">The features</a>
            <a href="#workspace">The workspace</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <div>
            <h3>A little more</h3>
            <a href="#about">Our philosophy</a>
            <a href="#faq">Common questions</a>
            <Link to="/login">
              Your workspace <ChevronRight size={12} />
            </Link>
          </div>
          <div className="c-footer-tag">
            <span className="c-footer-status">
              <i /> BUILT FOR YOUR EVERYDAY
            </span>
            <p>
              Less noise.
              <br />
              More possibility.
            </p>
          </div>
        </div>
        <div className="c-footer-wordmark" aria-hidden="true">
          consistent<span>®</span>
        </div>
        <div className="c-footer-bottom">
          <span>
            © {new Date().getFullYear()} Consistent. A little progress, every
            day.
          </span>
          <span>Thoughtfully made. Intentionally simple.</span>
        </div>
      </footer>
    </>
  );
}
