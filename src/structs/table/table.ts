import {type StructType} from "../../frp/struct.ts";
import {compare, compareAll, isEqual} from "../../util/object.ts";
import {AvlTree} from "../avltree.ts";
import {ColumnKey} from "./columnkey.ts";

export type KeyedMeta = {
    key: ColumnKey<any>;
    [index: string]: any;
}

export type TableMetaType = {
    [index: string]: KeyedMeta;
}

export type WrapInColumnKey<T extends any[]> = {
    [K in keyof T]: T[K] extends any ? ColumnKey<T[K]> : never;
}

export type ColKeyValue<T> = [ColumnKey<T>, T]

export interface TableInterface extends Iterable<{ row: TableRow, meta: StructType, key: any[] }> {

    size(): number;

    getMeta(): StructType;

    getColumnMeta(col: ColumnKey<any>): StructType;

    columns(): ({ key: ColumnKey<any>, meta: StructType })[];

    placedColumns(): ({ key: ColumnKey<any>, meta: StructType })[];

    modifiableRows(): Iterable<{ row: MutableTableRow, meta: StructType, key: any[] }>;
}

export interface TableRowInterface {
    /**
     * Gets only the value from the cell
     */
    get<T>(key: ColumnKey<T>): T | null;

    getCell<T>(key: ColumnKey<T>): TableCell<T> | null;

    getCellMeta<T>(key:ColumnKey<T>): StructType|null;

    columns(): Iterable<{ meta: StructType, key: ColumnKey<any> }>;

    hasColumn(key: ColumnKey<any>): boolean;

    columnValues(): ({ col: ColumnKey<any>, cell: any })[];
}


/**
 * construct a table which cannot change, provide a mutable table to get the value
 */
export class Table implements TableInterface {

    private readonly meta_: StructType;
    private columnMeta_: Map<ColumnKey<any>, StructType>;
    private readonly primaryColumns_: ColumnKey<any>[];
    private readonly otherColumns_: ColumnKey<any>[];
    private rows_: AvlTree<TableRow>;
    private ordered_: AvlTree<TableRow>;

    constructor(table: MutableTable) {
        this.meta_ = {...table.getMeta()};
        this.columnMeta_ = new Map(table.doNotUseColumnMeta().entries());


        this.primaryColumns_ = table.getPrimaryColumns();
        this.otherColumns_ = table.getOtherColumns();

        this.rows_ = new AvlTree(table.getRowComparator());
        this.ordered_ = new AvlTree(TableRow.positionComparator_(table.getRowComparator()));


        for (let {row} of table) {
            this.rows_.add(row);
            this.ordered_.add(row);
        }
    }

    getMeta() {
        return this.meta_;
    }

    columns(): ({ key: ColumnKey<any>; meta: StructType; })[] {
        let cols: { key: ColumnKey<any>; meta: StructType; }[] = [];
        const addCol = (key: ColumnKey<any>) => {
            let col = this.columnMeta_.get(key);
            cols.push({meta: col || {}, key: key});
        };
        this.primaryColumns_.forEach(addCol);
        this.otherColumns_.forEach(addCol);

        return cols;
    }
    /**
     * gets the cell meta including the column, table and row values
     */
    getFullCellMeta(keys: any[], col:ColumnKey<any>):StructType {
        let row = this.getRow(keys);
        if (row) {
            return {
                ...this.getMeta(),
                ...row.getRowMeta(),
                ...this.getColumnMeta(col),
                ...row.getCellMeta(col)
            };

        }
        return this.getMeta();
    }
    placedColumns(): ({ key: ColumnKey<any>; meta: StructType; })[] {
        return MutableTable.placedColumns(this, this.primaryColumns_, this.otherColumns_);
    }

    /**
     * very efficient way of setting the meta on a table
     * it doesn't change this table but returns a new table
     * with new meta
     */
    addMeta(meta: StructType): Table {
        let mutable = new MutableTable(this.primaryColumns_, this.otherColumns_);
        mutable.addMeta(meta);
        let res = new Table(mutable);
        res.columnMeta_ = this.columnMeta_;
        res.rows_ = this.rows_;
        res.ordered_ = this.ordered_;
        return res;
    }

    getColumnMeta(column: ColumnKey<any>): StructType {
        return this.columnMeta_.get(column) || {};
    }

    /**
     * get cell value with its associated meta information
     *
     * @return an object containing the metadata and a value
     */
    getCell<Type>(keys: any[], columnKey: ColumnKey<Type>): TableCell<Type> | null {
        let rowInfo = this.getRow(keys);

        if (rowInfo) {
            return rowInfo.getCell(columnKey);
        }
        return null;
    }

    /**
     * @param {?} b
     * @return {number}
     */
    compare(b: any): number {
        if (b instanceof Table) {
            let res: number = this.size() - b.size();
            if (res !== 0) {
                return res;
            }
            res = compareAll([
                {x: this.getMeta(), y: b.getMeta()},
                {x: this.primaryColumns_, y: b.primaryColumns_},
                {x: this.otherColumns_, y: b.otherColumns_},
                {x: this.ordered_, y: b.ordered_}]
            ) as number;
            if (res !== 0) {
                return res;
            }
            //ok we don't compare lengths since we already compared the primary and other columns
            //however it might be good if we ignore order of other columns
            let cols = this.getColumns();
            for (let i = 0; i < cols.length; i++) {
                let col = cols[i];
                res = compare(this.getColumnMeta(col), b.getColumnMeta(col));
                if (res !== 0) {
                    return res;
                }
            }

            return 0;
        }
        return -1;
    }

