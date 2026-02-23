import {create, Inversable} from "./inversable";
import {Table, TableRow} from "./table";
import {ColumnKey} from "./columnkey";
import {AvlTree} from "../avltree";
import {compareKey} from "../../util/object";
import {Behaviour} from "../../frp/frp";
import {BehaviourOrType} from "../../frp/struct";

type ColFilterType<T> = (v:T) => boolean;

export class Filter implements  Inversable<Table, {table:Table, filter:(row:TableRow)=>boolean}>{
    private srcCol_ = new ColumnKey<any[]|null>('$src', undefined, undefined,  null);
    calculate(params: { table: Table; filter: (row: TableRow) => boolean; }): Table {
        let result = params.table.createEmpty([], [this.srcCol_]);
        for (let {row,key} of params.table) {
            if (params.filter(row)) {
                result.addRow(row.set(this.srcCol_, key));
            }
        }
        return result.freeze();
    }
    inverse(table: Table, sources: { table: Table; filter: (row: TableRow) => boolean; }): { table: Table} {
        let result = sources.table.createEmpty();
        let replaceMap = new AvlTree<{key:any[],row:TableRow}, {key:any[]}>(compareKey);

        for (let {row} of table) {
            replaceMap.add({key: row.get(this.srcCol_) as any[], row: row});
        }

        for (let {row,key} of sources.table) {
            if (sources.filter(row)) {
                let newRow = replaceMap.findFirst({key: key});
                if (newRow) {
                    result.addRow(newRow.row);
                    replaceMap.remove(newRow);
                }
            }
            else {
                result.addRow(row);
            }
        }
        for (let node of replaceMap) {
            result.addRow(node.row);
        }
        return {table: result.freeze()};
    }
    static createRowFilterB(tableB:Behaviour<Table>, filter:BehaviourOrType<(row:TableRow)=> boolean>) {
        return create(tableB.frp(), new Filter(), {table: tableB, filter: filter});
    }
    createColFilterB<T>(tableB:Behaviour<Table>, column:BehaviourOrType<ColumnKey<T>>, filter:BehaviourOrType<(v:T) => boolean>) {
        let frp = tableB.frp();
        let calc = (filter: ColFilterType<T>, col:ColumnKey<T>) => {
            return (row:TableRow):boolean => {
                return filter(row.get(col)!);
            }
        }
        let filterB = frp.liftB(
            calc,
            frp.toBehaviour(filter), frp.toBehaviour(column));
        return Filter.createRowFilterB(tableB, filterB);
    }
}

