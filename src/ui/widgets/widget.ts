import {FLATTEN, NO_FLATTEN} from "../../frp/struct.ts";
import {WidgetScope} from "./widgetscope.ts";
import {Behaviour} from "../../frp/frp.ts";
import {TableCell} from "../../structs/table/table.ts";

export interface WidgetInterface<Type extends Element = Element> {
    getElement(): Type;
}

export abstract class Widget<T extends Element = Element> implements WidgetInterface<T>{
    readonly [FLATTEN] =  NO_FLATTEN;
    protected readonly  scope_: WidgetScope;
    protected readonly  element_: T;
    protected constructor(scope: WidgetScope, element:T) {
        this.scope_ = scope;
        this.element_ = element;
    }
    getElement():T {
        if (!this.element_) {
            throw new Error("No element found please set in constructor or override function.");
        }
        return this.element_;
    }
}

export abstract class CellWidget<T> extends Widget {
    protected constructor(scope: WidgetScope, opt_element:Element) {
        super(scope, opt_element);
    }
    abstract attachCell(cellB:Behaviour<TableCell<T>>):undefined;
}