    getColumns(): ColumnKey<any>[] {
        return [...this.primaryColumns_, ...this.otherColumns_];
    }

    /**
     * @param {?} a
     * @return {boolean}
     */
    equals(a: any): boolean {
        return this.compare(a) === 0;
    }

    getPrimaryColumns(): ColumnKey<any>[] {
        return this.primaryColumns_;
    }

    getOtherColumns() {
        return this.otherColumns_;
    }

    getRowKeys(row: TableRow|MutableTableRow):any[] {
        let keys = [];

        for (let i = 0; i < this.primaryColumns_.length; i++) {
            keys.push(row.get(this.primaryColumns_[i]));
        }
        return keys;
    }

    [Symbol.iterator](): Iterator<{ row: TableRow, key: any[], meta: StructType }> {
        return [...this.ordered_].map((r: TableRow) => ({
            row: r,
            key: this.getRowKeys(r),
            meta: r.getMeta()
        }))[Symbol.iterator]();
    }

    /**
     * @return a more readable version of the table
     */
    toDebugObj(): StructType {
        let tableOut = [];
        for (let {row} of this) {
            tableOut.push(row.toDebugObj());
        }
        return {meta: this.meta_, colMeta: this.columnMeta_, tbl: tableOut};
    }

    /**
     * convert to a mutable table
     */
    unfreeze(): MutableTable {
        let res = new MutableTable(this.primaryColumns_, this.otherColumns_);
        res.addMeta(this.meta_);
        for (let [key, value] of this.columnMeta_) {
            res.addColumnMeta(key, value);

        }
        for (let row of this.rows_) {
            res.addRow(row);
        }
        return res;
    }

    /**
     * gets the number of rows in the table
     */
    size(): number {
        return this.rows_.getCount();
    }

    /**
     * creates an empty mutable table with the same columns
     */
    createEmptyKeep(cols: ColumnKey<any>[]): MutableTable {
        let remove = [];
        let seen = new Set(cols);

        for (let c of this.otherColumns_) {
            if (!seen.has(c)) {
                remove.push(c);
            }
        }
        return this.createEmpty([], [], remove);
    }

    /**
     * gets the row from a table, pass the primary keys as an array of values
     */
    findRow(compare: (row: TableRow) => boolean): TableRow | null {
        for (let row of this.ordered_) {
            if (compare(row)) {
                return row;
            }
        }
        return null;
    }

