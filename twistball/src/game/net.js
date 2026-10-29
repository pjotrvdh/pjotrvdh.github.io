/**
 * Online play over WebRTC with PeerJS. The free PeerJS cloud server introduces the two players;
 * after that the messages go straight from one browser to the other. PeerJS's default settings
 * include STUN and TURN servers, so it also works behind most routers.
 *
 * The host picks a room code, which becomes its peer ID (with a prefix); the guest connects to it.
 * Everything else (the game itself) lives in game.js: this module only moves messages.
 */
import { Peer } from 'peerjs';

const PREFIX = 'twistball-arcade-';
/** No 0/O, 1/I or similar look-alikes, so codes are easy to read out and type. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

export function randomCode() {
    let code = '';
    for (let index = 0; index < CODE_LENGTH; index++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }

    return code;
}

/** Turns what someone typed into a code: upper case, only the allowed characters. */
export function cleanCode(text) {
    return [...String(text).toUpperCase()].filter((character) => ALPHABET.includes(character)).join('').slice(0, CODE_LENGTH);
}

export const isValidCode = (code) => code.length === CODE_LENGTH;

/** Readable messages for the errors PeerJS reports. */
function describe(error) {
    switch (error?.type) {
        case 'unavailable-id': return 'That room code is already in use. Try again for a new one.';
        case 'peer-unavailable': return 'No room with that code. Check the code and try again.';
        case 'network':
        case 'server-error':
        case 'socket-error':
        case 'socket-closed': return 'Could not reach the matchmaking server. Check your connection and try again.';
        case 'browser-incompatible': return 'This browser does not support online play.';
        default: return 'The connection failed. Try again.';
    }
}

/**
 * One online session: as the host (`create`) or as the guest (`join`).
 *
 * @param {{onOpen: () => void, onMessage: (message: object) => void, onClose: (reason: string) => void}} handlers
 */
export function createSession(handlers) {
    let peer = null;
    let connection = null;
    let closed = false;

    function close(reason = '') {
        if (closed) {
            return;
        }
        closed = true;
        connection?.close();
        peer?.destroy();
        handlers.onClose(reason);
    }

    function wire(conn) {
        connection = conn;
        conn.on('open', () => handlers.onOpen());
        conn.on('data', (message) => {
            if (message && typeof message === 'object') {
                handlers.onMessage(message);
            }
        });
        conn.on('close', () => close('The other player left.'));
        conn.on('error', (error) => close(describe(error)));
    }

    return {
        /** Opens a room with the given code and waits for one guest. */
        create(code) {
            peer = new Peer(PREFIX + code, { debug: 0 });
            peer.on('connection', (conn) => {
                if (connection) {
                    // The room is full: one guest only.
                    conn.on('open', () => conn.close());

                    return;
                }
                wire(conn);
            });
            peer.on('error', (error) => close(describe(error)));
            peer.on('disconnected', () => {
                // Lost the matchmaking server; a running game keeps going over the direct connection.
                if (!connection && !closed) {
                    peer.reconnect();
                }
            });
        },

        /** Joins the room with the given code. */
        join(code) {
            peer = new Peer({ debug: 0 });
            peer.on('open', () => wire(peer.connect(PREFIX + code, { serialization: 'json', reliable: true })));
            peer.on('error', (error) => close(describe(error)));
        },

        send(message) {
            if (connection?.open) {
                connection.send(message);
            }
        },

        close,

        get isOpen() {
            return Boolean(connection?.open);
        },
    };
}
