import { Widget } from "./widget.ts";
import { WidgetScope } from "./widgetscope.ts";
import { createDom } from "../dom/dom.ts";
import { TagName } from "../dom/tags.ts";
import { getGroup, StandardOptions, StandardOptionsType } from "../frp/util.ts";
import { AttachType } from "../../frp/struct.ts";
import { WidgetHelper } from "../widgethelper.ts";
import { Behaviour } from "../../frp/frp.ts";
import { StringConverter } from "../../converters/stringconverter.ts";
import { Message } from "../message.ts";
import { BoolWithExplanation } from "../booleanwithexplain.ts";
import { EventHelper } from "../eventhelper.ts";
import { UnconvertType } from "../../converters/typeconverter.ts";
import {
    EnabledTooltipHelper

} from "../tooltiphelper.ts";
import { EventType } from "../dom/eventtype.ts";
type BoundConfigType<InType> = {
    placeHolder: String | Message;
    immediate: boolean;
    maxLength: number | undefined;
    minHeight: number,
    converter: StringConverter<InType>;
    editable: boolean;
    charValidator: (ch: string) => boolean;
    displayLength: number;
    spellcheck: boolean;
    classes: string[];
};

/**
 * @implements {recoil.ui.LabeledWidget}
 * @param {!recoil.ui.WidgetScope} scope
 * @constructor
 */
export class TextAreaWidget<InType> extends Widget {
    private textarea_: HTMLTextAreaElement;
    private valueB_?: Behaviour<InType>;
    private configB_?: Behaviour<BoundConfigType<InType>>;
    private enabledB_?: Behaviour<BoolWithExplanation>;
    private changeHelper_: EventHelper<any>;
    private blurChangeHelper_: EventHelper<FocusEvent>;
    private configHelper_: WidgetHelper;
    private tootipHelper_: EnabledTooltipHelper;
    private helper_: WidgetHelper;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV, { class: 'recoil-text-area' }));
        this.textarea_ = createDom(TagName.TEXTAREA);
        this.changeHelper_ = new EventHelper(scope, this.textarea_, EventType.CHANGE);
        this.blurChangeHelper_ = new EventHelper(scope, this.textarea_, EventType.BLUR);
        this.helper_ = new WidgetHelper(scope, this.textarea_, this, this.updateState_, {attach: () => undefined, detach : () => {this.detach_();}});
        this.configHelper_ = new WidgetHelper(scope, this.textarea_, this, this.updateConfig_);
        this.tootipHelper_ = new EnabledTooltipHelper(scope, this.textarea_, this.textarea_);
    };

    /**
     * if not immediate we need to put data back before we detach
     * @private
     */
    private detach_() {
        let frp = this.scope_.getFrp();
        if (this.configB_ && this.valueB_) {
            frp.accessTrans(() => {
                if (this.configB_?.good() && this.valueB_?.good() && !this.configB_.get().immediate) {
                    let val: UnconvertType<InType> = this.configB_.get().converter.unconvert(this.textarea_.value);

                    if (val.settable) {
                        this.valueB_.set(val.value);
                    }
                }
            }, this.configB_, this.valueB_);
        }
    }
    static options = StandardOptions(
        'value',
        {
            classes: [],
            placeholder: null,
            immediate: false,
            maxLength: 0,
            minHeight: 70,
            outErrors: [],
            spellcheck: true,
            displayLength: null,
            charValidator: () => {
                return true;
            },
            unFocusConverter: null
        }
    );

    attachStruct(options: AttachType<{
        value: string;
        maxLength?: number | null;
        minHeight: number,
    }>) {
        let frp = this.scope_.getFrp();
        let bound = TextAreaWidget.options.bind(frp, options);

        this.valueB_ = bound.value();
        this.enabledB_ = bound.enabled();
        this.configB_ = bound[getGroup](['placeholder', 'immediate',
            'maxLength', 'converter', 'converter', 'editable', 'spellcheck',
            'enabled', 'minHeight',
            'displayLength', 'charValidator', 'classes']);

        let readyB = BoolWithExplanation.isAllGoodExplain(this.valueB_, this.enabledB_);

        this.helper_.attach(this.valueB_, this.configB_, this.enabledB_);
        this.configHelper_.attach(this.configB_);

        this.changeHelper_.listen(frp.createCallback((v) => {
            let config = this.configB_?.get();
            if (config && config.immediate) {
                let unconverted = config.converter.unconvert(this.textarea_.value);

                if (unconverted.settable) {
                    this.valueB_?.set(unconverted.value);
                }
            }
        }, this.valueB_, this.configB_));

        this.tootipHelper_.attach(this.enabledB_, this.helper_, this.configHelper_);
        this.blurChangeHelper_.listen(this.scope_.getFrp().createCallback(
            (v: FocusEvent) => {
                const config = this.configB_?.get()
                if (config && !config.immediate) {
                    let val = config.converter.unconvert(this.textarea_.value);
                    if (val.settable) {
                        this.valueB_!.set(val.value);
                    }
                }
            }, this.valueB_, this.configB_));

    };


    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    updateState_(helper: WidgetHelper) {
        const config = this.configB_?.good() && this.configB_.get();

        let len = config ? config.maxLength : 0;
        if (len) {
            this.textarea_.maxLength = len;
        } else {
            this.textarea_.removeAttribute('maxlength');
        }

        this.textarea_.placeholder = config && config.placeHolder ? config.placeHolder.toString() : '';
        if (helper.isGood() && this.configB_ && this.valueB_) {
            this.textarea_.value = this.configB_.get().converter.convert(this.valueB_.get());
        }
    };

    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    updateConfig_(helper: WidgetHelper) {
        if (helper.isGood()) {
            const config = this.configB_!.get();


            let h = config.minHeight;
            let w = config.displayLength;
            this.textarea_.style.setProperty('minHeight', String(h));
            const el = this.textarea_;
            if (!el.scrollHeight) {
                const resizeObserver = new ResizeObserver(
                    entries => {
                        if (entries[0]["target"].scrollHeight) {
                            this.textarea_.style.setProperty('minHeight', String(h));
                            resizeObserver.disconnect();

                        }
                    }
                );
                resizeObserver.observe(el);
            }

            el.style.minWidth = w == null ? "" : w + "em";

        }
    }
}



