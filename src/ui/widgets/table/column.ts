import {StructType} from "../../../frp/struct.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {CellWidget, Widget, WidgetInterface} from "../widget.ts";
import {TableCell} from "../../../structs/table/table.ts";
import {WidgetScope} from "../widgetscope.ts";
import {AttachableWidget} from "../../frp/util.ts";
import {Message} from "../../message.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {TableCellHelper} from "../../../frp/table.ts";

export type CellWidgetFactory<Type> = (scope: WidgetScope, cellB:Behaviour<TableCell<Type>>) => Widget;
export type WidgetConstructorType = {new (scope:WidgetScope, opts?:StructType):AttachableWidget};
export type CellWidgetConstructorType<T> = {new (scope:WidgetScope, opts?:StructType):CellWidget<T>};
export type LabelType = string|Message|Node;
export type ColumnConstructorType<Type> = {new (column: ColumnKey<Type>, name: LabelType, opt_meta?: StructType):Column<Type>};
export interface Column<Type> {

    /**
     * adds all the meta information that a column should need
     * this should at least include cellWidgetFactory
     * other meta data can include:
     *   headerDecorator
     *   cellDecorator
     * and anything else specific to this column such as options for a combo box
     *
     */
    getMeta(curMeta: StructType): StructType;
    getKey(): ColumnKey<Type>;

}

export abstract class ColumnBase<Type> implements Column<Type> {
    private readonly key_: ColumnKey<Type>;
    private readonly name_: LabelType;
    private readonly meta_: StructType;
    private readonly factory_: null | ((scope: WidgetScope, cellB: Behaviour<TableCell<Type>>) => WidgetInterface);

    protected constructor(key: ColumnKey<Type>, name: LabelType, factory:((scope:WidgetScope, cellB:Behaviour<TableCell<Type>>) =>WidgetInterface) | null, meta?: StructType) {
        this.key_ = key;
        this.name_ = name;
        this.meta_ = meta || {};
        this.factory_ = factory;
    }

    getKey(): ColumnKey<Type> {
        return this.key_;
    }

    getMeta(curMeta: StructType): StructType {
        if (this.factory_) {
            return  {
                name: this.name_,
                ...this.meta_,
                cellWidgetFactory: this.factory_,
                ...curMeta
            };

        }
        else {
            return  {
                name: this.name_,
                ...this.meta_,
                ...curMeta
            };

        }
    }
}
/**
 * a utility to make a column that attaches to a widget
 * that has the interface of
 * create = new Widget(scope)
 * attachStruct = function ({value:*,...})
 */
export function makeStructColumn(widgetCons: WidgetConstructorType, opt_options?:StructType): ColumnConstructorType<any>  {
    const factory = (scope:WidgetScope, cellB:Behaviour<TableCell<any>>):WidgetInterface => {
        let widget:AttachableWidget = new widgetCons(scope, opt_options);
        widget.attachStruct(TableCellHelper.getMetaValue(cellB));
        return widget;
    };
    return class  extends ColumnBase<any>{
        constructor(column: ColumnKey<any>, name: LabelType, opt_meta?: StructType) {
            super(column, name, factory, opt_meta);
        }
    }
}


/**
 * a utility to make a column that attaches to a widget
 * that has the interface of
 * create = new Widget(scope)
 * attachStruct = function ({value:*,...})
 */
 export function makeCellColumn<T> (widgetCons:CellWidgetConstructorType<T>, opt_extra:StructType = {}):ColumnConstructorType<T> {
    let factory = function(scope:WidgetScope, cellB:Behaviour<TableCell<any>>) {
        let frp = scope.getFrp();
        let widget = new widgetCons(scope, opt_extra);
        let newCellB = frp.liftBI<TableCell<T>>(
            function(v) {
                return v;
            },
            (v:TableCell<T>)=> {
                let meta = {...cellB.get().getMeta(), ...v.getMeta()};
                let res = new TableCell(v.getValue(), meta);
                cellB.set(res);
            }, cellB);
        widget.attachCell(newCellB);
        return widget;
    };

   return class extends ColumnBase<any> {
        constructor(column: ColumnKey<T>, name: LabelType, opt_meta: StructType = {}) {
            super(column, name, factory, {...opt_extra, ...opt_meta});
        }
    }
}
