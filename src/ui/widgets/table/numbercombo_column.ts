import {Column, ColumnBase, LabelType} from "./column.ts";
import {ComboWidget} from "../combowidget.ts";
import {NumberWidget} from "../number.ts";
import {TableCellHelper} from "../../../frp/table.ts";
import {WidgetScope} from "../widgetscope.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {StructType} from "../../../frp/struct.ts";

export class NumberComboColumn extends ColumnBase<number> {
    constructor(key: ColumnKey<number>, name: LabelType, opt_options?: StructType) {
        super(key, name, NumberComboColumn.defaultWidgetFactory, opt_options)
    }

    /**
     * @private
     * @param {recoil.ui.WidgetScope} scope
     * @param {!recoil.frp.Behaviour<recoil.structs.table.TableCell>} cellB
     * @return {recoil.ui.Widget}
     */
    static defaultWidgetFactory(scope: WidgetScope, cellB: Behaviour<TableCell<number>>): ComboWidget {
        let widget = new NumberWidget(scope);
        let combo = new ComboWidget(scope, widget);
        let dataB = TableCellHelper.getMetaValue(cellB);
        widget.attachStruct(dataB);
        combo.attachStruct(dataB);
        return combo;
    }

}