import {Column, ColumnBase, LabelType} from "./column.ts";
import {WidgetScope} from "../widgetscope.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {StructType} from "../../../frp/struct.ts";
import {RadioWidget} from "../radio.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {TableCellHelper} from "../../../frp/table.ts";
import { Behaviour } from "../../../frp/frp.ts";

/**
 *
 * @param {recoil.structs.table.ColumnKey} key
 * @param {string} name
 * @param {(recoil.frp.Behaviour<Object>|Object)=} opt_options
 * @implements {recoil.ui.widgets.table.Column}
 * @template T
 * @constructor
 */
export class RadioColumn<Type> extends ColumnBase<Type> {
    constructor(key: ColumnKey<Type>, name: LabelType, opt_options?: StructType) {
        super(key, name, RadioColumn.defaultWidgetFactory, opt_options);
    }


    static defaultWidgetFactory<T>(scope: WidgetScope, cellB: Behaviour<TableCell<T>>): RadioWidget<T> {
        let frp = scope.getFrp();
        let widget = new RadioWidget<T>(scope);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB) as Behaviour<any>);
        return widget;
    }
}