    /**
     * creates an empty mutable table with the same columns
     * @param opt_extPrimaryCols any primary columns to add to the table
     * @param opt_extOtherCols any non-primary columns to add to the table
     * @param opt_removeCols any columns to remove from the table
     * @return the new table
     */
    createEmpty(opt_extPrimaryCols?: ColumnKey<any>[], opt_extOtherCols?: ColumnKey<any>[], opt_removeCols?: ColumnKey<any>[]): MutableTable {
        let newPrimary = this.primaryColumns_.concat(opt_extPrimaryCols || []);
        let seen = new Set(this.otherColumns_);
        let newOther = [...this.otherColumns_];
        // don't add already existing columns
        if (opt_extOtherCols) {
            for (let c of opt_extOtherCols) {
                if (!seen.has(c)) {
                    newOther.push(c);
                }
            }
        }
        let removeMap = new Set<ColumnKey<any>>(opt_removeCols || []);

        let doRemove = (arr: ColumnKey<any>[]) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (removeMap.has(arr[i])) {
                    arr.splice(i, 1);
                }
            }
        };
        if (opt_removeCols) {
            doRemove(newPrimary);
            doRemove(newOther);
        }
        let res = new MutableTable(newPrimary, newOther);
        res.setMeta(this.meta_);
        for (let [key, meta] of this.columnMeta_) {
            if (!removeMap.has(key)) {
                res.setColumnMeta(key, meta);
            }
        }
        return res;
    }

    /**
     * gets the row from a table, pass the primary keys as an array of values
     */
    getRow(keys: any[]): TableRow | null {
        return this.rows_.findFirst(ColumnKey.normalizeColumns(this.primaryColumns_, keys));
    }

    getFirstRow(): TableRow | null {
        for (let {row} of this) {
            return row;
        }
        return null;
    }

    getRowMeta(keys: any[]): StructType {
        let row = this.getRow(keys);

        if (row === null) {
            return {};
        }

        return row.getMeta();
    }

    /**
     * creates an empty mutable table based on a table, that will a have all original columns
     * but the primary keys will be the ones specified
     * @param primaryCols the new primary keys these can be new or existing and will replace old primary columns
     * @param extOtherCols any extra columns that need to be added that are
     *                                                                    not primary keys
     */
    createEmptyAddCols(primaryCols: ColumnKey<any>[], extOtherCols: ColumnKey<any>[]): MutableTable {
        let pColsSet = new Set(primaryCols);
        let otherColumns = new Set<ColumnKey<any>>;
        for (let col of this.primaryColumns_) {
            if (!pColsSet.has(col)) {
                otherColumns.add(col);
            }
        }
        for (let col of this.otherColumns_) {
            if (!pColsSet.has(col)) {
                otherColumns.add(col);
            }
        }
        for (let col of extOtherCols) {
            if (!otherColumns.has(col)) {
                otherColumns.add(col);
            }
        }

        let res = new MutableTable(primaryCols, [...otherColumns]);
        res.setMeta(this.meta_);
        for (let [key, meta] of this.columnMeta_) {
            res.setColumnMeta(key, meta);
        }
        return res;
    }

    /**
     * given that this table has primary key that is a number
     * it will generate a mutable table row with a primary key not already in the table
     * also if all the existing rows have a position then the position of the new row will
     * be the last row
     */
    static createUniqueIntPkRow(table: MutableTable | Table): MutableTableRow {
        let primaryCols = table.getPrimaryColumns();
        if (primaryCols.length !== 1) {
            throw 'to generate pk you must have exactly 1 primary key';
        }
        let res = new MutableTableRow();
        let pos: number | undefined = 0;
        let usedPks = new AvlTree<number>();

        for (let {row, key} of table) {
            if (pos !== undefined) {
                let rowPos = row.pos();
                if (rowPos === undefined) {
                    pos = undefined;
                } else if (pos < rowPos) {
                    pos = rowPos + 1;
                }
            }
            if (typeof (key[0]) !== 'number') {
                throw 'cannot generate primary key on non number field';
            }
            usedPks.add(key[0]);
        }
        let curPk = 0;
        usedPks.inOrderTraverse(function (val) {
            if (curPk < val) {
                return true;
            }
            if (curPk === val) {
                curPk++;
            }
            return false;
        });
        res.set(primaryCols[0], curPk);
        res.setPos(pos);
        return res;
    }

    /**
     * creates a table from array of objects
     *
     * @param tableMeta
     * @param rawTable
     * @param columnMeta map of metadata for columns
     * @param opt_ordered if true then it will enforce the order it rawTable came in
     */
    static create(tableMeta: StructType, columnMeta: TableMetaType, rawTable: StructType[], opt_ordered?: boolean): Table {

        let keys = Table.extractKeys_(columnMeta);
        let tbl = new MutableTable(keys.primaryKeys, keys.otherKeys);

        tbl.setMeta(tableMeta);

        for (let tMeta in columnMeta) {
            let colKey = columnMeta[tMeta].key;
            tbl.setColumnMeta(colKey, columnMeta[tMeta]);
        }

        let i = 0;
        for (let item of rawTable) {
            let row = new MutableTableRow(opt_ordered === true ? i : undefined);

            for (let tMeta in columnMeta) {
                let colKey = columnMeta[tMeta].key;
                row.set(colKey, item[tMeta]);
            }
            tbl.addRow(row);
            i++;

        }
        return tbl.freeze();
    }

    static comparator(a: KeyedMeta, b: KeyedMeta) {
        return ColumnKey.comparator(a.key, b.key);
    }

    private static extractKeys_(tableMeta: TableMetaType): StructType {
        let primaryKeys: { primary: number, key: ColumnKey<any> }[] = [];
        let otherKeys = [];

        for (let obj in tableMeta) {
            if (tableMeta.hasOwnProperty(obj)) {
                let val = tableMeta[obj];
                if (val.hasOwnProperty('primary')) {
                    primaryKeys.push(val as any);
                } else {
                    otherKeys.push(val.key);
                }
            }
        }
        let comp = (a: { primary: number }, b: { primary: number }) => {
            return a.primary - b.primary;
        };

        primaryKeys.sort(comp);


        return {
            primaryKeys: Table.getColumnKeys_(primaryKeys),
            otherKeys: otherKeys
        };
    }

    private static getColumnKeys_(array: KeyedMeta[]): ColumnKey<any>[] {
        return array.map(v => v.key);
    }

    modifiableRows(): Iterable<{ row: MutableTableRow, meta: StructType, key: any[] }> {
        return [...this.ordered_].map((r: TableRow) => ({
            row: r.unfreeze(),
            key: this.getRowKeys(r),
            meta: r.getMeta()
        }));
    }

    get<Type>(keys: any[], column: ColumnKey<Type>): Type | null {
        let row = this.getRow(keys);
        if (row === null) {
            return null;
        }
        return row.get(column);
    }
}

export class MutableTable implements TableInterface {
    private meta_: StructType;
    private columnMeta_: Map<ColumnKey<any>, StructType>;
    private readonly primaryColumns_: ColumnKey<any>[];
    private readonly otherColumns_: ColumnKey<any>[];
    private readonly rows_: AvlTree<any>;
    private readonly ordered_: AvlTree<any>;

    constructor(primaryKeys: ColumnKey<any>[], otherColumns: ColumnKey<any>[]) {
        this.meta_ = {}; // table metadata
        this.columnMeta_ = new Map(); // column metadata

        if (primaryKeys.length === 0) {
            this.primaryColumns_ = [ColumnKey.INDEX];
        } else {
            this.primaryColumns_ = [...primaryKeys];
        }
        this.otherColumns_ = [...otherColumns];


        let comparator = (rowA: TableRow, rowB: TableRow): number => {
            for (let key = 0; key < this.primaryColumns_.length; key++) {
                let col = this.primaryColumns_[key];
                let res = col.valCompare(rowA.get(col), rowB.get(col));
                if (res !== 0) {
                    return res;
                }
            }
            return 0;
        };

        this.rows_ = new AvlTree<TableRow>(comparator);
        this.ordered_ = new AvlTree(TableRow.positionComparator_(comparator));

    }

