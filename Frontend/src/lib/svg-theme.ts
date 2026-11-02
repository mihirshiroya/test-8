/**
 * svg-theme.ts — light/dark theming for your 3-layer SVG illustrations.
 *
 * Your SVGs only use 3-4 flat colors: cream background, green accent,
 * near-black ink (and a pale-green tint in 05 & 19). Every slightly different
 * shade (#5dda99, #61da99, #74dca4 ...) is classified into a ROLE, then each
 * role is mapped to a theme color.
 */

// ---- 1. Palette per theme (edit these to restyle everything) -------------

import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type ThemeName = 'light' | 'dark';

export type ThemeColors = {
  bg: string;
  ink: string;
  accent: string;
  soft: string;
};

export const THEMES: Record<ThemeName, ThemeColors> = {
light: {
  bg: '#f1ebdf',
  ink: '#1a2317',
  accent: '#65ABC4',
  soft: '#C4E1EC',
},

dark: {
  bg: '#171c1f',
  ink: '#f1ebdf',
  accent: '#65ABC4',
  soft: '#344F5A',
},
};






// ---- 2. Classify any hex color into a role -------------------------------

export type SvgColorRole = 'ink' | 'bg' | 'accent' | 'soft';

function hexToHsl(hex: string): [number, number, number] {
  let h = hex.replace('#', '');

  if (h.length === 3) {
    h = [...h]
      .map((c) => c + c)
      .join('');
  }

  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(h.slice(i, i + 2), 16) / 255,
  );

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  const l = (max + min) / 2;

  const s =
    d === 0
      ? 0
      : d / (1 - Math.abs(2 * l - 1));

  let hue = 0;

  if (d) {
    if (max === r) {
      hue = ((g - b) / d) % 6;
    } else if (max === g) {
      hue = (b - r) / d + 2;
    } else {
      hue = (r - g) / d + 4;
    }

    hue = (hue * 60 + 360) % 360;
  }

  return [hue, s, l];
}

export function classify(hex: string): SvgColorRole | null {
  const [h, s, l] = hexToHsl(hex);

  if (l < 0.28) {
    return 'ink';
  }

  if (l > 0.88) {
    return 'bg';
  }

  if (h > 80 && h < 180 && s > 0.25) {
    return l > 0.76 ? 'soft' : 'accent';
  }

  return null;
}

// ---- 3. Walk the SVG and rewrite fill / stroke ----------------------------

const HEX = /^#[0-9a-f]{3,8}$/i;

type ColorRewriter = (
  role: SvgColorRole,
  originalColor: string,
) => string;

function rewrite(
  svgText: string,
  onColor: ColorRewriter,
): string {
  const doc = new DOMParser().parseFromString(
    svgText,
    'image/svg+xml',
  );

  const svg = doc.documentElement;

  if (
    svg.nodeName === 'parsererror' ||
    doc.querySelector('parsererror')
  ) {
    throw new Error('Invalid SVG');
  }

  svg.removeAttribute('width');
  svg.removeAttribute('height');

  svg.setAttribute(
    'preserveAspectRatio',
    'xMidYMid meet',
  );

  svg.setAttribute('role', 'img');

  svg.querySelectorAll('*').forEach((el) => {
    const styles: string[] = [];

    for (const attr of ['fill', 'stroke'] as const) {
      const value = el.getAttribute(attr);

      if (!value || !HEX.test(value)) {
        continue;
      }

      const role = classify(value);

      if (!role) {
        continue;
      }

      el.removeAttribute(attr);

      styles.push(
        `${attr}:${onColor(role, value)}`,
      );
    }

    if (styles.length) {
      const existingStyle = el.getAttribute('style') || '';

      el.setAttribute(
        'style',
        styles.join(';') + existingStyle,
      );
    }
  });

  return new XMLSerializer().serializeToString(svg);
}

/**
 * A) LIVE mode (inline <svg> in the DOM).
 *
 * Colors become CSS variables, so switching theme =
 * changing 4 variables.
 *
 * No re-parsing, no re-render, works with prefers-color-scheme too.
 */

export function themeSvg(svgText: string): string {
  return rewrite(
    svgText,
    (role, originalColor) =>
      `var(--svg-${role},${originalColor})`,
  );
}

function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const update = (): void => {
      if (root.classList.contains('dark')) {
        setIsDark(true);
      } else if (root.classList.contains('light')) {
        setIsDark(false);
      } else {
        setIsDark(mediaQuery.matches);
      }
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    mediaQuery.addEventListener('change', update);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', update);
    };
  }, []);

  return isDark;
}

export type ThemedSvgProps = {
  raw: string;
  className?: string;
  ariaLabel?: string;
  transparentBg?: boolean;
};

export function ThemedSvg({
  raw,
  className,
  ariaLabel = 'Illustration',
  transparentBg = true,
}: ThemedSvgProps): ReactNode {
  const isDark = useIsDarkTheme();
  const html = useMemo(() => themeSvg(raw), [raw]);
  const theme = THEMES[isDark ? 'dark' : 'light'];
  const variables = {
    '--svg-ink': theme.ink,
    '--svg-accent': theme.accent,
    '--svg-soft': theme.soft,
    '--svg-bg': transparentBg ? 'transparent' : theme.bg,
  } as CSSProperties;

  return React.createElement('div', {
    className,
    style: variables,
    role: 'img',
    'aria-label': ariaLabel,
    dangerouslySetInnerHTML: { __html: html },
  });
}

export function applyTheme(
  el: HTMLElement,
  themeName: ThemeName,
): void {
  const theme = THEMES[themeName];

  for (const key in theme) {
    const value = theme[key as keyof ThemeColors];

    el.style.setProperty(
      `--svg-${key}`,
      value,
    );
  }
}

/**
 * B) STATIC mode (for <img src>, data URIs, downloads, emails).
 *
 * Returns a new SVG string with the theme's real colors baked in.
 * CSS variables can't cross the <img> boundary, so use this there.
 */

export type TransformSvgOptions = {
  transparentBg?: boolean;
};

export function transformSvg(
  svgText: string,
  themeName: ThemeName = 'light',
  {
    transparentBg = false,
  }: TransformSvgOptions = {},
): string {
  const theme = THEMES[themeName];

  return rewrite(
    svgText,
    (role) =>
      role === 'bg' && transparentBg
        ? 'none'
        : theme[role],
  );
}

export function toDataUri(svgText: string): string {
  return (
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(svgText)
  );
}

// ---- 4. Theme state: 'system' | 'light' | 'dark' --------------------------

export type ThemePreference = 'system' | ThemeName;

export function resolveTheme(
  preference: ThemePreference,
): ThemeName {
  if (
    preference === 'light' ||
    preference === 'dark'
  ) {
    return preference;
  }

  return window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches
    ? 'dark'
    : 'light';
}

export function watchSystemTheme(
  callback: (theme: ThemeName) => void,
): () => void {
  const mediaQuery = window.matchMedia(
    '(prefers-color-scheme: dark)',
  );

  const handleChange = (): void => {
    callback(
      mediaQuery.matches ? 'dark' : 'light',
    );
  };

  mediaQuery.addEventListener(
    'change',
    handleChange,
  );

  return () => {
    mediaQuery.removeEventListener(
      'change',
      handleChange,
    );
  };
}
