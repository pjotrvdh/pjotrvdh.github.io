import { defineConfig } from 'vite';
import { singleFilePage } from '../tools/vite.js';

// Twistball builds to one self-contained dist/index.html; see tools/vite.js.
export default defineConfig(singleFilePage());
