import {CellWidgetFactory, ColumnBase, LabelType} from "./column.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";

export class CustomColumn<Type> extends ColumnBase<Type>{
    constructor(key: ColumnKey<any>, name: LabelType, factory: CellWidgetFactory<Type>) {
        super(key, name, factory)
    }
}
