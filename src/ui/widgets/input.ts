import {WidgetScope} from "./widgetscope.ts";
import {createDom, setElementShown} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {Widget} from "./widget.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {type AttachType} from "../../frp/struct.ts";
import {Behaviour, BStatus, ErrorType, Status, TypedBehaviourList} from "../../frp/frp.ts";
import {DefaultStringConverter, StringConverter} from "../../converters/stringconverter.ts";
import classlist from "../dom/classlist.ts";
import {EventHelper} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {Messages} from "../messages.ts";
import {isEqual} from "../../util/object.ts";
import {Message} from "../message.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {getGroup, StandardOptions, StandardOptionsType} from "../frp/util.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import { Keys } from "../dom/keycodes.ts";

type BoundConfigType<InType> = {
    placeHolder: String | Message;
    immediate: boolean;
    maxLength: number | undefined;
    converter: StringConverter<InType>;
    editable: boolean;
    charValidator: (ch:string) => boolean;
    displayLength: number;
    spellcheck: boolean;
    classes:string[];
};

export class InputWidget<InType = string> extends Widget {


    private readonly input_: HTMLInputElement;
    private readonly readonly_: HTMLSpanElement;
    private curClasses_: string[];
    private readonly focusB_: Behaviour<boolean>;
    private lastInputSet_: string;
    private pasteHelper_: EventHelper<ClipboardEvent>;
    private focusChangeHelper_: EventHelper<FocusEvent>;
    private blurChangeHelper_: EventHelper<FocusEvent>;
    private keyPressHelper_: EventHelper<KeyboardEvent>;
    private changeHelper_: EventHelper<KeyboardEvent>;
    private helper_: WidgetHelper;
    private tootipHelper_:EnabledTooltipHelper

    private valueB_?: Behaviour<InType>;
    private lastValue_?: Status<InType,any, any>;
    private lastConverter_?: StringConverter<InType>;


