// Copyright 2006 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Constant declarations for common key codes.
 *
 * @author eae@google.com (Emil A Eklund)
 * @see ../demos/keyhandler.html
 */

import {userAgent} from "./useragent.ts";
type BrowserEvent = MouseEvent|KeyboardEvent|SubmitEvent|Event|InputEvent|FocusEvent;
/**
 * Key codes for common characters.
 *
 * This list is not localized and therefore some of the key codes are not
 * correct for non US keyboard layouts. See comments below.
 *
 * @enum {number}
 */
export class Keys {
    static ENTER = "Enter";
    static SHIFT = "Enter";
}
export class KeyCodes {
    static readonly WIN_KEY_FF_LINUX = 0;
    static readonly MAC_ENTER = 3;
    static readonly BACKSPACE = 8;
    static readonly TAB = 9;
    static readonly NUM_CENTER = 12;  // NUMLOCK on FF/Safari Mac
    static readonly ENTER = 13;
    static readonly SHIFT = 16;
    static readonly CTRL = 17;
    static readonly ALT = 18;
    static readonly PAUSE = 19;
    static readonly CAPS_LOCK = 20;
    static readonly ESC = 27;
    static readonly SPACE = 32;
    static readonly PAGE_UP = 33;    // also NUM_NORTH_EAST
    static readonly PAGE_DOWN = 34;  // also NUM_SOUTH_EAST
    static readonly END = 35;        // also NUM_SOUTH_WEST
    static readonly HOME = 36;       // also NUM_NORTH_WEST
    static readonly LEFT = 37;       // also NUM_WEST
    static readonly UP = 38;         // also NUM_NORTH
    static readonly RIGHT = 39;      // also NUM_EAST
    static readonly DOWN = 40;       // also NUM_SOUTH
    static readonly PLUS_SIGN = 43;  // NOT numpad plus
    static readonly PRINT_SCREEN = 44;
    static readonly INSERT = 45;  // also NUM_INSERT
    static readonly DELETE = 46;  // also NUM_DELETE
    static readonly ZERO = 48;
    static readonly ONE = 49;
    static readonly TWO = 50;
    static readonly THREE = 51;
    static readonly FOUR = 52;
    static readonly FIVE = 53;
    static readonly SIX = 54;
    static readonly SEVEN = 55;
    static readonly EIGHT = 56;
    static readonly NINE = 57;
    static readonly FF_SEMICOLON = 59;   // Firefox (Gecko) fires this for semicolon instead of 186
    static readonly FF_EQUALS = 61;      // Firefox (Gecko) fires this for equals instead of 187
    static readonly FF_DASH = 173;       // Firefox (Gecko) fires this for dash instead of 189
    static readonly QUESTION_MARK = 63;  // needs localization
    static readonly AT_SIGN = 64;
    static readonly A = 65;
    static readonly B = 66;
    static readonly C = 67;
    static readonly D = 68;
    static readonly E = 69;
    static readonly F = 70;
    static readonly G = 71;
    static readonly H = 72;
    static readonly I = 73;
    static readonly J = 74;
    static readonly K = 75;
    static readonly L = 76;
    static readonly M = 77;
    static readonly N = 78;
    static readonly O = 79;
    static readonly P = 80;
    static readonly Q = 81;
    static readonly R = 82;
    static readonly S = 83;
    static readonly T = 84;
    static readonly U = 85;
    static readonly V = 86;
    static readonly W = 87;
    static readonly X = 88;
    static readonly Y = 89;
    static readonly Z = 90;
    static readonly META = 91;  // WIN_KEY_LEFT
    static readonly WIN_KEY_RIGHT = 92;
    static readonly CONTEXT_MENU = 93;
    static readonly NUM_ZERO = 96;
    static readonly NUM_ONE = 97;
    static readonly NUM_TWO = 98;
    static readonly NUM_THREE = 99;
    static readonly NUM_FOUR = 100;
    static readonly NUM_FIVE = 101;
    static readonly NUM_SIX = 102;
    static readonly NUM_SEVEN = 103;
    static readonly NUM_EIGHT = 104;
    static readonly NUM_NINE = 105;
    static readonly NUM_MULTIPLY = 106;
    static readonly NUM_PLUS = 107;
    static readonly NUM_MINUS = 109;
    static readonly NUM_PERIOD = 110;
    static readonly NUM_DIVISION = 111;

    static readonly NUMLOCK = 144;
    static readonly SCROLL_LOCK = 145;

    // OS-specific media keys like volume controls and browser controls.
    static readonly FIRST_MEDIA_KEY = 166;
    static readonly LAST_MEDIA_KEY = 183;

