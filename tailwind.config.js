/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Redesign tokens (iOS grouped-list). `accent` replaces indigo app-wide.
        accent: {
          DEFAULT: '#1D7A47',
          pressed: '#155C35',
          // Accent legible on a dark ground — the saved-toast amount only.
          tint: '#8FD9AE',
        },
        // iOS systemGroupedBackground: the ground every list/dashboard sits on.
        canvas: '#F2F2F7',
        surface: {
          DEFAULT: '#FFFFFF',
          // Tab bar and review footer. Pair with `.chrome-blur`.
          chrome: 'rgba(249, 249, 251, 0.94)',
        },
        // Divider *inside* a grouped card. Lighter than `border`, which
        // separates a card or control from the canvas.
        hairline: '#EBEBF0',
        border: {
          DEFAULT: '#D8D8DC',
          strong: '#C8C8CE',
        },
        ink: {
          DEFAULT: '#000000',
          // Secondary: field labels, row metadata.
          2: '#8A8A8E',
          // Tertiary: disclosure values, chart axis labels.
          3: '#A9A9AE',
          // Chevrons.
          4: '#C4C4C8',
          // Inactive segmented-control label, month section headers.
          muted: '#6E6E73',
        },
        'bar-idle': '#DCDCE0',
        track: '#E9E9EB',
        chip: '#EEEEF1',
        warn: {
          DEFAULT: '#E08A2E',
          // 4.6:1 on `warn-bg` — do not lighten.
          ink: '#B8641E',
          bg: '#FFFBF2',
        },
        danger: '#C0392B',

        aldi: {
          orange: '#FF6600',
          blue: '#00559F',
        },
        publix: {
          green: '#008C00',
        },
        walmart: {
          blue: '#0071CE',
        },
        costco: {
          red: '#E31837',
          blue: '#005DAA',
        },
      },
      // Named roles rather than raw sizes, so a screen reads as its spec.
      // Each carries its line-height, tracking and weight from the handoff.
      fontSize: {
        'title-lg': ['34px', { lineHeight: '1.1', letterSpacing: '-0.8px', fontWeight: '700' }],
        'title-detail': ['30px', { lineHeight: '1.15', letterSpacing: '-0.7px', fontWeight: '700' }],
        hero: ['40px', { lineHeight: '1', letterSpacing: '-1.5px', fontWeight: '600' }],
        'total-lg': ['28px', { lineHeight: '1', letterSpacing: '-1px', fontWeight: '600' }],
        nav: ['17px', { lineHeight: '1' }],
        // Never below 16px: iOS Safari zooms the viewport on focus under that.
        field: ['17px', { lineHeight: '1.2' }],
        row: ['16px', { lineHeight: '1.2' }],
        amount: ['16px', { lineHeight: '1', fontWeight: '500' }],
        section: ['15px', { lineHeight: '1', fontWeight: '600' }],
        'chip-label': ['14px', { lineHeight: '1', fontWeight: '500' }],
        meta: ['13px', { lineHeight: '1.2' }],
        seg: ['13px', { lineHeight: '1', fontWeight: '500' }],
        label: ['11px', { lineHeight: '1' }],
        group: ['11px', { lineHeight: '1', letterSpacing: '0.6px' }],
        flag: ['11px', { lineHeight: '1', letterSpacing: '0.4px', fontWeight: '600' }],
        tab: ['11px', { lineHeight: '1.6' }],
      },
      borderRadius: {
        card: '16px',
        'card-sm': '14px',
        input: '10px',
        button: '13px',
        chip: '14px',
        seg: '10px',
        'seg-thumb': '8px',
        fab: '29px',
      },
      spacing: {
        // 18px body padding, 22px above a section header, 26px tab-bar bottom,
        // 30px review-footer bottom — the rhythm values Tailwind's scale lacks.
        4.5: '18px',
        5.5: '22px',
        6.5: '26px',
        7.5: '30px',
      },
      boxShadow: {
        fab: '0 8px 22px rgba(29, 122, 71, 0.4)',
      },
      transitionTimingFunction: {
        // iOS sheet/disclosure curve — used by the review row expand.
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
