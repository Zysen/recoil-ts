import {WidgetScope} from "./widgetscope";
import {Widget} from "./widget";
import {contains, createDom, removeNode} from "../dom/dom";
import {TagName} from "../dom/tags";
import {AttachableWidget, getGroup, StandardOptions} from "../frp/util";
import {AttachType} from "../../frp/struct";
import {WidgetHelper} from "../widgethelper";
import {enable, setAll} from "../dom/classlist";
import {Message} from "../message";
import {BoolWithExplanation} from "../booleanwithexplain";
import {Behaviour} from "../../frp/frp";
import {EventHelper} from "../eventhelper";
import {EventType} from "../dom/eventtype";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";

export type MetaOptionsType = {
    name?: string | Message,
    editable?: boolean, enabled?: BoolWithExplanation,
    classes?: string[]
}

/**
 * this is a checkbox widget that also allows null that means its unset
 */
export class Checkbox extends Widget implements AttachableWidget {
    private readonly helper_: WidgetHelper;
    private valueB_?: Behaviour<boolean | null>; // if null that means undefined
    private changeHelper_: EventHelper<Event>;
    private configB_?: Behaviour<{
        name: string | Message,
        enabled: BoolWithExplanation,
        editable: boolean,
        classes: string[]
    }>;
    private readonly checkbox_: HTMLInputElement;
    private readonly readonly_: HTMLInputElement;
    private readonly tooltipHelper_: EnabledTooltipHelper;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.SPAN, {class: 'recoil-checkbox'}));
        this.checkbox_ = createDom(TagName.INPUT, {class: 'recoil-checkbox', type: 'checkbox', disabled: true}) as HTMLInputElement;
        this.readonly_ = createDom(TagName.INPUT, {class: 'recoil-checkbox recoil-readonly', type: 'checkbox', disabled: true}) as HTMLInputElement;
        this.getElement().appendChild(this.checkbox_);

        this.changeHelper_ = new EventHelper(scope, this.element_, EventType.CHANGE);
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.tooltipHelper_ = new EnabledTooltipHelper(scope, this.getElement(), this.checkbox_, [this.readonly_]);
    }

    /**
     * list of functions available when creating a CHECKBOXWidget
     */
    static readonly options = StandardOptions('value',
        {
            'classes': [],
            'name': '',
        });
    attachStruct(options: AttachType<{
        value: boolean | null
    } & MetaOptionsType>) {
        let frp = this.helper_.getFrp();
        let bound = Checkbox.options.bind(frp, options);

        this.configB_ = bound[getGroup](['name', 'enabled', 'editable', 'classes']);
        this.valueB_ = bound.value();

        this.changeHelper_.listen(this.scope_.getFrp().createCallback(() => {
            this.valueB_?.set((this.checkbox_ as HTMLInputElement).checked);
        }, this.valueB_));

        this.helper_.attach(this.configB_, this.valueB_);
        this.tooltipHelper_.attach(this.configB_, this.helper_);
    }

    private updateState_() {
        let editable = this.configB_?.good() ? this.configB_?.get().editable : true;
        let defined = this.valueB_?.good() ? this.valueB_.get() : null;
        this.checkbox_.checked = defined == null || defined;
        this.readonly_.checked = defined == null || defined;
        let classes = [...(this.configB_?.get().classes || [])];
        setAll(this.element_, ['recoil-checkbox', ...classes])
        //, ...(this.configB_?.get().classes || [])
        enable(this.checkbox_, 'recoil-checkbox-unknown', defined == null);
        enable(this.readonly_, 'recoil-checkbox-unknown', defined == null);
        removeNode(editable ? this.readonly_ : this.checkbox_);
        if (!contains(this.getElement(), editable ? this.checkbox_: this.readonly_)) {
            this.getElement().appendChild(editable ? this.checkbox_: this.readonly_);
        }
        //removeNode(this.editableDiv_);

    }
}




