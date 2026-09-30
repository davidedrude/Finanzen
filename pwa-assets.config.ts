import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const bg = { background: '#1f6f6b' };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Vollflächiger Hintergrund in der Akzentfarbe (iOS rundet selbst ab)
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: bg },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: bg },
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
  },
  images: ['public/logo.svg'],
});
