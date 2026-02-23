/**
 * a utility class that is used to update widgets based on a behaviour each time the behaviour changes the callback
 * will be fired
 *
 * you may access the behaviour attached to the helper inside the callback
 *
 */
import {WidgetScope} from "./widgets/widgetscope.ts";
import {Behaviour, BehaviourList} from "../frp/frp.ts";
import {append, createDom, createTextNode, removeChildren, removeNode, setProperties} from "./dom/dom.ts";
import {Messages} from "./messages.ts";
import {BoolWithExplanation} from "./booleanwithexplain.ts";
import {WidgetHelper} from "./widgethelper.ts";
import {BehaviourOrType} from "../frp/struct.ts";
import {Message} from "./message.ts";
import {Util} from "../frp/util.ts";
import {TagName} from "./dom/tags.ts";
import {CssHelper} from "./csshelper.ts";
import {Tooltip} from "./tooltip.ts";

type BrowserEvent = KeyboardEvent | MouseEvent | SubmitEvent | InputEvent;

type OptionsType1 = { enabled: BehaviourOrType<BoolWithExplanation> };
type OptionsType2 = {
    message: BehaviourOrType<string | Element | Message>
    enabled?: BehaviourOrType<boolean | BoolWithExplanation>
};
type OptionsType = OptionsType1 | OptionsType2;


export class TooltipWidget {
    private helper_: WidgetHelper;
    private scope_: WidgetScope;
    private messageB_?: Behaviour<string | Element | Message | undefined>;
    private enabledB_?: Behaviour<BoolWithExplanation | boolean | undefined>;
    private tooltip_: Element;

    constructor(scope: WidgetScope, anchor: Element, cssHelper: CssHelper = new CssHelper) {
        this.helper_ = new WidgetHelper(scope, anchor, this, this.update_, {
            detach: this.detach_, attach: () => {
            }
        });
        this.scope_ = scope;
        this.tooltip_ = createDom(TagName.DIV, cssHelper.className('recoil-tootip'));
    }

    private update_(helper: WidgetHelper) {
        let message = undefined;
        let enabled = false;
        removeChildren(this.tooltip_);

        if (this.enabledB_?.good()) {
            let val = this.enabledB_?.get();
            if (val instanceof BoolWithExplanation) {
                enabled = val.val();
                message = val.reason();
            } else if (typeof val === "boolean") {
                enabled = val;
            } else {
                enabled = this.messageB_?.good() || false;
            }
        }

        if (this.messageB_?.good()) {
            let val = this.messageB_?.get();

            if (typeof (val) === "string" || val instanceof Element) {
                append(this.tooltip_, val);
            } else if (val instanceof Message) {
                append(this.tooltip_, val.resolve().toString());
            }
        }
        // todo handle not ready and errors perhaps we will do it with a wrapper

    }

    private detach_() {
        removeNode(this.tooltip_);
    }

    attachStruct(data: OptionsType) {
        let util = new Util(this.scope_.getFrp());
        this.enabledB_ = util.toBehaviour(data.enabled);
        this.messageB_ = util.toBehaviour((data as OptionsType2)?.message);
        this.helper_.attach(this.enabledB_, this.messageB_);
    }
}


/**
 * This class will but the correct tooltip on the component
 * including not ready, and error messaged
 * @constructor
 * @param {!recoil.ui.WidgetScope} widgetScope gui scope
 * @param {!goog.ui.Component|!Element} component when this is no longer visible updates will longer fire and memory will be cleaned up
 * @param {Element=} opt_element
 * @param {function(boolean)=} opt_setEnabled alternate way of enabling
 */

export class EnabledTooltipHelper {
    private scope_: WidgetScope;
    private behaviours_: BehaviourList;
    private setEnabled_: ((enabled: boolean) => void) | undefined;
    private enabledB_: Behaviour<BoolWithExplanation> | Behaviour<{
        enabled?: BoolWithExplanation,
        tooltip?: Message | string
    }> | null = null;
    private container_: Element;
    private disableElement_: Element | null;
    private messageElements_: Element[]; // elements that we may display the message but don't get enable/disabled
    private readonly helper_: WidgetHelper;
    private tooltip_: Tooltip | null = null;

