import {Column, ColumnBase, LabelType} from "./column.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {ButtonWidget} from "../button.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {StructType} from "../../../frp/struct.ts";
import {TableCellHelper} from "../../../frp/table.ts";

export class ButtonColumn extends ColumnBase<any> {
    constructor(key:ColumnKey<any>, name:LabelType, opt_options?:StructType) {
        super(key, name, ButtonColumn.defaultWidgetFactory, opt_options)
        //, opt_maxB, opt_stepB, opt_editableB
    }
    static defaultWidgetFactory(scope:WidgetScope, cellB:Behaviour<TableCell<any>>):ButtonWidget {
        let widget = new ButtonWidget(scope);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB,'action') as Behaviour<any>);
        return widget;
    }
}
