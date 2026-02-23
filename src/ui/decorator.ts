import {Widget} from "./widgets/widget.ts";
import {WidgetScope} from "./widgets/widgetscope.ts";
import {Behaviour} from "../frp/frp.ts";
import {TableCell} from "../structs/table/table.ts";

export type WidgetFactory = (scope: WidgetScope, cellB: Behaviour<TableCell<any>>) => Widget;

/**
 * @constructor
 * @param {?function() : recoil.ui.RenderedDecorator} decorator
 * @param {Element} outer
 * @param {Element=} opt_inner
 */
export class RenderedDecorator {
    inner: Element|null;
    outer: Element|null;
    factory?: WidgetFactory;
    decorator: () => RenderedDecorator;

    constructor(decorator: () => RenderedDecorator, outer:Element|null, opt_inner?: Element) {
        this.inner = opt_inner === undefined ? outer : opt_inner;
        this.outer = outer;
        this.decorator = decorator;
    };
}
