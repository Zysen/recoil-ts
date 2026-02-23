import {Widget} from "./widget.ts";
import {WidgetScope} from "./widgetscope.ts";
import {createDom, setElementShown} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {getGroup, StandardOptions} from "../frp/util.ts";
import {EventType} from "../dom/eventtype.ts";
import {makeStructColumn} from "./table/column.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import {AttachType} from "../../frp/struct.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {Behaviour} from "../../frp/frp.ts";
import classlist from "../dom/classlist.ts";

export class TimeWidget extends Widget {
    private readonly time_: HTMLInputElement;
    private readonly readonly_: HTMLDivElement;
    private readonly helper_: WidgetHelper;
    private valueB_?:Behaviour<number|null>;
    private tooltip_:EnabledTooltipHelper;
    private configB_?:Behaviour<{
        min:number;
        max:number;
        step:number;
        editable:boolean;
        enabled:BoolWithExplanation;
        
    }>;

    constructor(scope: WidgetScope) {

        const time = createDom(TagName.INPUT, {type: 'time'});
        const readonly = createDom(TagName.DIV, {type: 'recoil-label'});

        super(scope, createDom(TagName.DIV, {class: 'recoil-time-cont'}, time, readonly));

        let frp = scope.getFrp();

        this.time_ = time;
        this.readonly_ = readonly;

        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.tooltip_ = new EnabledTooltipHelper(scope, this.getElement(), this.time_, [this.readonly_]);

        this.time_.addEventListener(EventType.BLUR, frp.accessTransFunc(() => {
            this.helper_.forceUpdate();
        }, this.valueB_!, this.configB_!));
        this.time_.addEventListener(EventType.CHANGE, frp.accessTransFunc(() => {
            let outTime = this.convertElTypeToTime_(this.time_.value);
            let valid = this.isValid(this.configB_?.get(), outTime);
            classlist.enable(this.time_, 'recoil-error', !valid);
            if (valid) {
                this.valueB_?.set(outTime);
            }
        }, this.valueB_!, this.configB_!));
    }

    static readonly options = StandardOptions('value', {start: null, stop: null, min: null, max: null, step: 60});


    attachStruct(options:AttachType<{
        value: number;
        enabled?:BoolWithExplanation,
        min?:number|null, // milliseconds
        max?:number|null, // milliseconds
        step?:number,
        editable?:boolean,
    }>) {
        let frp = this.helper_.getFrp();
        let bound = TimeWidget.options.bind(frp, options);
        this.valueB_ = bound.value();
        this.configB_ = bound[getGroup]([bound.min, bound.max, bound.step, bound.editable, bound.enabled]);
        this.helper_.attach(this.valueB_, this.configB_);
        this.tooltip_.attach(this.configB_, this.helper_);
    }


    /**
     * @private
     * @param {?number} time
     * @return {?string}
     */
    convertTimeToElType_(time: number | null): string | null {
        if (time === null) {
            return null;
        }

        let secsNum = Math.floor((time / 1000)) % 60;
        let minsNum = Math.floor((time / 60000)) % 60;
        let hoursNum = Math.floor(time / (60000 * 60)) % 24;

        let secs = (secsNum < 10) ? '0' + secsNum : secsNum;
        let mins = (minsNum < 10) ? '0' + minsNum : minsNum;
        let hours = (hoursNum < 10) ? '0' + hoursNum : hoursNum;
        return hours + ':' + mins;

    }


    /**
     * @private
     * @param {?string} time
     * @return {?number}
     */
    convertElTypeToTime_(time: string | null): number | null {
        if (time == null) {
            return null;
        }
        let parts = time.split(':');
        let hours = parseInt(parts[0], 10);

        let mins = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        let secs = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        return ((((hours * 60) + mins) * 60) + secs) * 1000;

    }

    updateState_(helper: WidgetHelper) {
        if (!this.configB_) {
            return; 
        }
        if (helper.isGood()) {
            let set = (el:Element, prop:string, v:string|null)=> {
                if (v == null) {
                    if (el.hasAttribute(prop)) {
                        el.removeAttribute(prop);
                    }
                } else {
                    if (el.getAttribute(prop) !== v) {
                        el.setAttribute(prop, v);
                    }
                }
            };
            setElementShown(this.time_, this.configB_.get().editable);
            setElementShown(this.readonly_, !this.configB_.get().editable);
            this.time_.disabled = !this.configB_.get().enabled.val();

            let toSet = this.valueB_!.get();

            if (toSet != null) {
                let dt = new Date(0);
                dt.setHours(0, 0, 0, toSet);
                let format : Intl.DateTimeFormatOptions = {hour: '2-digit'};
                let step = this.configB_.get().step;
                if (step % 36000 !== 0) {
                    format.minute = '2-digit';
                }

                if (step % 60 !== 0) {
                    format.second = '2-digit';
                }
                this.readonly_.innerText = dt.toLocaleTimeString(undefined, format);
            } else {
                this.readonly_.innerText = '';
            }

            set(this.time_, 'value', this.convertTimeToElType_(this.valueB_!.get()));
            set(this.time_, 'min', this.convertTimeToElType_(this.configB_!.get().min));
            set(this.time_, 'max', this.convertTimeToElType_(this.configB_!.get().max));
        }


    };

    /**
     * @param {{min: ?number, max: ?number}} bounds
     * @param {?number} value
     * @return {boolean}
     */
    isValid(bounds: { min?: number, max?: number, step?: number }|undefined, value: number|null): boolean {
        if (value ===null) {
            return false;
        }
        if (!bounds) {
            return true;
        }
        if (bounds.min != null && value < bounds.min) {
            return false;
        }
        if (bounds.max != null && value > bounds.max) {
            return false;
        }

        if (bounds.min != null && bounds.step != null) {
            return (value - bounds.min) % bounds.step == 0;
        }
        return true;
    };

    /**
     * @param {?} d
     * @return {?}
     */
    static convertTimeToLocal(d:Date):number {
        return d.getHours() * 3600000 + 60000 * d.getMinutes() + d.getSeconds() * 10000;

    }

    /**
     * @param date in milliseconds, if this not at 00:00:00 will make it so
     * @param time in milliseconds
     * @return date in milliseconds
     */
    static convertToDateMs(date: number, time: number): number {
        let d = new Date(date);
        // to it this way instead of adding time because of daylight savings

        d.setHours(Math.floor(time / 3600000), Math.floor(time / 60000) % 60, Math.floor(time / 1000) % 60, time % 1000);
        return d.getTime();
    }

}

export const TimeColumn = makeStructColumn(TimeWidget);