    private configB_?: Behaviour<BoundConfigType<InType>>;
    private enabledB_?: Behaviour<BoolWithExplanation>;
    private tooltipB_?: Behaviour<Message | string>;
    private outErrorsB_?: Behaviour<ErrorType[]>;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV));
        this.input_ = createDom(TagName.INPUT);
        this.readonly_ = createDom(TagName.SPAN);

        this.getElement().appendChild(this.input_);
        this.getElement().appendChild(this.readonly_);

        this.helper_ = new WidgetHelper(scope, this.element_, this, this.updateState_, {detach: () => this.detach_(), attach: () => {}});
        this.tootipHelper_ = new EnabledTooltipHelper(scope, this.element_, this.element_);

        this.changeHelper_ = new EventHelper(scope, this.input_, EventType.INPUT);
        this.keyPressHelper_ = new EventHelper(scope, this.input_, EventType.KEYDOWN);
        this.blurChangeHelper_ = new EventHelper(scope, this.input_, EventType.BLUR);
        this.focusChangeHelper_ = new EventHelper(scope, this.input_, EventType.FOCUS);
        this.pasteHelper_ = new EventHelper(scope, this.input_, EventType.PASTE);
        this.lastInputSet_ = '';
        // todo enabled
        this.focusB_ = scope.getFrp().createB(false);
        this.curClasses_ = [];

    }


    /**
     * binds the data to the widget, this can be a behaviour with a struct inside it or
     * a struct with behaviours or just values inside it, if the values inside the struct are
     * not behaviours they are read only
     * @param data
     *
     * immediate - the data will update as the user types, normally the inpute will not change until the input box
     *             loses focus
     * classes the class names that the input box has
     * converter:  allows different types to be displayed for example you could reneder an object, while you
     *             could of course just convert the item into a string first
     */
    attachStruct(data: AttachType<{
        value: InType,
        classes?: string[],
        placeholder?: string | Message, // default null
        immediate?: boolean, // default true
        converter?: StringConverter<InType>,
        maxLength?: number,
        outErrors?: ErrorType[],
        displayLength?: number,
        spellcheck?: boolean,
        charValidator?: (c: string) => boolean,
     } & StandardOptionsType>) {
        let frp = this.scope_.getFrp();

        let bound = InputWidget.options.bind(frp, data);
        this.valueB_ = bound.value();
        this.configB_ = bound[getGroup](['placeholder', 'immediate',
            'maxLength', 'converter', 'converter', 'editable','spellcheck',
            'displayLength', 'charValidator', 'classes']);
        this.enabledB_ = bound.enabled();
        this.tooltipB_ = bound.tooltip();
        this.outErrorsB_ = bound.outErrors();
        this.helper_.attach(this.valueB_, this.enabledB_, this.outErrorsB_, this.configB_);

        this.changeHelper_.listen(this.scope_.getFrp().createCallback(() => {
            //let inputEl = v.target;
            this.updateElement_(this.input_, !!this.configB_?.get().immediate, !!this.configB_?.get().immediate);
        }, this.valueB_ as Behaviour<InType>, this.configB_));

        let blurListener = (v:Event) => {
            let inputEl = v.target as HTMLInputElement;
            this.focusB_.set(false);

            if (!this.configB_?.get().immediate) {
                this.updateElement_(inputEl, true, true);
            } else {
                frp.accessTrans(() => {
                    if (this.configB_?.metaGet().good() && this.valueB_?.metaGet().good()) {
                        let t = this.configB_?.get().converter;
                        let strVal = t.convert(this.valueB_.get());
                        this.setInputValue_(strVal);
                        this.updateElement_(inputEl, false, true);
                    }
                }, this.configB_, this.valueB_ as Behaviour<InType>);
            }
        };

        this.blurChangeHelper_.listen(this.scope_.getFrp().createCallback(
            /** @type {function (...?): ?}*/ (blurListener), this.valueB_, this.configB_, this.focusB_));

        this.focusChangeHelper_.listen(this.scope_.getFrp().createCallback(
            (() => {
                this.focusB_.set(true);
            }), this.focusB_));

        this.keyPressHelper_.listen(this.scope_.getFrp().createCallback((v:KeyboardEvent) => {
            let validator = this.configB_?.get().charValidator || (() => false);

            if (!this.configB_?.good() && this.configB_?.get().immediate) {
                if (v.key === Keys.ENTER) {
                    blurListener(v);
                    this.focusB_.set(true);
                }
            }
            if (v.key === Keys.ESCAPE) {
                if (this.valueB_?.metaGet().good() && this.configB_?.metaGet().good()) {
                    let t = this.configB_?.get().converter;
                    let strVal = t.convert(this.valueB_.get());
                    this.setInputValue_(strVal);
                    this.updateElement_(v.target as HTMLInputElement, true, true);
                    v.preventDefault();
                    return;
                }
            }
            let ch = v.key
            // Allow: backspace, delete, tab, escape, enter
            if ([Keys.F5, Keys.DELETE, Keys.ARROW_DOWN, Keys.TAB, Keys.BACKSPACE, Keys.ESCAPE, Keys.ENTER].includes(v.key) ||
                (["a", "c", "x",].includes(v.key) && v.ctrlKey === true) ||
                ([Keys.ARROW_RIGHT,Keys.ARROW_LEFT,Keys.HOME,Keys.END].includes(v.key))) {
                // let it happen, don't do anything
                return;
            }
            if (!validator(ch)) {
                v.preventDefault();
            }

        }, this.valueB_ as Behaviour<any>, this.configB_ as Behaviour<any>));

        this.pasteHelper_.listen(this.scope_.getFrp().createCallback((bevent:ClipboardEvent) => {
            let txt = bevent.clipboardData?.getData('text/plain') || '';

            let cleanTxt = '';
            let validator = this.configB_?.get().charValidator || (() => true);
            for (let i = 0; i < txt.length; i++) {
                // if (charValidator(txt[i])) {
                if (validator(txt[i])) {
                    cleanTxt += txt[i];
                }
            }

                // txt = txt.replace(/[^0-9.+]/g, 'F');
                if (cleanTxt != txt) {
                    if (cleanTxt === '') {
                        bevent.preventDefault();
                    } else {
                        let inputEl = this.input_;
                        if (inputEl.selectionEnd == null || inputEl.selectionEnd == null) {
                            bevent.preventDefault();
                            return;
                        }

                        let orig = this.input_.value;
                        let before = orig.substring(0, inputEl.selectionStart || 0);
                        let after = orig.substring(inputEl.selectionEnd);
                        let maxLen = this.configB_?.get().maxLength;
                        if (maxLen !== undefined && maxLen > 0) {
                            let lengthRemaining = maxLen - (before + after).length;
                            cleanTxt = cleanTxt.substring(0, lengthRemaining);
                        }

                        let selPos = (inputEl.selectionStart || 0) + cleanTxt.length;

                        inputEl.value = before + cleanTxt + after;

                        inputEl.selectionStart = selPos;
                        inputEl.selectionEnd = selPos;
                        this.updateElement_(inputEl, this.configB_?.get().immediate || false, false);
                        bevent.preventDefault();
                    }
                }
            }
        , this.valueB_ as Behaviour<any>, this.configB_));

        let tooltipB = frp.liftB<BoolWithExplanation,
            TypedBehaviourList<[BoolWithExplanation,BoundConfigType<InType>, Message|string]>>(
            (enabled:BoolWithExplanation, _config:BoundConfigType<InType>, tooltip:Message|string):BoolWithExplanation => {
            if (!enabled.val()) {
                return enabled;
            }
            let config = this.configB_!.get();
            if (tooltip !== Messages.BLANK) {
                if (tooltip === null) {
                    return BoolWithExplanation.TRUE;
                }
                return new BoolWithExplanation(true, Message.toMessage(tooltip));
            }
            if (config.maxLength !== undefined) {
                return new BoolWithExplanation(true, Messages.MAX_LENGTH_0.resolve({len: config.maxLength}));
            }
            return BoolWithExplanation.TRUE;
        }, this.enabledB_, this.configB_, this.tooltipB_);
        this.tootipHelper_.attach(tooltipB, this.helper_);
    }


    /**
     * attachable behaviours for widget
     */
    static options = StandardOptions(
        'value',
        {
            classes: [],
            placeholder: null,
            immediate: false, // if false changes will not propogate until blur
            converter: new DefaultStringConverter(),
            maxLength: undefined,
            outErrors: [],
            spellcheck: true,
            displayLength: undefined,
            charValidator: function () {
                return true;
            },
            unFocusConverter: null
        }
    );

    private updateElement_(inputEl: HTMLInputElement, setVal: boolean, setError: boolean) {
        if (!this.configB_?.metaGet().good()) {
            return;
        }
        let res = this.configB_?.get().converter.unconvert(inputEl.value);

        if (res.supported === false) {
            return;
        }
        let el = inputEl;

        let editable = !!this.scope_.getFrp().accessTrans(() => this.configB_?.metaGet().good() && this.configB_.get().editable, this.configB_);
        if (!res.error || !editable) {
            if (setVal && !res.error) {
                this.valueB_?.set(res.value);
            }
            if (setError) {
                this.scope_.getFrp().accessTrans(() => {
                    (this.outErrorsB_ as Behaviour<ErrorType[]>).set([]);
                }, this.outErrorsB_ as Behaviour<any>);
            }
            classlist.remove(el, 'recoil-error');
        } else {
            if (setVal && res.settable && editable) {
                this.valueB_?.set(res.value);
            }

            if (setError) {
                this.scope_.getFrp().accessTrans(() => {
                    this.outErrorsB_?.set([res.error]);
                }, this.outErrorsB_ as Behaviour<any>);
            }
            // if we don't remove the error on empty then the placeholder
            // goes red
            if (inputEl.value) {
                classlist.add(el, 'recoil-error');
            } else {
                classlist.remove(el, 'recoil-error');
            }
        }
    }

    /**
     * if not immediate we need to put data back before we detach
     * @private
     */
    private detach_() {
        let frp = this.scope_.getFrp();
        delete this.lastValue_;
        delete this.lastConverter_;
        frp.accessTrans(() => {
            if (this.configB_?.good() && this.valueB_?.good() && !this.configB_.get().immediate) {

            this.updateElement_(this.input_, true, false);
            }
        }, this.configB_ as Behaviour<any>, this.valueB_ as Behaviour<any>);
    }


    /**
     * Sets focus when element becomes visible
     */
    focus() {
        let el = this.input_;

        let ob = new ResizeObserver(entries => {
            this.input_.focus();
            this.input_.select();
            ob.disconnect();
        });

        ob.observe(el);
    }

    getFocus(): Behaviour<boolean> {
        return this.focusB_;
    }

    /**
     * @private
     * @return {boolean}
     */
    private changedActiveElement_(): boolean {
        let a = document.activeElement;
        return !!(a && a === this.input_ && this.input_.value !== this.lastInputSet_);
    }


    private setInputValue_(value: string) {

        let input = this.input_;

        let dir = input['selectionDirection'];
        let start = input.selectionStart;
        let end = input.selectionEnd;

        this.input_.value = value;
        this.lastInputSet_ = value;
        input.setSelectionRange(start, end, dir || undefined);
    }

    /**
     * @param {string} value
     */
    forceSetValue(value: string) {
        this.input_.value = value;
        this.lastInputSet_ = value;
        this.helper_.accessTrans(() => {
            this.updateElement_(this.input_, false, true);
        });

    };

    private updateState_(helper: WidgetHelper) {
        this.input_.disabled = !(helper.isGood() && this.enabledB_?.get().val());
        this.input_.placeholder = this.configB_?.metaGet().good() && this.configB_.get().placeHolder?.toString() || '';
        let editable = !!(this.configB_?.metaGet().good() && this.configB_.get().editable);

        setElementShown(this.readonly_, !editable);
        setElementShown(this.input_, editable);



        if (this.configB_?.good()) {
            if (this.valueB_?.good()) {
                this.readonly_.innerText = this.configB_?.get().converter.convert(this.valueB_?.get())
            }
            else {
                this.readonly_.innerText = "?";
            }
        }
        let el = this.input_;
        let maxLength = this.configB_?.metaGet().good() ? this.configB_?.get().maxLength : undefined;
        let displayLength = this.configB_?.metaGet().good() ? this.configB_?.get().displayLength : undefined;
        if (maxLength !== undefined) {
            el.setAttribute('maxLength', maxLength.toString());
        } else if (el.maxLength !== undefined) {
            el.removeAttribute('maxLength');
        }

        if (displayLength === undefined) {
            displayLength = maxLength;
        }
        el.spellcheck = !!(this.configB_?.metaGet().good() && this.configB_.get().spellcheck)
        this.curClasses_ = WidgetHelper.updateClassesOption(
            this.input_, this.configB_, this.curClasses_);
        if (this.valueB_?.metaGet().good() && this.configB_?.metaGet().good()) {
            let t = this.configB_.get().converter;

            let strVal = t.convert(this.valueB_.get());

            if (!this.changedActiveElement_()) {
                if (strVal !== this.input_.value) {
                    if (!isEqual(this.lastValue_, this.valueB_.metaGet())) {
                        this.setInputValue_(strVal);
                        this.updateElement_(this.input_, false, true);
                    } else if (!isEqual(this.lastConverter_, this.metaGetConverter())) {
                        this.setInputValue_(strVal);
                        this.updateElement_(this.input_, false, true);
                    }

                } else if (!isEqual(this.lastConverter_, this.metaGetConverter())) {
                    this.updateElement_(this.input_, false, true);

                }
            } else if (!isEqual(this.lastConverter_, this.metaGetConverter())) {
                if (isEqual(this.lastValue_, this.valueB_.metaGet())) {
                    this.setInputValue_(strVal);
                }
            }

            if (displayLength === undefined) {
                this.input_.style.removeProperty('width');
            } else {
                if (typeof (displayLength) === 'string') {
                    this.input_.style.width = displayLength;
                } else {
                    this.input_.style.width = displayLength + 'em';
                }
            }
        } else {
            this.setInputValue_(Messages.NOT_READY.toString());
        }
        this.lastValue_ = this.valueB_?.metaGet();
        this.lastConverter_ = this.metaGetConverter();

    }

    metaGetConverter(): any {
        if (this.configB_?.good()) {
            return new BStatus(this.configB_?.get());
        }
        return this.configB_?.metaGet();
    }

    getInput():HTMLInputElement {
        return this.input_;
    }

    /**
     *
     * @param {string} type
     */
    setType(type: string) {
        this.input_.type = type;
    }
}