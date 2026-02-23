import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {SelectorWidget} from "../selectorwidget.ts";
import {TableCellHelper} from "../../../frp/table.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {ColumnBase, LabelType} from "./column.ts";
import {StructType} from "../../../frp/struct.ts";

export class SelectColumn<Type> extends ColumnBase<Type> {
    constructor(key: ColumnKey<Type>, name: LabelType, list: Type[] = [], opt_options?: StructType) {
        super(key, name, SelectColumn.defaultWidgetFactory, {list, ...(opt_options || {})});

    }
   static defaultWidgetFactory<Type>(scope: WidgetScope, cellB: Behaviour<TableCell<Type>>): SelectorWidget<Type> {
        let widget = new SelectorWidget<Type>(scope);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB));
        return widget;
    }

}