/**
 * provides a behaviour of a cell in a table
 * with this behaviour you should be able to set and get the value
 * however the meta data will be read only
 */

import {BehaviourOrType, StructType} from "./struct.ts";
import {Behaviour, BStatus, Frp, TypedBehaviourList} from "./frp.ts";
import {Table, TableCell, TableInterface, TableRow, TableRow as TRow} from "../structs/table/table.ts";
import {getFrp, Util} from "./util.ts";
import {ColumnKey} from "../structs/table/columnkey.ts";


/**
 * @param frp the frp engine
 * @param tableV
 * @param  keysV
 */
export class TableRowHelper {
    static create(frp: Frp, tableV: BehaviourOrType<Table>, keysV: BehaviourOrType<any[]>): Behaviour<TRow> {
        let util = new Util(frp);

        let keys = util.toBehaviour(keysV);
        let table = util.toBehaviour(tableV);

        return frp.statusLiftBI<TRow, TRow>(
            (): BStatus<TRow> => {
                let row = table.get().getRow(keys.get());
                if (row === null) {
                    return BStatus.notReady();
                }

                return new BStatus(row);
            },
            function (row: TRow) {
                let mTable = table.get().unfreeze();
                mTable.setRow(keys.get(), row);
                table.set(mTable.freeze());
            }, table, keys);
    }

    static get<T>(row: BehaviourOrType<TRow>, columnKey: BehaviourOrType<ColumnKey<T>>): Behaviour<T> {
        let frp = getFrp([row, columnKey]);
        let rowB:Behaviour<TRow> = frp.toBehaviour(row);
        let columnB = frp.toBehaviour(columnKey);

        return frp.liftBI<T,T,[Behaviour<TRow>, Behaviour<ColumnKey<T>>]>(
            (row:TRow, column:ColumnKey<T>):T => {
                return row.get(column) as T;
            },
            function (val:T) {
                rowB.set(rowB.get().set(columnB.get(), val));
            }, rowB, columnB);
    }


    /**
     * like get but allows null rows, this is not inversable for now
     */
    static safeGet<T>(row: BehaviourOrType<TRow>, columnKey: BehaviourOrType<ColumnKey<T>>): Behaviour<T|null> {
        let frp = getFrp([row, columnKey]);
        let util = new Util(frp);

        let rowB = util.toBehaviour(row);
        let columnB = util.toBehaviour(columnKey);

        return frp.liftB(
            function (row:TableRow, column) {
                if (!row) {
                    return null;
                }
                return row.get(column);
            },
            rowB, columnB);
    }
}

/**
 * this wil return an bidirectional table cell it will contain the meta data from the
 * cell, column, row, and table.
 *
 **/
export class TableCellHelper {
    static create<T>(frp: Frp, tableV: BehaviourOrType<Table>, keysV: BehaviourOrType<any[]>, columnV: BehaviourOrType<ColumnKey<T>>) {
        let tableB = frp.toBehaviour(tableV);
        let keysB = frp.toBehaviour(keysV);

        let columnB = frp.toBehaviour(columnV);
//, keys: any[], column: ColumnKey<T>
        return frp.liftBI<TableCell<T>, TableCell<T>, TypedBehaviourList<[Table,any[],ColumnKey<T>]>>(
            (table: Table,keys: any[], column :ColumnKey<T>): TableCell<T> =>{
                let cell = table.getCell(keys, column);
                let tableMeta = table.getMeta();
                let rowMeta = table.getRowMeta(keys);
                let columnMeta = table.getColumnMeta(column);
                if (cell === null) {
                    throw 'cell not found';
                }
                let meta = {...tableMeta, ...rowMeta, ...columnMeta, ...cell.getMeta()};
                return cell.setMeta(meta);

            },
            ((val: TableCell<T>)=> {
                let mTable = tableB.get().unfreeze();
                mTable.setCell(keysB.get(), columnB.get(), val);
                tableB.set(mTable.freeze());
            }) as any, tableB, keysB, columnB);
    }

