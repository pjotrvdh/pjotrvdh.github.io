/**
 * Sharing an online room: the link prefilled for WhatsApp, Telegram, a text message or an e-mail,
 * "More…" for the device's own share menu where the browser has one, copying the link, and a QR code.
 */
import qrcode from 'qrcode-generator';
import { $ } from './context.js';

/** Draws the room link as a QR code: dark squares on white, with the quiet zone around it scanners need. */
function drawQr(svg, text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4;
    let d = '';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
            }
        }
    }
    const size = count + 2 * quiet;
    const ns = 'http://www.w3.org/2000/svg';
    const background = document.createElementNS(ns, 'rect');
    background.setAttribute('width', String(size));
    background.setAttribute('height', String(size));
    background.setAttribute('fill', '#fff');
    const modules = document.createElementNS(ns, 'path');
    modules.setAttribute('d', d);
    modules.setAttribute('fill', '#000');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.replaceChildren(background, modules);
}

/** Points the share options and the QR code at the room link. */
export function fillShare(link) {
    const text = `Play Twistball with me! Room ${$('roomCode').textContent}: ${link}`;
    $('shareWhatsApp').href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    $('shareTelegram').href = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Play Twistball with me!')}`;
    $('shareSms').href = `sms:?&body=${encodeURIComponent(text)}`;
    $('shareMail').href = `mailto:?subject=${encodeURIComponent('Play Twistball with me')}&body=${encodeURIComponent(text)}`;
    $('shareMoreItem').hidden = !navigator.share;
    drawQr($('shareQr'), link);
}

/** Wires the copy and More… buttons. */
export function initShare() {
    $('copyLink').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText($('roomLink').value);
            $('onlineStatus').textContent = 'Link copied. Waiting for the other player…';
        } catch {
            $('roomLink').select();
        }
    });
    $('shareMore').addEventListener('click', async () => {
        try {
            await navigator.share({ title: 'Twistball', text: 'Play Twistball with me!', url: $('roomLink').value });
        } catch {
            // Cancelled.
        }
    });
}