    /**
     * @internal
     */
    doNotUseColumnMeta() {
        return this.columnMeta_;
    }

    getRowComparator(): (x: any, y: any) => number {
        return this.rows_.comparator();
    }


    getPrimaryColumns(): ColumnKey<any>[] {
        return this.primaryColumns_;
    }

    getOtherColumns(): ColumnKey<any>[] {
        return this.otherColumns_;
    }


    static placedColumns(table: Table | MutableTable, primaryColumns: ColumnKey<any>[], otherColumns: ColumnKey<any>[]): ({
        key: ColumnKey<any>,
        meta: StructType
    })[] {
        let cols: ({ key: ColumnKey<any>, meta: StructType })[] = [];
        let addCol = (key: ColumnKey<any>) => {
            let col = table.getColumnMeta(key);
            if (col && col.position !== undefined) {
                cols.push({meta: col, key: key});
            }
        };
        primaryColumns.forEach(addCol);
        otherColumns.forEach(addCol);
        cols.sort((x, y) => {
            return x.meta.position - y.meta.position;
        });

        return cols;
    }

    /**
     * this ensures the sort order, the parameters to the function are column key and column metadata
     */
    placedColumns(): ({ key: ColumnKey<any>, meta: StructType })[] {
        return MutableTable.placedColumns(this, this.primaryColumns_, this.otherColumns_);
    }

    static columns(table: TableInterface, primaryColumns: ColumnKey<any>[], otherColumns: ColumnKey<any>[]): ({
        key: ColumnKey<any>,
        meta: StructType
    })[] {
        let cols: ({ key: ColumnKey<any>, meta: StructType })[] = [];
        let addCol = (key: ColumnKey<any>) => {
            let meta = table.getColumnMeta(key);
            cols.push({meta: key === ColumnKey.ROW_META ? meta : (meta || {}), key: key});
        };
        primaryColumns.forEach(addCol);
        otherColumns.forEach(addCol);

        return cols
    }

    columns(): ({ key: ColumnKey<any>, meta: StructType })[] {
        return MutableTable.columns(this, this.primaryColumns_, this.otherColumns_)
    }

    /**
     * set metadata to already existing metadata, this will replace all existing metadata
     */

    setMeta(meta: StructType) {
        this.meta_ = {...meta};
    }

    /**
     * add metadata to already existing metadata, this may override existing meta
     * data
     */

    addMeta(meta: StructType) {
        this.meta_ = {...this.meta_, ...meta};
    }


    /**
     * get table metadata
     */
    getMeta(): StructType {
        return this.meta_;
    }


    /**
     * get column metadata
     */

    getColumnMeta(key: ColumnKey<any>): StructType {
        return this.columnMeta_.get(key) || {};
    }


    /**
     * set new column metadata replacing already existing metadata there
     * if it is not overridden by the new metadata
     */
    setColumnMeta(key: ColumnKey<any>, meta: StructType) {
        this.columnMeta_.set(key, {...meta});
    }

    /**
     * add new column metadata leaving already existing metadata there
     * if it is not overridden by the new metadata
     */
    addColumnMeta(key: ColumnKey<any>, meta: StructType) {
        this.columnMeta_.set(key, {...this.getColumnMeta(key), ...meta});

    }


    /**
     * get row metadata
     */

    getRowMeta(keys: any[]): StructType {
        let row = this.getRow(keys);

        if (row === null) {
            return {};
        }

        return row.getMeta();
    }


    /**
     * set new column metadata replacing already existing metadata there
     * if it is not overridden by the new metadata
     */

    setRowMeta(keys: any[], meta: StructType) {
        this.setCell(
            keys,
            ColumnKey.ROW_META,
            new TableCell(undefined, meta));
    }

    /**
     * add new column metadata leaving already existing metadata there
     * if it is not overridden by the new metadata
     */
    addRowMeta(keys: any[], meta: StructType) {
        this.setRowMeta(keys, {...this.getRowMeta(keys), ...meta});
    }


    /**
     * this uses the primary key of the row to insert the table
     *
     */
    addRow(rowIn: MutableTableRow | TableRow | TableRowInterface) {
        let missingKeys = [];
        let row = (rowIn instanceof MutableTableRow ? rowIn.freeze() : rowIn) as TableRow;

        for (let col of this.primaryColumns_) {
            if (!row.hasColumn(col)) {
                if (col.hasDefault()) {
                    row = row.set(col, col.getDefault());
                } else {
                    missingKeys.push(col);
                }
            }
        }
        for (let col of this.otherColumns_) {
            if (!row.hasColumn(col)) {
                if (col.hasDefault()) {
                    row = row.set(col, col.getDefault());
                } else {
                    throw new Error('missing column: ' + col.getName());
                }
            }
        }

        if (missingKeys.length === 1
            && this.primaryColumns_.length === 1
            && this.primaryColumns_[0] === ColumnKey.INDEX) {
            let nextId;
            if (this.rows_.getCount() === 0) {
                nextId = 0n;
            } else {
                nextId = this.rows_.getMaximum().get(ColumnKey.INDEX) + 1n;
            }
            row = row.set(ColumnKey.INDEX, nextId);
        } else if (missingKeys.length > 0) {
            throw 'Must specify All primary keys';
        }

        let tblRow = row.keepColumns([...this.primaryColumns_, ...this.otherColumns_]);
        if (this.rows_.findFirst(tblRow) !== null) {
            throw new Error('row already exists ');
        }
        this.rows_.add(tblRow);
        this.ordered_.add(tblRow);
    }

