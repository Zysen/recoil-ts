/**
 *
 * @param {recoil.structs.table.ColumnKey} key
 * @param {string|Node} name
 * @param {recoil.frp.Behaviour<!Array<T>>|Array<T>} list
 * @param {(recoil.frp.Behaviour<Object>|Object)=} opt_options
 * @implements {recoil.ui.widgets.table.Column}
 * @template T
 * @constructor
 */
import {TableCellHelper} from "../../../frp/table";
import { InputWidget } from "../input";
import {BehaviourOrType, extend, StructType} from "../../../frp/struct";
import {Behaviour} from "../../../frp/frp";
import {ColumnKey} from "../../../structs/table/columnkey";
import {Column} from "./column";
import {WidgetScope} from "../widgetscope";
import {TableCell} from "../../../structs/table/table";
import {Message} from "../../message.ts";
import {ComboWidget} from "../combowidget.ts";

class InputComboColumn<Type> implements Column<Type> {
    private readonly key_: ColumnKey<Type>;
    private readonly name_: string|Message;
    private readonly list_: BehaviourOrType<Type[]>;
    private readonly options_: StructType;

    constructor(key: ColumnKey<Type>, name: string|Message, list: BehaviourOrType<Type[]>, opt_options: BehaviourOrType<StructType>) {
        this.key_ = key;
        this.name_ = name;
        this.list_ = list;
        this.options_ = opt_options || {};
    };

    /**
     *
     * @param {recoil.ui.WidgetScope} scope
     * @param {!recoil.frp.Behaviour<recoil.structs.table.TableCell>} cellB
     * @return {recoil.ui.Widget}
     */
    static defaultWidgetFactory<T>(scope:WidgetScope, cellB:Behaviour<TableCell<T>>) {
        let frp = scope.getFrp();
        let value = TableCellHelper.getValue(frp, cellB);


        let metaData = TableCellHelper.getMeta(frp, cellB);

        let input = new InputWidget(scope);
        let widget = new ComboWidget(scope, input, function (v) {
            input.forceSetValue(v);
        });

        widget.attachStruct(extend(frp, metaData, {value: value}) as any);
        input.attachStruct(extend(frp, metaData, {value: value}) as Behaviour<any>);

        return widget;
    }

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
        return  {
            name: this.name_, list: this.list_,
            cellWidgetFactory: InputComboColumn.defaultWidgetFactory,
            ...curMeta
        };
    }

    /**
     * @return {recoil.structs.table.ColumnKey}
     */
    getKey():ColumnKey<Type> {
        return this.key_;
    }

}


