/**
 * HTML labels over the 3D view: per unit a health bar (when hurt), its level (above 1), "z" while it
 * sleeps or guards and "?" on wandering creatures; plus the floating texts of fx type 'text'
 * ("+200", "Level 3", "Slap!").
 */
import * as THREE from 'three';
import { G } from '../game/state.js';

const v = new THREE.Vector3();

export class Overlay {
    constructor(layer, rig, units) {
        this.layer = layer;
        this.rig = rig;
        this.units = units;
        this.labels = new Map();
        this.texts = new Map();
    }

    label(id) {
        let el = this.labels.get(id);
        if (!el) {
            el = document.createElement('div');
            el.className = 'ulabel';
            el.innerHTML = '<span class="lv"></span><span class="z"></span><span class="bar"><i></i></span>';
            this.layer.appendChild(el);
            this.labels.set(id, el);
        }

        return el;
    }

    update(time) {
        const live = new Set();
        const scale = Math.max(0.6, Math.min(1.6, 14 / this.rig.dist));
        for (const { e, height } of this.units.targets()) {
            const hurt = e.hp < e.maxhp;
            const showLv = e.lvl > 1;
            const z = e.state === 'sleep' || e.state === 'guard';
            if (!hurt && !showLv && !z && e.side !== 2) {
                continue;
            }
            v.set(e.x, height + 0.12, e.y);
            const p = this.rig.toScreen(v);
            if (!p.ok || p.x < -40 || p.y < -40 || p.x > this.rig.width + 40 || p.y > this.rig.height + 40) {
                continue;
            }
            live.add(e.id);
            const el = this.label(e.id);
            el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${scale.toFixed(2)})`;
            el.className = 'ulabel' + (e.side === 1 ? ' hero' : '');
            const lv = el.children[0];
            lv.textContent = e.side === 2 ? '?' : showLv ? e.lvl : '';
            const zz = el.children[1];
            zz.textContent = z ? 'z' : '';
            zz.style.transform = `translateY(${(-((time * 0.8 + e.id) % 1) * 10).toFixed(1)}px)`;
            zz.classList.toggle('guard', e.state === 'guard');
            const bar = el.children[2];
            bar.hidden = !hurt;
            if (hurt) {
                bar.firstChild.style.width = Math.max(0, 100 * e.hp / e.maxhp).toFixed(0) + '%';
            }
        }
        for (const [id, el] of this.labels) {
            if (!live.has(id)) {
                el.remove();
                this.labels.delete(id);
            }
        }
        // floating texts
        const liveFx = new Set();
        for (const f of G.fx) {
            if (f.type !== 'text') {
                continue;
            }
            liveFx.add(f);
            let el = this.texts.get(f);
            if (!el) {
                el = document.createElement('div');
                el.className = 'ftext';
                el.textContent = f.txt;
                el.style.color = f.col;
                this.layer.appendChild(el);
                this.texts.set(f, el);
            }
            const q = f.t / f.dur;
            v.set(f.x, 0.8 + q * 0.6, f.y + 0.3);
            const p = this.rig.toScreen(v);
            el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
            el.style.opacity = String(1 - q * q);
        }
        for (const [f, el] of this.texts) {
            if (!liveFx.has(f)) {
                el.remove();
                this.texts.delete(f);
            }
        }
    }

    clear() {
        for (const el of this.labels.values()) {
            el.remove();
        }
        for (const el of this.texts.values()) {
            el.remove();
        }
        this.labels.clear();
        this.texts.clear();
    }
}