    /**
     * @return the key as a row so it can be used to look up the value in the map

     */
    private makeKeys_(keys: any[]): TableRow {
        if (keys.length !== this.primaryColumns_.length) {
            throw 'Incorrect number of primary keys';
        }
        let row = new MutableTableRow();
        for (let i = 0; i < keys.length; i++) {
            row.set(this.primaryColumns_[i], keys[i]);
        }

        return row.freeze();
    }

    /**
     * returns an array of keys for the row
     */
    getRowKeys(row: TableRow | MutableTableRow) {
        let keys = [];

        for (let i = 0; i < this.primaryColumns_.length; i++) {
            keys.push(row.get(this.primaryColumns_[i]));
        }
        return keys;
    }

    [Symbol.iterator](): Iterator<{ row: TableRow, meta: StructType, key: any[] }> {
        return [...this.ordered_].map((r: TableRow) => ({
            row: r,
            key: this.getRowKeys(r),
            meta: r.getMeta()
        }))[Symbol.iterator]();
    }


    modifiableRows(): Iterable<{ row: MutableTableRow, meta: StructType, key: any[] }> {
        return [...this.ordered_].map((r: TableRow) => ({
            row: r.unfreeze(),
            key: this.getRowKeys(r),
            meta: r.getMeta()
        }));
    }

    /**
     * this uses the primary key of the row to insert the table
     */
    removeRow(keys: any[]) {
        let oldRow = this.rows_.remove(this.makeKeys_(keys));
        if (oldRow === null) {
            throw 'Row does not exist';
        } else {
            this.ordered_.remove(oldRow);
        }
    }

    /**
     * gets the row from a table, pass the primary keys as an array of values
     */
    getRow(keys: any[]): TableRow | null {
        let keyRow = ColumnKey.normalizeColumns(this.primaryColumns_, keys);
        return this.rows_.findFirst(keyRow);
    }


    /**
     * Sets the value for the cell
     */
    set<Type>(keys: any[], column: ColumnKey<Type>, value: Type, opt_meta?: StructType) {
        let old = this.getCell(keys, column);

        if (old === null) {
            throw 'Cell Does not exist';
        }
        if (opt_meta) {
            this.setCell(keys, column, new TableCell(value, opt_meta));
        } else {
            this.setCell(keys, column, old.setValue(value));
        }
    };

    /**
     * Sets the value and metadata for the cell
     */
    setCell<Type>(keys: any[], column: ColumnKey<Type>, value: TableCell<Type>) {

        let row = this.getRow(keys);

        if (row === null) {
            throw 'row not found';
        }

        this.removeRow(keys);
        this.addRow(row.setCell(column, value));
    }

    /**
     * sets only the cell metadata, leave the value unchanged
     */
    setCellMeta(keys: any[], column: ColumnKey<any>, meta: StructType) {
        let cell = this.getCell(keys, column);
        if (cell !== null) {
            this.setCell(keys, column, cell.setMeta(meta));
        } else {
            console.log('setting null');
        }
    }

    /**
     * adds metadata to the cell
     */
    addCellMeta(keys: any[], column: ColumnKey<any>, meta: StructType) {
        let cell = this.getCell(keys, column);
        if (cell) {
            let newMeta = {...cell.getMeta(), ...meta};
            this.setCell(keys, column, cell.setMeta(newMeta));
        }
    }

    /**
     * Sets the value and metadata for the cell
     */

    setRow(keys: any[], row: TableRow | MutableTableRow) {
        let oldRow = this.getRow(keys);

        if (oldRow === null) {
            throw 'row not found';
        }

        this.removeRow(keys);
        this.addRow(row);
    }

    getCell<Type>(keys: any[], column: ColumnKey<Type>): TableCell<Type> | null {
        let row = this.getRow(keys);
        if (row === null) {
            return null;
        }
        return row.getCell(column);
    }


    /**
     * convert into immutable table
     */

    freeze(): Table {
        return new Table(this);
    }

    /**
     * gets the value of a cell in the table, without the meta information
     * @param keys primary key of the row
     * @param  columnKey
     */
    get<Type>(keys: any[], columnKey: ColumnKey<Type>): Type | null {
        let r = this.getRow(keys);
        if (r == null) {
            return null;
        }
        return r.get(columnKey);
    }

    get$<Type>(keys: any[], columnKey: ColumnKey<Type>): Type {
        let r = this.getRow(keys);
        if (r == null) {
            throw new Error('row not found');
        }
        return r.get$(columnKey);
    }


