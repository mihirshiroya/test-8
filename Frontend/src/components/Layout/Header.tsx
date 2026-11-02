import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/logo.png';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(false);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))]">
      <div className="notion-container flex h-16 items-center justify-between">

        {/* =====================================================
            Logo
        ====================================================== */}
        <Link
          to="/"
          className="flex items-center text-[rgb(var(--color-text-primary))]
                     transition-colors duration-150 hover:text-[rgb(var(--color-primary))]"
        >
          <img
            src={logo}
            alt="Logo"
            className="h-8 w-8 object-cover"
          />

          <span
            className="font-[var(--font-notion)]
                       text-lg
                       font-semibold
                       tracking-[-0.2px]"
          >
            ocxhub
          </span>
        </Link>

        {/* =====================================================
            Desktop Navigation
        ====================================================== */}
        <nav className="hidden items-center gap-6 md:flex">

          {isAuthenticated ? (
            <>
              {/* Dashboard */}
              <Link
                to="/dashboard"
                className="font-[var(--font-notion)]
                           text-sm
                           font-medium
                           text-[rgb(var(--color-steel))]
                           transition-colors
                           duration-150
                           hover:text-[rgb(var(--color-text-primary))]"
              >
                Dashboard
              </Link>

              {/* Profile */}
              <Link
                to="/profile"
                className="font-[var(--font-notion)]
                           text-sm
                           font-medium
                           text-[rgb(var(--color-steel))]
                           transition-colors
                           duration-150
                           hover:text-[rgb(var(--color-text-primary))]"
              >
                Profile
              </Link>

              {/* User Menu */}
              <div className="relative">

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2
                             rounded-[var(--radius-md)]
                             px-2 py-1.5
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             text-[rgb(var(--color-text-primary))]
                             transition-colors
                             duration-150
                             hover:bg-[rgb(var(--color-surface))]"
                >
                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 shrink-0
                               items-center justify-center
                               overflow-hidden
                               rounded-full
                               bg-[rgb(var(--color-card-tint-lavender))]
                               text-xs
                               font-semibold
                               text-[rgb(var(--color-brand-purple-800))]"
                  >
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user?.firstName?.charAt(0)?.toUpperCase()
                    )}
                  </div>

                  <span className="max-w-[120px] truncate">
                    {user?.firstName}
                  </span>

                  {/* Chevron */}
                  <svg
                    className={`h-4 w-4 text-[rgb(var(--color-steel))]
                               transition-transform duration-150
                               ${isMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* =================================================
                    Dropdown
                ================================================== */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56
                               overflow-hidden
                               rounded-[var(--radius-lg)]
                               border border-[rgb(var(--color-border))]
                               bg-[rgb(var(--color-canvas))]
                               p-1.5
                               shadow-[var(--shadow-modal)]"
                  >
                    {/* User information */}
                    <div
                      className="mb-1 border-b
                                 border-[rgb(var(--color-border-soft))]
                                 px-3 py-2.5"
                    >
                      <p
                        className="truncate
                                   font-[var(--font-notion)]
                                   text-sm
                                   font-medium
                                   text-[rgb(var(--color-text-primary))]"
                      >
                        {user?.firstName}
                      </p>

                      {user?.email && (
                        <p
                          className="mt-0.5 truncate
                                     font-[var(--font-notion)]
                                     text-xs
                                     text-[rgb(var(--color-steel))]"
                        >
                          {user.email}
                        </p>
                      )}
                    </div>

                    {/* Profile */}
                    <Link
                      to="/profile"
                      className="flex items-center
                                 rounded-[var(--radius-sm)]
                                 px-3 py-2
                                 font-[var(--font-notion)]
                                 text-sm
                                 text-[rgb(var(--color-text-primary))]
                                 transition-colors
                                 duration-150
                                 hover:bg-[rgb(var(--color-surface))]"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Profile Settings
                    </Link>

                    {/* Security */}
                    <Link
                      to="/security"
                      className="flex items-center
                                 rounded-[var(--radius-sm)]
                                 px-3 py-2
                                 font-[var(--font-notion)]
                                 text-sm
                                 text-[rgb(var(--color-text-primary))]
                                 transition-colors
                                 duration-150
                                 hover:bg-[rgb(var(--color-surface))]"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Security
                    </Link>

                    {/* Sign Out */}
                    <div
                      className="mt-1 border-t
                                 border-[rgb(var(--color-border-soft))]
                                 pt-1"
                    >
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center
                                   rounded-[var(--radius-sm)]
                                   px-3 py-2
                                   text-left
                                   font-[var(--font-notion)]
                                   text-sm
                                   text-[rgb(var(--color-error))]
                                   transition-colors
                                   duration-150
                                   hover:bg-[rgb(var(--color-card-tint-rose))]"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Sign In */}
              <Link
                to="/login"
                className="font-[var(--font-notion)]
                           text-sm
                           font-medium
                           text-[rgb(var(--color-steel))]
                           transition-colors
                           duration-150
                           hover:text-[rgb(var(--color-text-primary))]"
              >
                Sign In
              </Link>

              {/* Primary CTA */}
              <Link
                to="/register"
                className="rounded-[var(--radius-md)]
                           bg-[rgb(var(--color-primary))]
                           px-[18px]
                           py-2.5
                           font-[var(--font-notion)]
                           text-sm
                           font-medium
                           leading-[1.3]
                           text-white
                           transition-colors
                           duration-150
                           hover:bg-[rgb(var(--color-primary-pressed))]
                           active:bg-[rgb(var(--color-primary-deep))]"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>

        {/* =====================================================
            Mobile Menu Button
        ====================================================== */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex h-9 w-9
                     items-center justify-center
                     rounded-[var(--radius-md)]
                     text-[rgb(var(--color-text-primary))]
                     transition-colors
                     duration-150
                     hover:bg-[rgb(var(--color-surface))]
                     md:hidden"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* =======================================================
          Mobile Navigation
      ======================================================== */}
      {isMenuOpen && (
        <div
          className="border-t border-[rgb(var(--color-border-soft))]
                     bg-[rgb(var(--color-canvas))]
                     md:hidden"
        >
          <div className="notion-container py-3">

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="block rounded-[var(--radius-sm)]
                             px-3 py-2.5
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             text-[rgb(var(--color-text-primary))]
                             hover:bg-[rgb(var(--color-surface))]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>

                <Link
                  to="/profile"
                  className="block rounded-[var(--radius-sm)]
                             px-3 py-2.5
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             text-[rgb(var(--color-text-primary))]
                             hover:bg-[rgb(var(--color-surface))]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>

                <Link
                  to="/security"
                  className="block rounded-[var(--radius-sm)]
                             px-3 py-2.5
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             text-[rgb(var(--color-text-primary))]
                             hover:bg-[rgb(var(--color-surface))]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Security
                </Link>

                <div
                  className="my-2 border-t
                             border-[rgb(var(--color-border-soft))]"
                />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-[var(--radius-sm)]
                             px-3 py-2.5
                             text-left
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             text-[rgb(var(--color-error))]
                             hover:bg-[rgb(var(--color-card-tint-rose))]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block rounded-[var(--radius-sm)]
                             px-3 py-2.5
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             text-[rgb(var(--color-text-primary))]
                             hover:bg-[rgb(var(--color-surface))]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>

                <Link
                  to="/register"
                  className="mt-2 block
                             rounded-[var(--radius-md)]
                             bg-[rgb(var(--color-primary))]
                             px-[18px]
                             py-2.5
                             text-center
                             font-[var(--font-notion)]
                             text-sm
                             font-medium
                             leading-[1.3]
                             text-white
                             hover:bg-[rgb(var(--color-primary-pressed))]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}

          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

