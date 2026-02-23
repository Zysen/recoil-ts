import {Column, ColumnBase, LabelType} from "./column.ts";
import { TableCell} from "../../../structs/table/table.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {BehaviourOrType, extend, StructType} from "../../../frp/struct.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {Label} from "../label.ts";
import {TableCellHelper} from "../../../frp/table.ts";

export class LabelColumn<Type = string> extends ColumnBase<Type> {
    constructor(key: ColumnKey<Type>, name: LabelType, opt_meta: StructType) {
        super(key, name, LabelColumn.defaultWidgetFactory, opt_meta);
    }

    static defaultWidgetFactory<Type>(scope: WidgetScope, cellB: Behaviour<TableCell<Type>>):Label<Type> {
        let widget = new Label<Type>(scope);
        widget.attachStruct(TableCellHelper.getMetaValue<any>(cellB));
        return widget;
    }

}
