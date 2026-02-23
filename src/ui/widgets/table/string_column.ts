import {Column, LabelType} from "./column.ts";
import {WidgetScope} from "../widgetscope.ts";
import {StructType} from "../../../frp/struct.ts";
import {removeUndefined} from "../../../util/object.ts";
import {InputWidget} from "../input.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {Widget} from "../widget.ts";
import {TableCellHelper} from "../../../frp/table.ts";

export class StringColumn<Type> implements Column<Type> {
    private key_: ColumnKey<Type>;
    private name_:LabelType;
    private meta_:StructType;
    constructor(key: ColumnKey<Type>, name: LabelType, opt_maxChars?: number, opt_editable?: boolean) {
        this.meta_ = removeUndefined(
            {
                maxChars: opt_maxChars,
                editable: opt_editable
            });
        this.key_ = key;
        this.name_ = name;
    };

    /**
     * adds all the meta information that a column should need
     * this should at least include cellWidgetFactory
     * other meta data can include:
     *   headerDecorator
     *   cellDecorator
     * and anything else specific to this column such as options for a combo box
     *
     * @param {Object} curMeta
     * @return {Object}
     */
    getMeta(curMeta:StructType) {
        return {
            name: this.name_,
            cellWidgetFactory: StringColumn.defaultWidgetFactory,
            ...this.meta_, ...curMeta
        };
    }

    static defaultWidgetFactory<T>(scope: WidgetScope, cellB: Behaviour<TableCell<T>>): Widget {
        let frp = scope.getFrp();
        let widget = new InputWidget(scope);
        widget.attachStruct( TableCellHelper.getMetaValue(cellB) as Behaviour<any>);
        return widget;
    }

    getKey():ColumnKey<Type> {
        return this.key_;
    }
}
