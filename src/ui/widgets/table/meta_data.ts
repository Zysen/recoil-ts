import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {Column, ColumnBase, LabelType} from "./column.ts";
import {flatten, getBehaviours, StructType} from "../../../frp/struct.ts";
import {Frp} from "../../../frp/frp.ts";
import {MutableTable, Table} from "../../../structs/table/table.ts";
import {StringColumn} from "./string_column.ts";
import {RenderedDecorator} from "../../decorator.ts";
import {createDom} from "../../dom/dom.ts";
import {makeEqualFunc} from "../../../util/object.ts";


/**
 * data that describes the table, it contains the columns and how to contruct the render widget
 * for that column
 */
export class TableMetaData {
    private reset_: boolean;
    private colSeperators_:ColumnKey<any>[] = [];
    private columns_: Column<any>[];
    private colSeperatorsOpts_:StructType[] = [];

    constructor(opt_reset: boolean = false) {
        this.columns_ = [];
        this.reset_ = !!opt_reset;
    };


    addColumn<ColumnType>(col: Column<ColumnType>) {
        if (!col) {
            throw new Error('undefined column');
        }
        this.columns_.push(col);
    }

    /**
     * @param {!recoil.structs.table.ColumnKey} key
     * @param {string|Node} name if you pass a node this will allow better formating of header
     * @param {!Object=} opt_meta
     * @param {!Object=} opt_DecOptions the options passed to createDom when the decorator is created
     * @param {!Object=} opt_RowMeta
     */

    addSeperatorCol(key: ColumnKey<any>, name: LabelType, opt_meta: StructType = {},
                    opt_DecOptions:StructType = {class: 'recoil-table-group'},
                    opt_RowMeta:StructType = {}) {
        if (!key) {
            throw new Error('undefined column key');
        }

        this.addColumn(new SeperatorColumn(key, name, opt_meta));
        this.colSeperators_.push(key);
        this.colSeperatorsOpts_.push({
            key: key,
            opt: opt_DecOptions,
            row: opt_RowMeta
        });
    }


    columns() : {key: ColumnKey<any>, col: Column<any>}[] {
        return this.columns_.map(c => ({key: c.getKey(), col: c}));
    }

    forEachColumn(func:(key: ColumnKey<any>, col: Column<any>) => void) {
        this.columns_.forEach(function (col) {
            func(col.getKey(), col);
        });
    }


    /**
     *
     * @template CT
     * @param {!recoil.structs.table.ColumnKey<CT>} key
     * @param {string|Node|!recoil.ui.message.Message} name if you pass a node this will allow better formating of header
     * @param {!Object=} opt_meta
     */
    add<ColumnType>(key: ColumnKey<ColumnType>, name: LabelType, opt_meta?: StructType) {
        if (!key) {
            throw new Error('undefined column key');
        }

        this.addColumn(new DefaultColumn(key, name, opt_meta || {}));
    }
    static SPAN_FUNC = Symbol("SpanFunc");

    static createSpanDecorator(size: number, opt_extra?: StructType): () => RenderedDecorator {
        let opts = {...(opt_extra || {}), ...{colspan: size}};
        let res = () => {
            return new RenderedDecorator(
                res,
                createDom('td', opts));

        };
        makeEqualFunc(res, TableMetaData.SPAN_FUNC, opts);
        return res;

    }
    /**
     * creates a new table with the meta data applied to it
     * if table is a mutable table it will also apply the meta data it
     * @param {!recoil.structs.table.Table|!recoil.structs.table.MutableTable} table
     * @return {!recoil.structs.table.Table}
     */
    applyMeta(table: Table | MutableTable): Table {
        let mtable = table instanceof MutableTable ? table : table.unfreeze();
        let pos = 0;
        if (this.reset_) {
            for (let col of mtable.getColumns()) {
                let meta = mtable.getColumnMeta(col);
                if (meta.hasOwnProperty('position')) {
                    let newMeta = {...meta};
                    delete newMeta.position;

                    mtable.setColumnMeta(col, newMeta);
                }
            }
        }
        for (let col of this.columns_) {
            let inMeta = {...table.getMeta(),... mtable.getColumnMeta(col.getKey())};
            let meta = col.getMeta(inMeta);
            if (meta.position === undefined) {
                meta.position = pos;
            }
            mtable.setColumnMeta(col.getKey(), meta);
            pos++;
        }

        if (this.colSeperators_.length > 0) {
            let res = mtable.freeze().createEmpty([], this.colSeperators_);

            this.colSeperatorsOpts_.forEach(function (opt) {
                res.addColumnMeta(opt.key, {

                    cellDecorator: TableMetaData.createSpanDecorator(mtable.size() + 1, opt.opt)
                });
            });

            for (let {row: mrow} of mtable.modifiableRows()) {
                for (let col of this.colSeperators_) {
                    mrow.set(col, null);
                    mrow.addCellMeta(col, {cellDecorator: null});

                }
                for (let opt of this.colSeperatorsOpts_) {
                    mrow.addRowMeta(opt.row);
                }
                res.addRow(mrow);
            }
            return res.freeze();
        }
        return mtable.freeze();
    }

    /**
     * return all the haviours containted in this metadata structure
     * @return {!Array<!recoil.frp.Behaviour>}
     */
    getBehaviours() {
        return getBehaviours(this);
    };

    /**
     * creates a behaviour that contains TableMetaData
     * @param {!recoil.frp.Frp} frp
     * @return {!recoil.frp.Behaviour<!Object>}
     */
    createB(frp: Frp) {
        return flatten(frp, this);
    };
}

export class DefaultColumn<Type> extends ColumnBase<Type> {
    constructor(key: ColumnKey<any>, name: LabelType, opt_meta?: StructType) {
        super(key, name,null , opt_meta)

    }


    /**
     * @param {Object} curMeta
     * @return {Object}
     */
    getMeta(curMeta: StructType): StructType {
        let meta = super.getMeta(curMeta);

        let factoryMap = meta['typeFactories'];
        let factory = (factoryMap === undefined || meta.type === undefined)
            ? undefined : factoryMap[meta.type];
        let column = factory === undefined
            ? undefined : factory(this.getKey(), meta.name, meta);

        if (column === undefined) {
            column = new StringColumn(this.getKey(), meta.name);
        }
        return column.getMeta(meta);
    }
}

class SeperatorColumn extends ColumnBase<any> {
    constructor(key: ColumnKey<any>, name: LabelType, opt_meta?: StructType) {
        super(key, name, null, opt_meta)
    }

    /**
     * @param {Object} curMeta
     * @return {Object}
     */
    getMeta(curMeta: StructType) {
        /**
         * @type {Object<string, *>}
         */
        let meta = super.getMeta(curMeta);

        let column = new StringColumn(this.getKey(), meta.name);

        return column.getMeta(meta);
    }
}
