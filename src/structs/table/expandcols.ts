/**
 * @fileoverview
 * tables may contain sub tables, represented as objects which we may want to access as just a table,
 * this
 */

import {MutableTableRow, Table, TableRowInterface} from "./table";
import {ColumnKey} from "./columnkey";
import {StructType} from "../../frp/struct";
import {Inversable} from "./inversable";
import {clone} from "../../util/object.ts";
import {Path} from "../../db/path.ts";





/**
 * @interface
 */
export interface ExpandColsDef {
    getSubRow(row:TableRowInterface):TableRowInterface;
    setSubRow(row:MutableTableRow, isNew:boolean):void;
    getColumns():{col:ColumnKey<any>,meta:StructType}[];
    getSrcCol():ColumnKey<any>;
}
export enum CheckResult {
    Unchanged, // don't change the value no matter what,
    Null, // set the value to null
    Exists,
    NotExists,
}
const UNCHANGED = Symbol("UNCHANGED");


/**
 * @implements {recoil.frp.Inversable<!recoil.structs.table.Table,
 {table:!recoil.structs.table.Table,expand:!Array<!recoil.structs.table.ExpandColsDef>},
 {table:!recoil.structs.table.Table}>}>}
 * @constructor
 */
export class ExpandCols implements Inversable<Table, {table:Table, expand:ExpandColsDef[]}>{
    calculate(params: { table: Table; expand: ExpandColsDef[]; }): Table {
        let table = params.table;
        let expandInfos = params.expand;
        let extraCols:ColumnKey<any>[] = [];
        let extraMeta:StructType[] = [];
        for (let info of expandInfos) {
            info.getColumns().forEach(function(colInfo) {
                extraCols.push(colInfo.col);
                extraMeta.push(colInfo.meta);
            });
        }
        let res = table.createEmpty(undefined, extraCols);

        for (let i = 0; i < extraCols.length; i++) {
            res.setColumnMeta(extraCols[i], extraMeta[i]);
        }
        for (let {row,key:pk} of table) {
            let mrow = row.unfreeze();
            expandInfos.forEach(function(info) {
                mrow.addColumns(info.getSubRow(row));
            });
            res.addRow(mrow);
        }
        return res.freeze();
    }
    /**
     * for now, we do not handle adding new rows, that would be like adding a new
     * column, or adding new columns
     */
    inverse(table: Table, sources: { table: Table; expand: ExpandColsDef[]; }): { table: Table} {
        let dest = sources.table.createEmpty();
        let expandInfos = sources.expand;

        for (let {row,key:pk} of table){
            let mrow = row.unfreeze();
            let isNew = !sources.table.getRow(pk);
            expandInfos.forEach(function(info) {
                info.setSubRow(mrow, isNew);
            });
            dest.addRow(mrow);
        }
        return {table: dest.freeze()};
    }
}

type SubColType ={col:ColumnKey<any>, path:Path, defaultVal:any, map?:{from:string}, meta?:StructType};

function nullMetaGetter():StructType {
    return {};
}

export class PresenceDef<T extends StructType> implements ExpandColsDef {
    private col_;
    private subcols_: SubColType[];
    private check_:(row: TableRowInterface, setting: boolean) => CheckResult;
    private metaGetter_:(meta: StructType, col: ColumnKey<T>, path: Path)=>StructType;
    /**
     * @param check function to check outer object exists,
     *       the first parameter is the row that we are setting/getting the second is true if we are setting,
     *       this should return true or false, or null if we should set the container to null, or UNCHANGED if you don't ever
     *       want it to change from the original value
     * @param col
     * @param metaGetter this extracts meta data from the cell meta for the subcell for example errors
     * @param subcols
     */
    constructor(
        check: (row: TableRowInterface, setting: boolean) =>CheckResult,
        col: ColumnKey<T>,
        metaGetter: undefined |((meta: StructType, col: ColumnKey<T>, path: Path)=>StructType), subcols:SubColType[]) {

        this.metaGetter_ = metaGetter || nullMetaGetter;
        this.check_ = check;
        this.col_ = col;
        this.subcols_ = subcols;
    }

    /**
     * @param {!recoil.structs.table.TableRowInterface} row
     * @return {!recoil.structs.table.TableRowInterface}
     */
    getSubRow (row:TableRowInterface) {
        let res = new MutableTableRow();
        let exists = this.check_(row, false);
        let val = row.get(this.col_) as StructType;
        let meta = row.getCellMeta(this.col_) || {};
        let metaGetter = this.metaGetter_;
        let col = this.col_;
        for (let info of this.subcols_) {
            let curVal = exists ? val : null;
            if (exists) {
                let parts = info.path.parts();
                for (let i = 0; i < parts.length; i++) {
                    let part = parts[i];
                    if (curVal) {
                        if (info.map && i === parts.length - 1) {
                            curVal = curVal[info.map.from];
                        }
                        else {
                            curVal = curVal[part];
                        }
                    }
                }

                res.addCellMeta(info.col, metaGetter(meta, col, info.path));
            }


            res.set(info.col, curVal);
        }
        return res;
    }

    setSubRow(row:MutableTableRow, isNew:boolean) {
        let exists = this.check_(row, true);
        let unChanged = exists === CheckResult.Unchanged && !isNew;
        if (unChanged && !row.get(this.col_)) {
            return;
        }

        let val = clone(row.get(this.col_) || {}) as StructType;
        if (exists === CheckResult.Exists) {
            for (let info of this.subcols_) {
                let newVal = row.get(info.col);
                if (newVal === null && info.defaultVal !== undefined) {
                    newVal = info.defaultVal;
                }
                let prevVal = val;
                let parts = info.path.parts();

                for (let i = 0; i < parts.length - 1; i++) {
                    let next = prevVal[parts[i]];
                    if (unChanged && !next) {
                        return; // don't set anything that we can't
                    }
                    prevVal[parts[i]] = next || {};
                    prevVal = prevVal[parts[i]];
                }

                if (info.map) {
                    prevVal[info.map.from] = newVal;
                } else {
                    prevVal[parts[parts.length - 1]] = newVal;
                }
            }
            row.set(this.col_, val as T);
        } else if (exists === CheckResult.Null) {
            row.set(this.col_, null as any);
        }

    };

    /**
     * @return {!Array<{col:!recoil.structs.table.ColumnKey,meta:!Object}>}
     */
    getColumns():{col:ColumnKey<any>, meta:StructType}[] {
        return this.subcols_.map(info => ({col: info.col, meta: info.meta || {}}))
    }

    getSrcCol() {
        return this.col_;
    }
}
