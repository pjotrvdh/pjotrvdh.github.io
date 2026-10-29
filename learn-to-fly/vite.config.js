import { defineConfig } from 'vite';
import { singleFilePage } from '../tools/vite.js';

// Learn to Fly builds to one self-contained dist/index.html, with its bitmaps and sounds inlined; see tools/vite.js.
export default defineConfig(singleFilePage());
