/**
 * Radio button widget
 * the inputs are value and a selected value
 *
 */

import {Widget} from "./widget.ts";
import {
    StandardOptions,
    getStandardOptionsGroup,
    StandardOptionsBoundType,
    StandardOptionsType
} from "../frp/util.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import {createDom} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {WidgetScope} from "./widgetscope.ts";
import {AttachType} from "../../frp/struct.ts";
import {Behaviour} from "../../frp/frp.ts";
import {EventHelper} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {isEqual} from "../../util/object.ts";

/**
 *
 * @template T
 * @param {!WidgetScope} scope
 * @implements {Widget}
 * @constructor
 */
export class RadioWidget<T> extends Widget {
    private readonly radio_:HTMLInputElement;
    private readonly helper_: WidgetHelper;
    private readonly tooltip_: EnabledTooltipHelper
    private valueB_?:Behaviour<T>;
    private configB_?:Behaviour<{
        optionValue: T,
    } & StandardOptionsBoundType>;

    constructor(scope:WidgetScope) {
        super(scope, createDom(TagName.DIV, {class: 'recoil-radio'}));
        this.radio_ = createDom(TagName.INPUT, {type: 'radio', autocomplete: 'off'});
        this.getElement().appendChild(this.radio_);
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.tooltip_ = new EnabledTooltipHelper(scope, this.getElement(), this.radio_);
    }

    static options =
        StandardOptions(
            'value', // the value that is currently selected
            'optionValue', // the value that this radio option represents
        );

    /**
     * see options from valid options
     */
    attachStruct(options:AttachType<
        {
            value: T;
            optionValue:T;
        } & StandardOptionsType>) {
        let frp = this.helper_.getFrp();
        let bound = RadioWidget.options.bind(frp, options);

        this.valueB_ = bound.value();
        this.configB_ = getStandardOptionsGroup(bound, [bound.optionValue]);

        this.helper_.attach(this.valueB_, this.configB_);
        EventHelper.listen(this.radio_, EventType.CHANGE, frp.accessTransFunc(
            () => {
                if (this.helper_.isGood()) {
                    this.valueB_?.set(this.configB_!.get().optionValue);
                }
            }, this.valueB_, this.configB_));
        this.tooltip_.attach(this.configB_, this.helper_);
    };

    private updateState_(helper:WidgetHelper) {
        if (helper.isGood()) {
            let newVal = isEqual(this.valueB_!.get(), this.configB_!.get().enabled);
            if (this.radio_.checked != newVal) {
                this.radio_.checked = newVal;
            }
        }

    }
}