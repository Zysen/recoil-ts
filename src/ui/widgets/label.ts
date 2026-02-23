/**
 * a simple widget to provide just text no formatting
 *
 */
import {Widget} from "./widget.ts";
import {Message} from "../message.ts";
import {WidgetScope} from "./widgetscope.ts";
import {Behaviour, ErrorType} from "../../frp/frp.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {createDom, createTextNode, removeChildren} from "../dom/dom.ts";
import {Options} from "../frp/util.ts";
import {TagName} from "../dom/tags.ts";
import {AttachType} from "../../frp/struct.ts";
import {Tooltip} from "../tooltip.ts";
import {Messages} from "../messages.ts";
import {EventHandler} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";

export type ValueType = string | Message | Node;
export type FormatterFn<Type> = (value: Type) => string | Node;

/**
 * a class that lets you create a label without the overhead of behaviours
 *
 */
export class LabelHelper<T = ValueType> {
    private readonly label_: HTMLElement;
    private readonly errorHandlers_ = new EventHandler();
    private tooltip_: Tooltip | null;
    private tooltipVal_: ValueType | null;
    private curClasses_: string[] = [];

    constructor(label: HTMLElement, helper:WidgetHelper) {
        this.label_ = label;
        this.tooltip_ = null;
        this.tooltipVal_ = null;
        helper.addDetachCallback({
            detach: () => {this.resetTooltip_(null);},
            attach: () => {}})
    }

    updateGood(val: T, formater: FormatterFn<T>, classes:string[], tooltip: {
        enabled: BoolWithExplanation,
        tooltip?: Message | string | undefined | null | Node
    }):void {
        this.errorHandlers_.unlisten();
        removeChildren(this.label_);
        this.curClasses_ = WidgetHelper.updateClassesNoBehaviour(classes, this.curClasses_, this.label_);

        let content = formater(val);
        let fullTooltip: Node | null = null;
        if (tooltip.tooltip instanceof Node) {
            if (tooltip.enabled && tooltip.enabled.reason() && !tooltip.enabled.reason()?.isEmpty()) {
                fullTooltip = createDom(TagName.SPAN, {}, tooltip.tooltip, tooltip.enabled.reason()!.toString());
            }
            else {
                fullTooltip = tooltip.tooltip;
            }
        }
        else if (tooltip.tooltip && tooltip.tooltip.toString().trim().length > 0) {
            let part1 = Message.toMessage(tooltip.tooltip);
            if (tooltip.enabled) {
                let reason = tooltip.enabled.reason();
                if (reason !== null && reason.toString().trim().length > 0) {
                    fullTooltip = createDom(TagName.SPAN, {}, Messages.join([part1, reason], Messages.COMMA));
                }
                else {
                    fullTooltip = createDom(TagName.SPAN, {}, part1.toString());
                }
            }
            else {
                fullTooltip = createDom(TagName.SPAN, {}, part1.toString());
            }
        }
        else if (tooltip.enabled) {
            let reason = tooltip.enabled.reason();
            if (reason && !reason.isEmpty()) {
                fullTooltip = createDom(TagName.SPAN, {}, tooltip.enabled.reason());
            }
        }

        if (content instanceof Node) {
            this.label_.appendChild(content);
        } else if (typeof content === "string") {
            this.label_.appendChild(createTextNode(content));
        } else {
            this.label_.appendChild(createTextNode(content + ''));
        }

        this.resetTooltip_(fullTooltip || '');
    }
    updateBad(errors:ErrorType[]) {
        this.errorHandlers_.unlisten();
        removeChildren(this.label_);
        if (errors.length > 0) {
            let cont = createDom(TagName.DIV, {class: 'recoil-error'});
            for (let error of errors) {
                let e = error instanceof Error ? error.message : error;
                let div = createDom(TagName.DIV, {class:'recoil-error'}, e);
                this.errorHandlers_.listen(div, EventType.CLICK, () => console.error("error", error));
                cont.appendChild(div)
            }
            this.label_.appendChild(cont);
        }
        else {
            this.label_.appendChild(createTextNode('??'));
        }
        this.resetTooltip_(null);
    }
    /**
     *  @param {?} tooltip
     */
    private resetTooltip_(tooltip: ValueType | null) {
        if (typeof (tooltip) === 'string') {
            tooltip = tooltip.trim();
            if (tooltip == '') {
                tooltip = null;
            }
        }
        if (!tooltip || tooltip != this.tooltipVal_) {
            if (this.tooltip_) {
                this.tooltip_.detach(this.label_);
                this.tooltip_.dispose();
                this.tooltip_ = null;
            }
            if (tooltip != null) {
                this.tooltip_ = new Tooltip(this.label_, tooltip);
                this.tooltipVal_ = tooltip;
            } else {
                this.tooltipVal_ = null;
            }
        }

    }


    static defaultFormatter(value: ValueType): string | Node {
        if (typeof value === "string") {
            return value;
        } else if (value instanceof Message) {
            return value.toString();
        } else if (value instanceof Node) {
            return value;
        } else {
            return 'ERROR: not string but ' + typeof (value) + ': ' + value;
        }

    }

}

export class Label<Type> extends Widget {
    private readonly helper_: WidgetHelper;
    private valueB_?: Behaviour<Type>;
    private enabledB_?: Behaviour<BoolWithExplanation>;
    private tooltipB_?: Behaviour<Message|Node|string>;
    private classesB_?: Behaviour<string[]>;
    private formatterB_?: Behaviour<FormatterFn<Type>>;
    private labelHelper_: LabelHelper<Type>;

    constructor(scope: WidgetScope) {
        let label = createDom(TagName.DIV);
        super(scope, label);
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.labelHelper_ = new LabelHelper(label, this.helper_);
    }

    /**
     * list of functions available when creating a selectorWidget
     */

    static readonly options = Options('value',
        {
            'enabled': BoolWithExplanation.TRUE,
            'tooltip': Messages.BLANK,
            'formatter': LabelHelper.defaultFormatter,
            'classes': []
        });

    private updateState_(helper: WidgetHelper) {
        if (helper.isGood()) {
            this.labelHelper_.updateGood(this.valueB_!.get(), this.formatterB_!.get(), this.classesB_!.get(), {enabled: this.enabledB_!.get(), tooltip: this.tooltipB_!.get()})
        } else {
            this.labelHelper_.updateBad(helper.errors());
        }
    }

    attachStruct(value: AttachType<{
        value: Type;
        enabled?: BoolWithExplanation,
        tooltip?:Message|string|Node,
        formatter?: FormatterFn<Type>;
        classes?: string[],
    }>) {
        let frp = this.scope_.getFrp();
        let bound = Label.options.bind(frp, value);

        this.valueB_ = bound.value();
        this.enabledB_ = bound.enabled();
        this.tooltipB_ = bound.tooltip();
        this.formatterB_ = bound.formatter();
        this.classesB_ = bound.classes();
        this.helper_.attach(this.valueB_, this.enabledB_, this.formatterB_, this.classesB_, this.tooltipB_);
    }


}


export class LabelWidgetHelper {
    private readonly scope_: WidgetScope;

    constructor(scope: WidgetScope) {
        this.scope_ = scope;
    }

    createAndAttach(name: string | Behaviour<string>, enabled: BoolWithExplanation | Behaviour<BoolWithExplanation>) {
        let label = new Label(this.scope_);
        label.attachStruct({value: name, enabled});
        return label;
    }
}