import {Column, ColumnBase, LabelType} from "./column.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {StructType} from "../../../frp/struct.ts";
import {NumberWidget} from "../number.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {TableCellHelper} from "../../../frp/table.ts";

export class NumberColumn extends ColumnBase<number> {
    constructor(key: ColumnKey<number>, name: LabelType, opt_options?: StructType) {
        super(key, name, NumberColumn.defaultWidgetFactory, opt_options)
        //, opt_maxB, opt_stepB, opt_editableB
    }

    static defaultWidgetFactory(scope: WidgetScope, cellB: Behaviour<TableCell<number>>): NumberWidget {

        let widget = new NumberWidget(scope);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB));
        return widget;
    }
}