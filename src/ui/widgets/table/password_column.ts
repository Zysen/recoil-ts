import {ColumnBase, LabelType} from "./column.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {removeUndefined} from "../../../util/object.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {Widget} from "../widget.ts";
import {TableCellHelper} from "../../../frp/table.ts";
import {PasswordWidget} from "../passwordwidget.ts";

export class PasswordColumn extends ColumnBase<string> {
    constructor(key:ColumnKey<string>, name:LabelType, opt_maxChars?:number, opt_editable?:boolean) {
        super(key, name, PasswordColumn.defaultWidgetFactory,
            removeUndefined({
                maxChars: opt_maxChars,
                editable: opt_editable
            }));
    }

     static defaultWidgetFactory<Type>  (scope:WidgetScope, cellB:Behaviour<TableCell<Type>>):Widget {
            let frp = scope.getFrp();
            let widget = new PasswordWidget(scope);
            widget.attachStruct(TableCellHelper.getMetaValue(cellB));
            return widget;
     }

}