    getKeyColumns() {
        return this.primaryColumns_;
    };

    getColumns() {
        return [...this.primaryColumns_, ...this.otherColumns_];
    }

    /**
     * @return a more readable version
     */
    toDebugObj(): any {
        let tableOut: TableRow[] = [];
        for (let {row} of this) {
            tableOut.push(row.toDebugObj());
        }
        return {meta: this.meta_, colMeta: this.columnMeta_, tbl: tableOut};
    }

    /**
     * gets the number of rows in the table
     */
    size(): number {
        return this.rows_.getCount();
    };

    /**
     * gets the row from a table, pass the primary keys as an array of values
     */
    findRow(compare: (row: TableRow) => boolean): TableRow | null {
        for (let row of this.ordered_) {
            if (compare(row)) {
                return row;
            }
        }
        return null;
    }

    /**
     * gets the cell meta including the column, table and row values
     */
    getFullCellMeta(keys: any[], col: ColumnKey<any>): StructType {
        let row = this.getRow(keys);
        if (row) {
            return {
                ...this.getMeta(),
                ...row.getRowMeta(),
                ...this.getColumnMeta(col),
                ...row.getCellMeta(col)
            };

        }
        return this.getMeta();
    }

    getFirstRow(): TableRow | null {
        for (let row of this) {
            return row.row;
        }
        return null;
    }
}

export class TableRow implements TableRowInterface {

    private readonly cells_: Map<ColumnKey<any>, TableCell<any>>;
    private pos_: number | undefined;

    constructor(opt_tableRow: MutableTableRow) {
        this.cells_ = new Map();
        this.cells_.set(ColumnKey.ROW_META, new TableCell(undefined, {}));
        this.pos_ = undefined;
        if (opt_tableRow !== undefined) {
            for (const [key, value] of opt_tableRow.doNotUseOrig_()) {
                this.cells_.set(key, value);
            }

            for (const [key, value] of opt_tableRow.doNotUseChanged_()) {
                this.cells_.set(key, value);
            }
            this.pos_ = opt_tableRow.pos();
        }
    }

    toDebugObj():any {
        let res:{[key:string]: any} =    {};
        for (let [k, v] of this.cells_) {
            res[k.getId()] = v.toDebugObj();
        }
        return res;
    }
    /**
     * this is private but because there are no friends in typescript its here
     */
    doNotUseCells_(): Map<ColumnKey<any>, TableCell<any>> {
        return this.cells_;
    }

    columns(): Iterable<{ meta: StructType, key: ColumnKey<any> }> {
        let res: { meta: StructType, key: ColumnKey<any> }[] = [];
        for (let [key, value] of this.cells_) {
            res.push({key, meta: value.getMeta()});
        }
        return res;
    }

    static positionComparator_(comparator: (x: any, y: any) => number) {
        return function (x: any, y: any): number {
            if (x.pos() === undefined && y.pos() === undefined) {
                return comparator(x, y);
            }
            if (x.pos() === undefined || y.pos() === undefined) {
                return x.pos() === undefined ? -1 : 1;
            }

            let res = x.pos() - y.pos();
            if (res === 0) {
                return comparator(x, y);
            }
            return res;
        };
    }

    /**
     * checks to see if the values are equal ignoring metadata
     */
    valuesEqual(that: TableRow): boolean {
        if (!(that instanceof TableRow)) {
            return false;
        }
        for (let {col, cell} of this.columnValues()) {
            if (!that.cells_.has(col) || !that.cells_.get(col)) {
                return false;
            }
            if (!isEqual(cell.getValue(), that.cells_.get(col)?.getValue())) {
                return false;
            }
        }

        for (let {col} of that.columnValues()) {
            if (!this.cells_.has(col)) {
                return false;
            }
        }
        return true;
    }

    pos(): number | undefined {
        return this.pos_;
    }

    /**
     * Get the value and metadata from the cell
     */
    getCell<Type>(column: ColumnKey<Type>): TableCell<Type> | null {
        let res = this.cells_.get(column);
        return res === undefined ? null : res;
    }

    /**
     * Get the value and metadata from the cell
     */
    getCellMeta(column: ColumnKey<any>): StructType {
        return this.getCell(column)?.getMeta() || {};
    }

    /**
     * Get the value and metadata from the cell
     */
    getMeta(): StructType {
        return this.cells_.get(ColumnKey.ROW_META)?.getMeta() || {};
    }

    columnValues(): ({ col: ColumnKey<any>, cell: any })[] {
        let res: { col: ColumnKey<any>, cell: TableCell<any> }[] = [];

        let metaCol = ColumnKey.ROW_META;
        for (const [col, value] of this.cells_) {
            if (metaCol !== col) {
                res.push({col, cell: value})
            }
        }
        return res;
    }

    /**
     * Gets only the value from the cell
     */

    get<Type>(column: ColumnKey<Type>): Type | null {
        const val = this.cells_.get(column);
        return val === undefined ? null : val.getValue();
    }

    /**
     * Gets only the value from the cell
     */

    get$<Type>(column: ColumnKey<Type>): Type {
        const val = this.cells_.get(column);
        if (val === undefined)  {
            throw new Error(`column ${column.getId()} does not exist in row`);
        }
        return val.getValue();
    }

