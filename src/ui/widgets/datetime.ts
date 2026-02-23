import { makeStructColumn } from "./table/column.ts";
import {WidgetScope} from "./widgetscope.ts";
import {getStandardOptionsGroup, StandardOptions, StandardOptionsBoundType, StandardOptionsType} from "../frp/util.ts";
import {AttachType} from "../../frp/struct.ts";
import {DateWidget} from "./date.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {createDom, setAtrribute, setElementShown} from "../dom/dom.ts";
import {Widget} from "./widget.ts";
import {TagName} from "../dom/tags.ts";
import {EventHelper} from "../eventhelper.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {enable} from "../dom/classlist.ts";
import {Behaviour} from "../../frp/frp.ts";


export class DateTimeWidget extends Widget {
    private readonly readonly_: HTMLSpanElement;
    private readonly date_: HTMLInputElement;
    private configB_?: Behaviour<{ allowNone: boolean, min: number|null, max: number|null, step: number } & StandardOptionsBoundType>
    private valueB_?: Behaviour<number|null>;
    private readonly helper_: WidgetHelper;
    private readonly tooltipHelper_: EnabledTooltipHelper;

    constructor(scope: WidgetScope) {
        let date = createDom('input', {type: 'datetime-local'});
        let readonly = createDom(TagName.SPAN, {});

        super(scope, createDom('div', {class: 'recoil-date-cont'}, date, readonly))

        let frp = scope.getFrp();

        this.date_ = date;
        this.readonly_ = readonly;
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.tooltipHelper_ = new EnabledTooltipHelper(scope, this.getElement(), this.date_);


        EventHelper.listen(this.date_, EventType.BLUR, () => {
            this.helper_.forceUpdate();

        });
        EventHelper.listen(this.date_, EventType.CHANGE, () => {
            if (!this.valueB_ || !this.configB_) {
                return;
            }

            frp.accessTrans(()=> {
                let dt = this.date_.value;
                let outDate = DateTimeWidget.convertToExternal_(dt);
                let valid = DateWidget.isValid(this.configB_!.get(), outDate);
                enable(this.date_, 'recoil-error', !valid);
                if (valid) {
                    this.valueB_?.set(outDate);
                }
            }, this.valueB_, this.configB_);
        });
    };


    static options = StandardOptions('value', {allowNone: false, min: null, max: null, step: 1});

    attachStruct(options: AttachType<{
        value: number,
        allowNone?: boolean,
        min?: number | null,
        max?: number | null,
        step?: number,
    } & StandardOptionsType>) {
        let frp = this.scope_.getFrp();
        let bound = DateTimeWidget.options.bind(frp, options);

        this.valueB_ = bound.value();
        this.configB_ = getStandardOptionsGroup(bound, [bound.min, bound.max, bound.step, bound.allowNone]);
        this.helper_.attach(this.valueB_, this.configB_);
        this.tooltipHelper_.attach(this.configB_, this.helper_);
    };


    private updateState_(helper: WidgetHelper) {

        if (helper.isGood()) {
            let value = this.valueB_!.get();
            let toSet = this.convertToInternal_(value);
            if (DateTimeWidget.convertToExternal_(this.date_.value) !== value) {
                this.date_.value = toSet;
            }
            const config = this.configB_!.get();

            setAtrribute(this.date_, 'min', this.convertToInternal_(config.min));
            setAtrribute(this.date_, 'max', this.convertToInternal_(config.max));
            if (this.date_.step != String(Math.round(config.step / 1000))) {
                this.date_.step = String(Math.round(config.step / 1000));
            }
            let valid = DateWidget.isValid(config, this.valueB_!.get());
            enable(this.date_, 'recoil-error', !valid);

            setElementShown(this.date_, config.editable);
            setElementShown(this.readonly_, !config.editable);
            if (toSet != null) {
                let dt = new Date(value!);
                this.readonly_.innerText = dt.toDateString() + ' ' + dt.toLocaleTimeString();
            } else {
                this.readonly_.innerText = '';
            }
        } else {
            setElementShown(this.date_, true);
            setElementShown(this.readonly_, false);
        }

    };

    private static convertToExternal_(date:string):number|null {
        let dt = date + '';
        if (date == null || dt === '') {
            return null;
        }

        let dateTimeParts = date.split('T');
        let dateParts = dateTimeParts[0].split('-');
        let timeParts = dateTimeParts[1].split(':');
        let secondParts = (timeParts.length > 2 ? timeParts[2] : '00').split('.');
        if (secondParts.length < 2) {
            secondParts.push('000');
        }

        let pi  = (v:string) => parseInt(v, 10);
        return new Date(pi(dateParts[0]), pi(dateParts[1]) - 1, pi(dateParts[2]), pi(timeParts[0]), pi(timeParts[1]), pi(secondParts[0]), pi(secondParts[1])).getTime();
    }

    private convertToInternal_(date:null|number):string {
        return DateTimeWidget.convertToInternal_(date);
    }

    private static padNumber(value:number, n: number): string {
        return ('' + value).padStart(n, '0');
    }

    private static convertToInternal_(date:number|null) :string {
        if (date == undefined) {
            return '';
        }
        let d = new Date(date);
        const pn = DateTimeWidget.padNumber;

        return pn(d.getFullYear(), 4) + '-' + pn(d.getMonth() + 1, 2) + '-' + pn(d.getDate(), 2) + 'T' + pn(d.getHours(), 2) + ':' + pn(d.getMinutes(), 2) + ':' + pn(d.getSeconds(), 2);

    }
}

export const DateTimeColumn = makeStructColumn(DateTimeWidget);