    static readonly SEMICOLON = 186;             // needs localization
    static readonly DASH = 189;                  // needs localization
    static readonly EQUALS = 187;                // needs localization
    static readonly COMMA = 188;                 // needs localization
    static readonly PERIOD = 190;                // needs localization
    static readonly SLASH = 191;                 // needs localization
    static readonly APOSTROPHE = 192;            // needs localization
    static readonly TILDE = 192;                 // needs localization
    static readonly SINGLE_QUOTE = 222;          // needs localization
    static readonly OPEN_SQUARE_BRACKET = 219;   // needs localization
    static readonly BACKSLASH = 220;             // needs localization
    static readonly CLOSE_SQUARE_BRACKET = 221;  // needs localization
    static readonly WIN_KEY = 224;
    static MAC_FF_META = 224;
  // Firefox (Gecko) fires this for the meta key instead of 91
    static readonly MAC_WK_CMD_LEFT = 91;   // WebKit Left Command key fired, same as META
    static readonly MAC_WK_CMD_RIGHT = 93;  // WebKit Right Command key fired, different from META
    static readonly WIN_IME = 229;

    // "Reserved for future use". Some programs (e.g. the SlingPlayer 2.4 ActiveX
    // control) fire this as a hacky way to disable screensavers.
    static readonly VK_NONAME = 252;

    // We've seen users whose machines fire this keycode at regular one
    // second intervals. The common thread among these users is that
    // they're all using Dell Inspiron laptops, so we suspect that this
    // indicates a hardware/bios problem.
    // http=//en.community.dell.com/support-forums/laptop/f/3518/p/19285957/19523128.aspx
    static readonly PHANTOM = 255;


    /**
     * Returns true if the key fires a keypress event in the current browser.
     *
     * Accoridng to MSDN [1] IE only fires keypress events for the following keys:
     * - Letters: A - Z (uppercase and lowercase)
     * - Numerals: 0 - 9
     * - Symbols: ! @ # $ % ^ & * ( ) _ - + = < [ ] { } , . / ? \ | ' ` " ~
     * - System: ESC, SPACEBAR, ENTER
     *
     * That's not entirely correct though, for instance there's no distinction
     * between upper and lower case letters.
     *
     * [1] http://msdn2.microsoft.com/en-us/library/ms536939(VS.85).aspx)
     *
     * Safari is similar to IE, but does not fire keypress for ESC.
     *
     * Additionally, IE6 does not fire keydown or keypress events for letters when
     * the control or alt keys are held down and the shift key is not. IE7 does
     * fire keydown in these cases, though, but not keypress.
     *
     * @param keyCode A key code.
     * @param opt_heldKeyCode Key code of a currently-held key.
     * @param opt_shiftKey Whether the shift key is held down.
     * @param opt_ctrlKey Whether the control key is held down.
     * @param opt_altKey Whether the alt key is held down.
     * @return Whether it's a key that fires a keypress event.
     */
    static firesKeyPressEvent(
        keyCode:number, opt_heldKeyCode?:number,
        opt_shiftKey:boolean = false, opt_ctrlKey:boolean = false, opt_altKey:boolean = false ):boolean {
        if (!userAgent.IE && !userAgent.EDGE &&
            !(userAgent.WEBKIT && userAgent.isVersionOrHigher('525'))) {
            return true;
        }

        if (userAgent.MAC && opt_altKey) {
            return KeyCodes.isCharacterKey(keyCode);
        }

        // Alt but not AltGr which is represented as Alt+Ctrl.
        if (opt_altKey && !opt_ctrlKey) {
            return false;
        }

        // Saves Ctrl or Alt + key for IE and WebKit 525+, which won't fire keypress.
        // Non-IE browsers and WebKit prior to 525 won't get this far so no need to
        // check the user agent.
        if (typeof opt_heldKeyCode === 'number') {
            opt_heldKeyCode = KeyCodes.normalizeKeyCode(opt_heldKeyCode);
        }
        if (!opt_shiftKey &&
            (opt_heldKeyCode == KeyCodes.CTRL ||
                opt_heldKeyCode == KeyCodes.ALT ||
                userAgent.MAC && opt_heldKeyCode == KeyCodes.META)) {
            return false;
        }

        // Some keys with Ctrl/Shift do not issue keypress in WEBKIT.
        if ((userAgent.WEBKIT || userAgent.EDGE) && opt_ctrlKey &&
            opt_shiftKey) {
            switch (keyCode) {
                case KeyCodes.BACKSLASH:
                case KeyCodes.OPEN_SQUARE_BRACKET:
                case KeyCodes.CLOSE_SQUARE_BRACKET:
                case KeyCodes.TILDE:
                case KeyCodes.SEMICOLON:
                case KeyCodes.DASH:
                case KeyCodes.EQUALS:
                case KeyCodes.COMMA:
                case KeyCodes.PERIOD:
                case KeyCodes.SLASH:
                case KeyCodes.APOSTROPHE:
                case KeyCodes.SINGLE_QUOTE:
                    return false;
            }
        }

        // When Ctrl+<somekey> is held in IE, it only fires a keypress once, but it
        // continues to fire keydown events as the event repeats.
        if (userAgent.IE && opt_ctrlKey && opt_heldKeyCode == keyCode) {
            return false;
        }

        switch (keyCode) {
            case KeyCodes.ENTER:
                return true;
            case KeyCodes.ESC:
                return !(userAgent.WEBKIT || userAgent.EDGE);
        }

        return KeyCodes.isCharacterKey(keyCode);
    };

