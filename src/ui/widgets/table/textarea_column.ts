import {ColumnBase, LabelType} from "./column.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {TableCellHelper} from "../../../frp/table.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {TextAreaWidget} from "../textareawidget.ts";

/**
 * @implements {recoil.ui.widgets.table.Column}
 * @template T
 * @constructor
 * @param {recoil.structs.table.ColumnKey} key
 * @param {string|!recoil.ui.message.Message} name
 *
 */
export class TextAreaColumn extends ColumnBase<string> {
    constructor(key: ColumnKey<string>, name: LabelType) {
        super(key, name, TextAreaColumn.defaultWidgetFactory)
    }

    static defaultWidgetFactory(scope:WidgetScope, cellB:Behaviour<TableCell<string>>) {
        let widget = new TextAreaWidget(scope);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB));
        return widget;
    }
}
