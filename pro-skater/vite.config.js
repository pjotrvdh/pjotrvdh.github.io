import { defineConfig } from 'vite';
import { singleFilePage } from '../tools/vite.js';

// Pro Skater builds to one self-contained dist/index.html, with its 3D models next to it in
// dist/models (loaded at run time); see tools/vite.js.
export default defineConfig(singleFilePage({ copy: ['models'] }));