    constructor(widgetScope: WidgetScope, containerEl: Element, element: Element | null, messageElements: Element[] = [], opt_setEnabled?: (enabled: boolean) => void) {
        this.scope_ = widgetScope;
        this.behaviours_ = [];
        this.setEnabled_ = opt_setEnabled;
        this.container_ = containerEl;
        this.messageElements_ = messageElements;
        this.disableElement_ = element;
        this.helper_ = new WidgetHelper(widgetScope, this.container_, this, this.update_, {
            detach: this.detach_,
            attach: () => {
            }
        });
    }

    private static combineTooltip(enabled: BoolWithExplanation | undefined | null, tooltip: string | null): BoolWithExplanation {
        if (!tooltip) {
            return enabled ?? BoolWithExplanation.TRUE;
        }

        let m = Message.toMessage(tooltip);
        if (!enabled) {
            return new BoolWithExplanation(true, m);
        }
        if (!enabled.reason()) {
            return new BoolWithExplanation(enabled.val(), m, m);
        }
        return new BoolWithExplanation(enabled.val(), Messages.join([m, enabled.trueReason(), enabled.falseReason()].filter(v => !!v)), Messages.COMMA)
    }

    setElement(element: Element | null) {
        this.disableElement_ = element;
        this.helper_.forceUpdate();
    }

    attach(enabledB: Behaviour<BoolWithExplanation> | Behaviour<{
        enabled?: BoolWithExplanation,
        message?: Message | string
    }>, ...var_helpers: WidgetHelper[]) {
        this.enabledB_ = enabledB;
        this.behaviours_ = [enabledB];
        for (let helper of var_helpers) {
            for (let b of helper.behaviours) {
                this.behaviours_.push(b);
            }
        }
        this.helper_.attach(...this.behaviours_);

    }

    private getEnabled(): BoolWithExplanation {
        if (!this.enabledB_) {
            throw new Error("enabled  not set");
        }
        let val = this.enabledB_.get();

        let tooltip: string | null = null;
        if ('tooltip' in val && val.tooltip != undefined) {
            tooltip = Message.toString(val.tooltip);
        }
        if ('enabled' in val && val.enabled != undefined) {
            return EnabledTooltipHelper.combineTooltip(val.enabled, tooltip);
        }
        return EnabledTooltipHelper.combineTooltip(val instanceof BoolWithExplanation ? val : null, tooltip);
    }

    private update_(helper: WidgetHelper) {
        let tooltip = null;
        let enabled = false;
        if (!this.enabledB_) {
            return;
        }
        if (helper.isGood()) {
            let reason = this.getEnabled().reason();
            tooltip = reason === null ? null : reason.toString();
            enabled = this.getEnabled().val();

        } else {
            var errors = helper.errors();
            if (errors.length > 0) {
                tooltip = Messages.join(errors).toString();
            }
            enabled = false;
        }
        if (tooltip && tooltip.trim() === '' || tooltip === undefined || tooltip === '') {
            tooltip = null;
        }


        this.detach_();
        if (tooltip === null) {
            this.tooltip_ = null;
        } else {
            if (this.container_) {
                this.tooltip_ = new Tooltip(this.container_, tooltip);
                for (let el of this.messageElements_) {
                    this.tooltip_.attach(el);
                }
            }
            if (this.tooltip_) {
                this.tooltip_.setEnabled(enabled);
            }
        }
        if (this.setEnabled_) {
            this.setEnabled_(enabled);
        } else {
            if (this.disableElement_) {
                setProperties(this.disableElement_, {disabled: !enabled});
            }
        }
    }


    private detach_() {
        if (this.tooltip_) {
            if (this.container_) {
                this.tooltip_.detach(this.container_);
            }
            for (let el of this.messageElements_) {
                this.tooltip_.detach(el);
            }
            this.tooltip_.dispose();
            this.tooltip_ = null;
        }
    }

}