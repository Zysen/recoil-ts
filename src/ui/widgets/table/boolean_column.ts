import {extend, StructBehaviourOrType, StructType} from "../../../frp/struct.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {Widget} from "../widget.ts";
import {ColumnBase, LabelType} from "./column.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {Checkbox} from "../checkbox.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {TableCellHelper} from "../../../frp/table.ts";

/**
 *
 * @param {recoil.structs.table.ColumnKey} key
 * @param {string} name
 * @param {(recoil.frp.Behaviour<Object>|Object)=} opt_options
 * @implements {recoil.ui.widgets.table.Column}
 * @template T
 * @constructor
 */
export class BooleanColumn extends ColumnBase<boolean> {
    constructor(key:ColumnKey<boolean>, name: LabelType, opt_options: StructType) {
        super(key, name, BooleanColumn.defaultWidgetFactory, opt_options)

    }

    static defaultWidgetFactory(scope: WidgetScope, cellB: Behaviour<TableCell<boolean>>): Widget {
        let widget = new Checkbox(scope);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB) as Behaviour<any>);
        return widget;
    }
}