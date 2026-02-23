import {create, Inversable} from "./inversable";
import {ColumnKey} from "./columnkey";
import {MutableTable, Table, TableRow} from "./table";
import {Order} from "./order";
import {Behaviour, BehaviourList1} from "../../frp/frp";
import {BehaviourOrType} from "../../frp/struct";


export class SwapUnion implements Inversable<Table, {tables:Table[]}> {
    private idCols_: ColumnKey<any>[];
    private srcFunc_:(r: TableRow) => number;
    private order_:Order;
    
    /**
     * does a sql union on 2 tables, this is like union the source table can change depending on the
     * data in the table is. this assumes the primary key is unique across the tables
     *
     * @param idCols columns that are set will come back the same primary keys may change if new row
     * @param srcFunc function to determine which src the row should be written out to
     */
    constructor(idCols: ColumnKey<any>[], srcFunc: (r: TableRow) => number) {
        this.idCols_ = idCols;
        this.srcFunc_ = srcFunc;
        this.order_ = new Order();
    }

    calculate(params: { tables: Table[]; }): Table {
        let tables = params.tables;

        let result = params.tables[0].createEmpty();
        this.order_.start();
        for (let i = 0; i < tables.length; i++) {
            let table = tables[i];
            result.addMeta(table.getMeta());
            for (let col of table.getColumns()) {
                result.addColumnMeta(col, table.getColumnMeta(col));
            }

            for (let {row} of table) {
                this.order_.addRow(row);
            }
        }
        this.order_.apply(result);
        return result.freeze();
    }
    inverse(table: Table, sources: { tables: Table[]; }): { tables: Table[]; } {

        let tables:MutableTable[] = [];

        sources.tables.forEach(function(table) {
            tables.push(table.createEmpty());
        });
        let me = this;
        this.order_.rememberStart(this.idCols_);
        for (let {row} of table) {
            let src = me.srcFunc_(row);
            if (src < 0 || src >= tables.length) {
                throw 'Unknown destination';
            }
            tables[src].addRow(row);
            me.order_.remember(row);
        }
        let res:Table[] = [];

        for (let table of tables) {
            res.push(table.freeze());
        }
        return {tables: res};
    }


    clone(): SwapUnion {
        let res = new SwapUnion(this.idCols_, this.srcFunc_);
        return res;
    }

    /**
     * @param {!Array<recoil.structs.table.ColumnKey>} idCols columns that are set will come back the same primary keys may change if new row
     * @param {function(!recoil.structs.table.TableRow):number} srcFunc function to determine which src the row should be written out to
     * @param {!recoil.frp.Behaviour<!recoil.structs.table.Table>|!recoil.frp.Behaviour<recoil.structs.table.Table>} first
     * @param {...(!recoil.frp.Behaviour<!recoil.structs.table.Table>|!recoil.frp.Behaviour<recoil.structs.table.Table>|recoil.structs.table.Table)} let_rest
     * @return {!recoil.frp.Behaviour<!recoil.structs.table.Table>} }
     */
    static createB(idCols:ColumnKey<any>[], srcFunc:(r:TableRow) => number, first:Behaviour<Table>, ...rest:BehaviourOrType<Table>[]) {
        let frp = first.frp();

        let tables = [first].concat(rest.map(v => frp.toBehaviour(v))) as BehaviourList1<Table>;


        let tablesB = frp.liftBI(
            ():Table[] => tables.map(t => t.get()),
            (out:Table[]) => {
                for (let i = 0; i < out.length; i++) {
                    tables[i].set(out[i]);
                }
            }, ...tables);

        return create(frp, new SwapUnion(idCols, srcFunc), {tables: tablesB});
    }
}





