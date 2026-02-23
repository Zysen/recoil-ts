import {makeStructColumn} from "./column.ts";
import {Widget} from "../widget.ts";
import {WidgetScope} from "../widgetscope.ts";
import {createDom, createTextNode, removeNode} from "../../dom/dom.ts";
import {Unicode} from "../../../util/string.ts";
import {WidgetHelper} from "../../widgethelper.ts";
import {Options} from "../../frp/util.ts";
import {AttachType} from "../../../frp/struct.ts";
import classlist from "../../dom/classlist.ts";
import {Behaviour} from "../../../frp/frp.ts";

/**
 *
 * @param {!recoil.ui.WidgetScope} scope
 * @constructor
 * @implements {recoil.ui.Widget}
 */
class PasswordStrengthWidget extends Widget<HTMLDivElement> {
    private span_: HTMLSpanElement;
    private strength_: HTMLDivElement;
    private helper_: WidgetHelper;
    private text_: Text| null = null;
    private valueB_?: Behaviour<string>;
    constructor(scope: WidgetScope) {
        let strength = createDom('div', {}, Unicode.NBSP);
        let span = createDom('span', {});
        super(scope, createDom('div', {class: 'recoil-password-strength'}, strength, span));
        this.span_ = span;
        this.strength_ = strength
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
    };


    /**
     * attachable behaviours for widget
     */
    static options = Options('value');

    attachStruct(options: AttachType<{ value: string }>) {
        let bound = PasswordStrengthWidget.options.bind(this.scope_.getFrp(), options);

        this.valueB_ = bound.value();
        this.helper_.attach(this.valueB_);

    }


    /**
     *
     * @param {?string} password
     * @return {number}
     * @private
     */
    calcStrength_(password:string|undefined):number {
        password = password || '';
        let lenScore = password.length * 4;
        let numUpper = 0;
        let numLower = 0;
        let numNumeric = 0;
        let numSym = 0;
        let midNumSym = 0;
        let conUpper = 0;
        let conLower = 0;
        let conNumber = 0;
        let prev = null;
        let charMap:Record<string, number[]> = {};
        let alphas = 'abcdefghijklmnopqrstuvwxyz';
        let numerics = '01234567890';
        let symbols = ')!@#$%^&*()';
        let isLower = (ch:string|null) => {
            if (ch === null) {
                return false;
            }
            return ch === ch.toLowerCase() && ch !== ch.toUpperCase();
        };
        let isUpper = (ch:string|null)=> {
            if (ch === null) {
                return false;
            }
            return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
        };

        let seqs =  (sequence:string, password:string)=> {
            let res = 0;
            for (let i = 0; i < sequence.length - 3; i++) {
                let fwd = sequence.substring(i, i + 3);
                let rev = fwd.split('').reverse().join('');
                if (password.indexOf(fwd) != -1 || password.indexOf(rev) != -1) {
                    res++;
                }
            }
            return res;
        };
        let isNumber = (ch:string|null)=> {
            return ch !== null && ch >= '0' && ch <= '9';
        };
        for (let i = 0; i < password.length; i++) {
            let ch = password[i];
            if (charMap[ch.toLowerCase()] == undefined) {
                charMap[ch.toLowerCase()] = [];
            }
            charMap[ch.toLowerCase()].push(i);
            let mid = i > 0 && i != password.length - 1 ? 1 : 0;
            if (isLower(ch)) {
                if (isLower(prev)) {
                    conLower++;
                }
                numLower++;
            } else if (isUpper(ch)) {
                if (isUpper(prev)) {
                    conUpper++;
                }
                numUpper++;
            } else if (isNumber(ch)) {
                if (isNumber(prev)) {
                    conNumber++;
                }
                numNumeric++;
                midNumSym += mid;
            } else {
                midNumSym += mid;
                numSym++;
            }
            prev = ch;
        }

        let reasons:Record<string, number> = {};

        let lowerScore = numLower ? (password.length - numLower) * 2 : 0;
        let upperScore = numUpper ? (password.length - numUpper) * 2 : 0;

        reasons['length'] = lenScore;
        reasons['upper'] = upperScore;
        reasons['lower'] = lowerScore;
        reasons['numeric*4'] = numNumeric * 4;
        reasons['sym*6'] = numSym * 6;
        reasons['midNumSym*2'] = midNumSym * 2;

        if (numUpper + numLower === password.length) {
            reasons['only-chars'] = -password.length;
        }
        if (numNumeric === password.length) {
            reasons['only-num'] = -password.length;
        }

        reasons['consecutive-upper*2'] = -conUpper * 2;
        reasons['consecutive-lower*2'] = -conLower * 2;
        reasons['consecutive-number*2'] = -conNumber * 2;

        if ((numSym > 0 || numNumeric > 0) && numUpper > 0 && numLower > 0 && password.length > 0) {
            reasons['requirement-meet'] = 15;
        }

        let lowerPassword = password.toLowerCase();
        reasons['sequence-alpha*3'] = -seqs(alphas, lowerPassword) * 3;
        reasons['sequence-number*3'] = -seqs(numerics, lowerPassword) * 3;
        reasons['sequence-symbols*3'] = -seqs(symbols, lowerPassword) * 3;

        let repInc = 0;
        let repChar = 0;
        for (let i = 0; i < password.length; i++) {
            let ch = password[i];
            /* Internal loop through password to check for repeat characters */
            let bCharExists = false;
            for (let j = 0; j < password.length; j++) {
                if (ch == password[j] && i != j) { /* repeat character exists */
                    bCharExists = true;
                    /*
                      Calculate icrement deduction based on proximity to identical characters
                      Deduction is incremented each time a new match is discovered
                      Deduction amount is based on total password length divided by the
                      difference of distance between currently selected match
                    */
                    repInc += Math.abs(password.length / (i - j));
                }
            }
            if (bCharExists) {
                repChar++;
                let unqChar = password.length - repChar;
                repInc = Math.ceil(repInc / Math.max(1, unqChar));
            }
        }
        reasons['repeat?'] = -repInc;
        let score = 0;
        for (let k in reasons) {
            score += reasons[k];
        }

        return Math.max(0, score);
    };

    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    updateState_(helper:WidgetHelper) {
        if (this.text_) {
            removeNode(this.text_);
        }

        if (helper.isGood()) {
            let strength = this.calcStrength_(this.valueB_!.get());
            this.strength_.style.cssText = 'width: ' + Math.min(100, strength) + '%';
            let levels = [
                {limit: 20, name: 'very-weak', text: 'Very Weak'},
                {limit: 40, name: 'weak', text: 'Weak'},
                {limit: 60, name: 'good', text: 'Good'},
                {limit: 80, name: 'strong', text: 'Strong'},
                {limit: null, name: 'very-strong', text: 'Very Strong'}
            ];
            let wasEnabled = false;
            let txt = levels[0].text;
            for (let i = 0; i < levels.length; i++) {
                let level = levels[i];
                let enabled:boolean = !wasEnabled && (level.limit === null || strength < level.limit);
                wasEnabled = wasEnabled || enabled;
                if (enabled) {
                    txt = level.text;
                }
                classlist.enable(this.getElement(), level.name, enabled);
            }
            this.text_ = createTextNode(txt);

            this.span_.appendChild(this.text_);
        }

    }
}


export const PasswordStrengthColumn = makeStructColumn(PasswordStrengthWidget);