    /**
     * this wil return an bidirectional table cell it will contain the meta data from the
     * cell, column, row, and table. Setting the meta data will have no effect
     *
     **/
    static createHeader<T>(frp: Frp, tableV: BehaviourOrType<Table>, columnV: BehaviourOrType<ColumnKey<T>>):Behaviour<TableCell<undefined>> {
        let util = new Util(frp);

        let tableB = util.toBehaviour(tableV);
        let columnB = util.toBehaviour(columnV);

        return frp.liftB((table:Table, column:ColumnKey<any>)=> {
                let tableMeta = table.getMeta();
                let columnMeta = table.getColumnMeta(column);
                let meta = {...tableMeta, ...columnMeta};
                return new TableCell<undefined>(undefined, meta);
            }, tableB, columnB);

    }


    /**
     * gets just the meta information out of a cell
     */
    static getValue<Type>(frp: Frp, cellB: Behaviour<TableCell<Type>>): Behaviour<Type> {


        return frp.liftBI(
            function (cell: TableCell<Type>) {
                return cell.getValue();
            },
            function (val: Type) {
                cellB.set(cellB.get().setValue(val));
            }, cellB);
    }


    /**
     * gets just the meta information out of a cell
     */

    static getMeta(frp: Frp, cellB: Behaviour<TableCell<any>>): Behaviour<StructType> {
        return frp.liftBI(
            function (cell: TableCell<any>) {
                return cell.getMeta();
            }, (meta: StructType) => {
                if (cellB.good()) {
                    cellB.set(cellB.get().setMeta(meta));
                }
            },
            cellB);
    }

    static getMetaValue<Type extends StructType = StructType>(cellB: Behaviour<TableCell<any>>, valueName:string = 'value'): Behaviour<Type> {
        let frp = cellB.frp();
        return frp.liftBI(
            (cell: TableCell<any>):Type => {
                return {...cell.getMeta(), [valueName]: cell.getValue()} as Type;
            }, (both: Type) => {
                if (cellB.good()) {
                    let clone = {...both};
                    delete clone[valueName];
                    cellB.set(new TableCell(both[valueName], clone));
                }
            },
            cellB);
    }


}

/**
 * makes a map from the key -> value column
 * @template T
 */
export class TableHelper {
    static toMap<K extends {
        toString(): string
    }, V>(tableB: Behaviour<Table>, key: ColumnKey<K>, value: ColumnKey<V>): Behaviour<{ [index: string]: V }> {
        return tableB.frp().liftB(function (t: Table) {
            let res: { [index: string]: V } = {};

            for (let {row} of t) {
                let k = row.get(key) as K;
                res[k.toString()] = row.get(value) as V;
            }
            return res;
        }, tableB);
    }

    /**
     * makes a map from the key -> value column
     */

    static toRowMap<K extends { toString(): string }>(tableB: Behaviour<Table>, key: ColumnKey<K>): Behaviour<{
        [index: string]: TableRow
    }> {
        return tableB.frp().liftB(function (t: Table) {
            let res: { [index: string]: TableRow } = {};
            for (let {row} of t) {
                res[row.get(key)?.toString() || ''] = row;
            }
            return res;
        }, tableB);
    }


    static unused<T>(allB: Behaviour<Table>, usedB: Behaviour<Set<any>>, key: ColumnKey<T>): Behaviour<T[]> {
        return allB.frp().liftB((t: Table, used: StructType) => {
            let res: T[] = [];
            for (let {row} of t) {
                let v = row.get(key) as T;
                if (!used.has(v)) {
                    res.push(v);
                }
            }
            return res;
        }, allB, usedB);
    }


    /**
     * gets 1 column and returns it as a list
     */
    static colList<T>(tblB: Behaviour<TableInterface>, col: ColumnKey<T>): Behaviour<T[]> {
        return tblB.frp().liftB<T[]>((tbl: Table) => {
            let res = [];
            for (let {row: r} of tbl) {
                res.push(r.get(col) as T);
            }
            return res;
        }, tblB);
    }
}