    private static readonly FUNC_KEY = /^F((1[12])|[1-9])$/;
    /**
     * Returns true if the event contains a text modifying key.
     * @param e A key event.
     * @return Whether it's a text modifying key.
     */
    static isTextModifyingKeyEvent(e:KeyboardEvent):boolean {
        if (!(e instanceof KeyboardEvent)) {
            return false;
        }
        if (e.altKey && !e.ctrlKey || e.metaKey ||
            // Function keys don't generate text
            KeyCodes.FUNC_KEY.test(e.key)) {
            return false;
        }



        // The following keys are quite harmless, even in combination with
        // CTRL, ALT or SHIFT.
        switch (e.key) {
            case "Alt":
            case "CapsLock":
            case "ContextMenu":
            case "Control":
            case "ArrowDown":
            case "End":
            case "Escape":
            case "Home":
            case "Insert":
            case "ArrowLeft":
            case "NumLock":
            case "Clear":
            case "PageDown":
            case "PageUp":
            case "Pause":
            case "WakeUp":
            case "F13":
            case "RightArrow":
            case "ScrollLock":
            case "Shift":
            case "UpArrow":
            case "Meta":
                return false;
            default:
                return !["BrowserBack","BrowserForward","BrowserRefresh","AudioVolumeDown",
                    "AudioVolumeUp","MediaTrackNext","MediaTrackPrevious","MediaStop",
                    "MediaPlayPause","LaunchMail","AudioVolumeMute","VolumeMute","AudioVolumeDown",
                    "VolumeDown","AudioVolumeUp"].includes(e.key);
        }
    }


    /**
     * Returns true if the key produces a character.
     * This does not cover characters on non-US keyboards (Russian, Hebrew, etc.).
     *
     * @param keyCode A key code.
     * @return Whether it's a character key.
     */
    static isCharacterKey(keyCode:number):boolean {
        if (keyCode >= KeyCodes.ZERO &&
            keyCode <= KeyCodes.NINE) {
            return true;
        }

        if (keyCode >= KeyCodes.NUM_ZERO &&
            keyCode <= KeyCodes.NUM_MULTIPLY) {
            return true;
        }

        if (keyCode >= KeyCodes.A && keyCode <= KeyCodes.Z) {
            return true;
        }

        // Safari sends zero key code for non-latin characters.
        if ((userAgent.WEBKIT || userAgent.EDGE) && keyCode == 0) {
            return true;
        }

        switch (keyCode) {
            case KeyCodes.SPACE:
            case KeyCodes.PLUS_SIGN:
            case KeyCodes.QUESTION_MARK:
            case KeyCodes.AT_SIGN:
            case KeyCodes.NUM_PLUS:
            case KeyCodes.NUM_MINUS:
            case KeyCodes.NUM_PERIOD:
            case KeyCodes.NUM_DIVISION:
            case KeyCodes.SEMICOLON:
            case KeyCodes.FF_SEMICOLON:
            case KeyCodes.DASH:
            case KeyCodes.EQUALS:
            case KeyCodes.FF_EQUALS:
            case KeyCodes.COMMA:
            case KeyCodes.PERIOD:
            case KeyCodes.SLASH:
            case KeyCodes.APOSTROPHE:
            case KeyCodes.SINGLE_QUOTE:
            case KeyCodes.OPEN_SQUARE_BRACKET:
            case KeyCodes.BACKSLASH:
            case KeyCodes.CLOSE_SQUARE_BRACKET:
                return true;
            default:
                return false;
        }
    };


    /**
     * Normalizes key codes from OS/Browser-specific value to the general one.
     * @param keyCode The native key code.
     * @return The normalized key code.
     */
    static normalizeKeyCode(keyCode:number):number {
        if (userAgent.GECKO) {
            return KeyCodes.normalizeGeckoKeyCode(keyCode);
        } else if (userAgent.MAC && userAgent.WEBKIT) {
            return KeyCodes.normalizeMacWebKitKeyCode(keyCode);
        } else {
            return keyCode;
        }
    }


    /**
     * Normalizes key codes from their Gecko-specific value to the general one.
     * @param {number} keyCode The native key code.
     * @return {number} The normalized key code.
     */
    static normalizeGeckoKeyCode(keyCode:number):number {
        switch (keyCode) {
            case KeyCodes.FF_EQUALS:
                return KeyCodes.EQUALS;
            case KeyCodes.FF_SEMICOLON:
                return KeyCodes.SEMICOLON;
            case KeyCodes.FF_DASH:
                return KeyCodes.DASH;
            case KeyCodes.MAC_FF_META:
                return KeyCodes.META;
            case KeyCodes.WIN_KEY_FF_LINUX:
                return KeyCodes.WIN_KEY;
            default:
                return keyCode;
        }
    };


    /**
     * Normalizes key codes from their Mac WebKit-specific value to the general one.
     * @param keyCode The native key code.
     * @return The normalized key code.
     */
    static normalizeMacWebKitKeyCode(keyCode:number) {
        switch (keyCode) {
            case KeyCodes.MAC_WK_CMD_RIGHT:  // 93
                return KeyCodes.META;          // 91
            default:
                return keyCode;
        }
    }
}
