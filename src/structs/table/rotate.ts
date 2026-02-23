import {Inversable} from "./inversable.ts";
import {MutableTable, MutableTableRow, Table, TableRow} from "./table.ts";
import {ColumnKey} from "./columnkey.ts";
import {AvlTree} from "../avltree.ts";
import {compareKey} from "../../util/object.ts";

export class Rotate implements Inversable<Table, { table:Table }> {

    /**
     * this rotates the table so that the column are rows and th rows are columns
     * it is best that all meta data is applied before rotation, so that the Correct Meta data and name
     * for the row can be applied
     *
     * The first column will be considered column header
     *
     * @param firstIsHeader if true first column the column header otherwize the header is removed, and
     *   the first column is data
     * @param  opt_keyCol
     * @param  opt_nameCol
     */
    private readonly firstIsHeader_: boolean;
    private readonly primaryKey_: ColumnKey<ColumnKey<any>>;
    private readonly colMapKey_: ColumnKey<{ srcPk: any[], destCol: ColumnKey<any> }[]> = new ColumnKey('$colmap');
    private readonly nameKey_: ColumnKey<string>;
    private readonly tableWidget_:{defaultHeaderDecorator: any, defaultHeaderWidgetFactory: any};
    private cachedColKeys_ = new AvlTree<{ key: any[], col: ColumnKey<any>, row: TableRow }, { key: any[] }>(compareKey)

    constructor(firstIsHeader: boolean,
                tableWidget: {defaultHeaderDecorator: any,  defaultHeaderWidgetFactory: any}, opt_keyCol?: ColumnKey<ColumnKey<any>>, opt_nameCol?: ColumnKey<string>) {
        this.firstIsHeader_ = firstIsHeader;
        this.primaryKey_ = opt_keyCol || new ColumnKey('$key');
        this.nameKey_ = opt_nameCol || new ColumnKey('$name');
        this.tableWidget_ = tableWidget;
    }

    static emptyDecorator():  null {
        return null;
    };

    calculate(params: { table: Table }) {
        let table = params.table;


        // work out what columns we will need
        let otherCols = [this.nameKey_, this.colMapKey_];

        for (let {row, key: pk} of table) {
            let cached = this.cachedColKeys_.findFirst({key: pk});
            if (!cached) {
                cached = {key: pk, col: new ColumnKey('' + pk), row};
                this.cachedColKeys_.add(cached);
            } else {
                cached.row = row;
            }
            otherCols.push(cached.col);
        }


        let result = new MutableTable([this.primaryKey_], otherCols);
        result.setMeta(table.getMeta());
        if (!this.firstIsHeader_) {
            result.addMeta({headerRowDecorator: Rotate.emptyDecorator});
        }
        // setup the column meta, for the first column it will be like a header renderer
        result.setColumnMeta(this.nameKey_, {name: '', position: 0, cellDecorator: this.tableWidget_.defaultHeaderDecorator});


        // for the other column we will set the row meta data on it, and add the column name

        let colPos = 1;
        for (let {row, key: pk} of table) {
            let cached = this.cachedColKeys_.findFirst({key: pk})!;
            let first = true;

            for (let {key:col} of table.placedColumns()) {
                if (first) {
                    result.setColumnMeta(cached.col, {name: row.get(col), position: colPos++});
                    result.addColumnMeta(cached.col, row.getMeta());
                }
                first = false;
            }

        }


        let pos = 0;
        // now add the data to the table
        for (let {key: col} of table.placedColumns()) {
            if (pos > 0 || !this.firstIsHeader_) {
                let newRow = new MutableTableRow(pos);
                newRow.set(this.primaryKey_, col);

                newRow.set(this.nameKey_, table.getColumnMeta(col).name);
                let colMeta = table.getColumnMeta(col);
                if (colMeta.rowDecorator) {
                    newRow.addRowMeta({rowDecorator: colMeta.rowDecorator});
                }
                newRow.addRowMeta({columnMeta: colMeta});
                newRow.setCellMeta(this.nameKey_, colMeta);
                newRow.addCellMeta(this.nameKey_, {
                    type: 'string', editable: false, errors: [],
                    cellWidgetFactory: this.tableWidget_.defaultHeaderWidgetFactory
                });
                let colMappings = [];

                for (let {row, key: pk, meta} of table) {
                    let cached = this.cachedColKeys_.findFirst({key: pk})!;

                    newRow.set(cached.col, row.get(col));
                    newRow.setCellMeta(cached.col, meta);
                    newRow.addCellMeta(cached.col, row.getCell(col)!.getMeta());
                    colMappings.push({srcPk: pk, destCol: cached.col});

                }
                newRow.set(this.colMapKey_, colMappings);
                result.addRow(newRow);
            }
            pos++;
        }

        return result.freeze();
    };

    /**
     * for now we do not handle adding new rows, that would be like adding a new
     * column, or adding new columns
     *
     */
    inverse(table: Table, sources: { table: Table }): { table: Table } {
        let dest = sources.table.unfreeze();
        let me = this;

        let toSet = new AvlTree<
                {key:{ srcPk: any[], destCol: ColumnKey<any> }[], row:MutableTableRow},
                {key:{ srcPk: any[], destCol: ColumnKey<any> }[]}>(compareKey);

        for (let {row} of table) {
            let destCol = row.get(me.primaryKey_)!;
            let rowMappings = row.get(me.colMapKey_);
            // this is because the first row will not have a mapping
            if (rowMappings) {
                rowMappings.forEach(function (mapping) {
                    let modifyRow = dest.getRow(mapping.srcPk);
                    if (modifyRow) {
                        dest.removeRow(mapping.srcPk);
                        toSet.add({key: mapping.srcPk, row: modifyRow.unfreeze()});
                    }
                    let found = toSet.findFirst({key: mapping.srcPk});
                    if (found) {
                        found.row.set(destCol, row.get(mapping.destCol));
                    }
                });
            }
        }
        for (let node of toSet) {
            dest.addRow(node.row);
        }
        return {table: dest.freeze()};
    }
}

