import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  Menu,
  Monitor,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import DesktopPreview from "../components/Landing/DesktopPreview";
import {
  Brand,
  BottomSection,
  FaqSection,
  FeatureSections,
  ForYouSection,
  HowItWorks,
  IntroSection,
} from "../components/Landing/LandingSections";
import "./Landing.css";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = [
    { name: "The difference", href: "#about" },
    { name: "Features", href: "#features" },
    { name: "How it works", href: "#how-it-works" },
    { name: "FAQs", href: "#faq" },
  ];
  return (
    <div className="consistent-landing" id="top">
      <a className="c-skip-link" href="#main">
        Skip to content
      </a>
      <main id="main">
        <section className="c-hero" aria-labelledby="c-hero-title">
          <img
            className="c-hero-image"
            src="/consistent-sky.png"
            alt=""
            fetchPriority="high"
          />
          <div className="c-hero-wash" />
          <header className="c-header">
            <Brand />
            <nav className="c-desktop-links" aria-label="Main navigation">
              {navigation.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.name}
                </a>
              ))}
            </nav>
            <div className="c-header-actions">
              <Link className="c-login" to="/login">
                Log in
              </Link>
              <Link to="/register" className="c-header-cta">
                Get started <ArrowUpRight size={14} />
              </Link>
              <button
                className="c-mobile-toggle"
                type="button"
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={menuOpen}
                aria-controls="c-mobile-menu"
                onClick={() => setMenuOpen((value) => !value)}
              >
                {menuOpen ? <X size={19} /> : <Menu size={19} />}
              </button>
            </div>
            {menuOpen && (
              <nav
                className="c-mobile-menu"
                id="c-mobile-menu"
                aria-label="Mobile navigation"
              >
                {navigation.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.name}
                    <ChevronRight size={14} />
                  </a>
                ))}
              </nav>
            )}
          </header>
          <div className="c-hero-content">
            <span className="c-hero-badge">
              <span className="c-lime-dot" /> A little less busy. A little more
              you.
            </span>
            <h1 id="c-hero-title">
              Small steps.
              <br />
              <span>Extraordinary </span>
              <em>consistency.</em>
            </h1>
            <p>
              Your tasks, focus, and ideas. Finally in one calm space.
              <br className="c-desktop-br" /> Make room for the things that move
              you forward.
            </p>
            <div className="c-hero-buttons">
              <Link to="/register" className="c-button c-button-lime">
                Find your everyday flow <ArrowUpRight size={17} />
              </Link>
              <a href="#workspace" className="c-button c-button-glass">
                Meet Consistent <ArrowDown size={15} />
              </a>
            </div>
            <span className="c-hero-platform">
              <Monitor size={12} /> A thoughtful desktop companion. A calmer
              kind of productive.
            </span>
          </div>
          <div className="c-hero-showcase">
            <div className="c-floating-win">
              <span>
                <Sparkles size={13} /> SMALL STEPS, BIG DIFFERENCE
              </span>
              <strong>
                You showed up.
                <br />
                <em>That&apos;s what counts.</em>
              </strong>
              <div className="c-week-dots">
                {["M", "T", "W", "T", "F"].map((day, index) => (
                  <span key={index}>
                    <i>
                      <Check size={11} />
                    </i>
                    {day}
                  </span>
                ))}
                <span>
                  <i className="is-today">S</i>Today
                </span>
                <span>
                  <i className="is-future">S</i>Sun
                </span>
              </div>
            </div>
            <div className="c-hero-preview">
              <DesktopPreview />
            </div>
            <div className="c-floating-focus">
              <span className="c-lime-dot" />
              <span>
                In your own rhythm.<small>One thing at a time.</small>
              </span>
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="c-hero-bottom">
            <span>A LITTLE PROGRESS. EVERY DAY.</span>
            <a href="#about">
              A fresh perspective <ArrowDown size={13} />
            </a>
            <span>DESIGNED TO FEEL DIFFERENT.</span>
          </div>
        </section>
        <div className="c-values-strip">
          <span>
            Less juggling.<strong>More doing.</strong>
          </span>
          <i />
          <span>
            Less noise.<strong>More clarity.</strong>
          </span>
          <i />
          <span>
            Less pressure.<strong>More progress.</strong>
          </span>
          <i />
          <span>
            One workspace.<strong>Your own pace.</strong>
          </span>
        </div>
        <IntroSection />
        <section
          className="c-workspace-section"
          id="workspace"
          aria-labelledby="c-workspace-title"
        >
          <div className="c-centered-heading">
            <span className="c-section-kicker">
              [ Welcome to your clear headspace ]
            </span>
            <h2 id="c-workspace-title">
              A home for your day.
              <br />
              <em>And everything it could be.</em>
            </h2>
            <p>
              Plan it. Focus on it. Write it down. Make it happen.
              <br />
              Try the pages below. This space is yours to explore.
            </p>
          </div>
          <div className="c-workspace-preview">
            <DesktopPreview />
          </div>
          <span className="c-preview-footnote">
            <span className="c-lime-dot" /> A little look inside. Select a page
            to explore the interactive preview.
          </span>
        </section>
        <FeatureSections />
        <HowItWorks />
        <ForYouSection />
        <FaqSection />
        <BottomSection />
      </main>
    </div>
  );
}
