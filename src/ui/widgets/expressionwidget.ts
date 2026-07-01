import {Widget} from "./widget.ts";
import {WidgetScope} from "./widgetscope.ts";
import {InputWidget} from "./input.ts";
import {StandardOptions} from "../frp/util.ts";
import {StringConverter} from "../../converters/stringconverter.ts";
import {makeStructColumn} from "./table/column.ts";
import { UnconvertType } from "../../converters/typeconverter.ts";
import {Messages} from "../messages.ts";
import {type AttachType, extend} from "../../frp/struct.ts";
import {ExpParser} from "../../util/tokenizer.ts";
import {Chooser} from "../../frp/chooser.ts";
import {Message} from "../message.ts";
import {ErrorType} from "../../frp/frp.ts";

export class ExprWidget extends Widget {
    private readonly input_:InputWidget;

    constructor(scope: WidgetScope) {
        let input = new InputWidget(scope);
        super(scope, input.getElement())
        this.input_ = input;
    }


    /**
     * attachable behaviours for widget
     */
    static options = StandardOptions('value', {
        decimalPlaces: null
    });

    attachStruct(options:AttachType<{
        value: string,
        classes?: string[],
        placeholder?: string | Message, // default null
        immediate?: boolean, // default true
        converter?: StringConverter<string>,
        maxLength?: number,
        outErrors?: ErrorType[],
        displayLength?: number,
        spellcheck?: boolean,
        charValidator?: (c: string) => boolean,
    }>) {
        let frp = this.scope_.getFrp();

        let bound = ExprWidget.options.bind(frp, options);

        let expConverterB = frp.liftB( (dp) => {
            return new ExprConverter(dp) as StringConverter<string>;
        }, bound.decimalPlaces());

        let defConverter = new ExprFocusStringConverter();

        let modOptions = extend(
            frp, options,
            {
                converter: Chooser.if(
                    this.input_.getFocus(), defConverter, expConverterB)
            });

        this.input_.attachStruct(modOptions as any);
    }
}

export class ExprConverter implements StringConverter<string|null> {
    private readonly decimalPlaces_: number | undefined;

    constructor(decimalPlaces?: number) {
        this.decimalPlaces_ = decimalPlaces;
    }

    convert(val: string | null): string {
        if (val == undefined) {
            return '';
        }
        let res = new ExpParser().eval(val);
        if (res == undefined) {
            return val;
        }

        return this.decimalPlaces_ == null ? res + '' : res.toFixed(this.decimalPlaces_) + '';
    }
    unconvert(val: string): UnconvertType<string | null> {
        let res = new ExpParser().eval(val || '');
        if (res == undefined || isNaN(res)) {
            return {error: Messages.NOT_APPLICABLE};
        }

        return {value: val};
    }

}

export class ExprFocusStringConverter implements StringConverter<string> {
    convert(val: string): string {
        return val != undefined ? val : '';   }
    unconvert(val: string): UnconvertType<string> {
        let res = new ExpParser().eval(val);
        if (res == null) {
            return {error:Messages.INVALID_EXPRESSION, value:val, settable:true};

        }
        return {value: val};
    }

}

export const ExprColumns = makeStructColumn(ExprWidget);