    /**
     * sets the cell and returns a new row, this row is unmodified
     */

    set<Type>(column: ColumnKey<Type>, value: Type): TableRow {
        let mutable = new MutableTableRow(this.pos(), this);
        mutable.set(column, value);
        return mutable.freeze();
    }


    /**
     * sets the cell and returns a new row, this row is unmodified
     */

    setCell<Type>(column: ColumnKey<Type>, value: TableCell<Type>): TableRow {
        let mutable = new MutableTableRow(this.pos(), this);
        mutable.setCell(column, value);
        return mutable.freeze();
    };

    static create<T1>(p1: ColKeyValue<T1>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static create<T1, T2>(p1: ColKeyValue<T1>, p2: ColKeyValue<T2>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static create<T1, T2, T3>(p1: ColKeyValue<T1>, p2: ColKeyValue<T2>, p3: ColKeyValue<T3>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static create<T1, T2, T3, T4>(p1: ColKeyValue<T1>, p2: ColKeyValue<T2>, p3: ColKeyValue<T4>, p4: ColKeyValue<T4>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static create(...args: (ColKeyValue<any>)[]): MutableTableRow {
        let mutableRow = new MutableTableRow();
        for (let arg of args) {
            mutableRow.set(arg[0], arg[1]);
        }

        return mutableRow;
    };


    static createOrdered<T1>(pos: number, p1: ColKeyValue<T1>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static createOrdered<T1, T2>(pos: number, p1: ColKeyValue<T1>, p2: ColKeyValue<T2>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static createOrdered<T1, T2, T3>(pos: number, p1: ColKeyValue<T1>, p2: ColKeyValue<T2>, p3: ColKeyValue<T3>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static createOrdered<T1, T2, T3, T4>(pos: number, p1: ColKeyValue<T1>, p2: ColKeyValue<T2>, p3: ColKeyValue<T4>, p4: ColKeyValue<T4>, ...args: (ColKeyValue<any>)[]): MutableTableRow;
    static createOrdered(pos: number, ...args: (ColKeyValue<any>)[]): MutableTableRow {
        let mutableRow = new MutableTableRow(pos);
        for (let arg of args) {
            mutableRow.set(arg[0], arg[1]);
        }

        return mutableRow;
    }

    getRowMeta(): StructType {
        let cell = this.getCell(ColumnKey.ROW_META);
        return cell ? cell.getMeta() : {};
    };

    /**
     * removes all columns not in the columns parameter
     */

    keepColumns(columns: ColumnKey<any>[]) {
        let mutable = new MutableTableRow(this.pos_);
        columns.forEach((col) => {
            if (this.hasColumn(col)) {
                let val = this.getCell(col);
                if (val !== null) {
                    mutable.setCell(col, val);
                }
            }
        });
        if (this.hasColumn(ColumnKey.ROW_META)) {
            mutable.setRowMeta(this.getRowMeta());
        }
        return mutable.freeze();
    };

    hasColumn(column: ColumnKey<any>): boolean {
        return this.cells_.has(column);
    }

    unfreeze(): MutableTableRow {
        return new MutableTableRow(undefined, this);
    }
}

/**
 * A table row that can be changed. Use this to make a row then
 * change it to a normal row
 */

export class MutableTableRow implements TableRowInterface {
    private orig_: Map<ColumnKey<any>, TableCell<any>>;
    private changed_: Map<ColumnKey<any>, TableCell<any>>;
    private pos_: number | undefined;

    constructor(opt_position?: number, opt_immutable?: TableRow) {
        if (opt_immutable) {
            this.orig_ = opt_immutable.doNotUseCells_();
            this.pos_ = opt_position === undefined ? opt_immutable.pos() : opt_position;
        } else {
            this.orig_ = new Map();
            this.pos_ = opt_position === undefined ? undefined : opt_position;
        }
        this.changed_ = new Map();
    }

    columns(): Iterable<{ meta: StructType; key: ColumnKey<any>; }> {
        let res: { meta: StructType, key: ColumnKey<any> }[] = [];
        for (let [key, value] of this.changed_) {
            res.push({key, meta: value.getMeta()});
        }
        for (let [key, value] of this.orig_) {
            if (!this.changed_.has(key)) {
                res.push({key, meta: value.getMeta()});
            }
        }
        return res;

    }

    /**
     * this is private but because there are no friends in typescript its here
     * @internal
     */
    doNotUseOrig_(): Map<ColumnKey<any>, TableCell<any>> {
        return this.orig_;
    }

    /**
     * this is private but because there are no friends in typescript its here
     * @internal
     */
    doNotUseChanged_(): Map<ColumnKey<any>, TableCell<any>> {
        return this.changed_;
    }

    /**
     * Get the value and metadata from the cell
     */
    getMeta(): StructType {
        return this.getRowMeta();
    }

    columnValues(): ({ col: ColumnKey<any>, cell: TableCell<any> })[] {
        let metaCol = ColumnKey.ROW_META;
        let res: ({ col: ColumnKey<any>, cell: TableCell<any> })[] = []
        for (const [col, value] of this.changed_) {
            if (metaCol !== col) {
                res.push({col, cell: value});
            }
        }

        for (const [col, value] of this.orig_) {
            if (metaCol !== col && !this.changed_.get(col)) {
                res.push({col, cell: value});
            }
        }
        return res;
    }

    addColumns(row: TableRow|TableRowInterface) {
        for (let {col, cell} of row.columnValues()) {
            this.changed_.set(col, cell);
        }
    }

    equals(that: any): any {
        if (!(that instanceof MutableTableRow)) {
            return false;
        }

        return isEqual(this.freeze(), that.freeze());
    }

    hasColumn(column: ColumnKey<any>): boolean {
        return this.orig_.has(column) || this.changed_.has(column);
    }

    /**
     * checks to see if the values are equal ignoring metadata
     */
    valuesEqual(that: any): boolean {
        if (!(that instanceof MutableTableRow)) {
            return false;
        }

        return this.freeze().valuesEqual(that.freeze());
    }

    pos(): number | undefined {
        return this.pos_;
    }


    /**
     * @param {number|undefined} pos
     */
    setPos(pos: number | undefined) {
        this.pos_ = pos;
    }


    getCell<Type>(column: ColumnKey<Type>): TableCell<Type> | null {
        if (this.changed_.has(column)) {
            return this.changed_.get(column) as TableCell<Type>;
        }
        let res = this.orig_.get(column);
        if (res === undefined) {
            return null;
        }
        return res;
    }


    getCellMeta(column: ColumnKey<any>): StructType {
        let res = this.getCell(column);
        return res ? res.getMeta() : {};
    }

    setRowMeta(meta: StructType) {
        let cell = this.getCell(ColumnKey.ROW_META);
        if (cell == null) {
            cell = new TableCell(undefined, {});
        }
        this.setCell(ColumnKey.ROW_META, cell.setMeta(meta));
    }

    addRowMeta(meta: StructType) {
        this.setRowMeta({...this.getRowMeta(), ...meta});
    }

    getRowMeta(): StructType {
        let cell = this.getCell(ColumnKey.ROW_META);
        return cell ? cell.getMeta() : {};
    }

    /**
     * converts a mutable table row to immutable table row
     */

    freeze() {
        return new TableRow(this);
    }

    get<Type>(column: ColumnKey<Type>): Type | null {
        let res = this.getCell(column);
        return res === null ? null : res.getValue();
    }

    /**
     * @param columnKey
     * @param val the data and metadata of the cell
     */

    setCell<Type>(columnKey: ColumnKey<Type>, val: TableCell<Type>) {
        this.changed_.set(columnKey, val);
    }

    /**
     * a helper that just transfers the columns from the source rows
     * into this row, note this does not transfer the metadata
     */
    transfer(columnKeys: ColumnKey<any>[], src: TableRowInterface) {
        for (let i = 0; i < columnKeys.length; i++) {
            let col = columnKeys[i];
            this.set(col, src.get(col));
        }
    }

    set<Type>(columnKey: ColumnKey<Type>, val: Type, opt_meta?: StructType) {
        let old = this.getCell(columnKey);
        if (old === null) {
            old = new TableCell<Type>(columnKey.castTo(val));
        }
        if (opt_meta) {
            this.setCell(columnKey, new TableCell(
                columnKey.castTo(val), opt_meta));
        } else {
            this.setCell(columnKey, old.setValue(columnKey.castTo(val)));
        }
    }

    /**
     * @template CT
     * @param {!ColumnKey<CT>} columnKey
     * @param {!Object} val the data of the cell
     */

    setCellMeta(columnKey: ColumnKey<any>, val: StructType) {
        let old = this.getCell(columnKey);
        if (old === null) {
            old = new TableCell(undefined);
        }

        this.setCell(columnKey, old.setMeta(val));
    }

    /**
     * @template CT
     * @param {!ColumnKey<CT>} columnKey
     * @param {!Object} val the data of the cell
     */

    addCellMeta(columnKey: ColumnKey<any>, val: StructType): this {
        let old = this.getCell(columnKey);
        if (old === null) {
            old = new TableCell(undefined);
        }

        this.setCell(columnKey, old.addMeta(val));
        return this

    }
}

/**
 *
 * @template T
 * @param {T} value
 * @param {Object=} opt_meta
 * @constructor
 */

export class TableCell<Type> {

    private readonly meta_: StructType | undefined;
    private readonly value_: Type;

    constructor(value: Type, opt_meta?: StructType) {
        this.value_ = value;
        this.meta_ = opt_meta;
    }

    getMeta(): StructType {
        return !this.meta_ ? {} : {...this.meta_};
    }

    getValue(): Type {
        return this.value_;
    }

    toDebugObj(): {meta?: StructType, val:Type} {
        if (this.meta_ && Object.keys(this.meta_).length > 0) {
            return {meta: this.meta_, val: this.value_};
        }
        return {val: this.value_};
    }
    /**
     * returns a new cell with the metadata set
     */
    setMeta(meta: StructType) {
        return new TableCell(this.value_, meta);
    }

    /**
     * returns a new cell with the metadata set
     */
    addMeta(meta: StructType): TableCell<Type> {
        return new TableCell(this.value_, {...this.getMeta(), ...meta});
    }

    /**
     * returns a new cell with the data set, keeps the metadata
     */

    setValue(value: Type): TableCell<Type> {
        return new TableCell(value, this.meta_);
    }
}
