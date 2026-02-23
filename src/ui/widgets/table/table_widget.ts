import {WidgetScope} from "../widgetscope.ts";
import {BehaviourOrType, StructType} from "../../../frp/struct.ts";
import {Table, TableCell, TableMetaType} from "../../../structs/table/table.ts";
import {AvlTree} from "../../../structs/avltree.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {Column, LabelType} from "./column.ts";
import { Widget } from "../widget.ts";
import {
    createDom, createTextNode,
    getChildren,
    insertChildAt,
    insertSiblingAfter, insertSiblingBefore,
    removeChildren,
    removeNode
} from "../../dom/dom.ts";
import {TagName} from "../../dom/tags.ts";
import {AttachableWidget} from "../../frp/util.ts";
import { WidgetHelper } from "../../widgethelper.ts";
import {Behaviour} from "../../../frp/frp.ts";
import { Label } from "../label.ts";
import {BoolWithExplanation} from "../../booleanwithexplain.ts";
import {getByParts, isEqual} from "../../../util/object.ts";
import {toTitleCase} from "../../../util/string.ts";
import {RenderedDecorator, WidgetFactory} from "../../decorator.ts";
import {EventHelper} from "../../eventhelper.ts";
import {TableMetaData} from "./meta_data.ts";
import {add, remove} from "../../dom/classlist.ts";
import {EventType} from "../../dom/eventtype.ts";
import {TableCellHelper} from "../../../frp/table.ts";

export type TypeFactoryMap = {
    [index:string]: (meta:StructType) => Column<any>,
}

type RowKey = any[];

type RowAndCellMeta_ = {
    key:any[],
    rowPos:number,
    meta:StructType,
    keyCols: ColumnKey<any>[],
    cellMeta:Map<ColumnKey<any>,StructType>
    outer:Element|null;
};

type RowAndCellMetaKey_ = {
    key: any[],
    keyCols: ColumnKey<any>[],
};

type RowAndCellMetaMap_ = AvlTree<RowAndCellMeta_, RowAndCellMetaKey_>;
type ColumnInfo_ = {key:ColumnKey<any>};

type TableInfo_ = {
    rowMeta:RowAndCellMetaMap_,
    columnMeta:ColumnInfo_[],
    tableMeta:StructType,
    keyColumns:ColumnKey<any>[],
    canSelect?:boolean,
};

type RenderStateRow = {
    key: RowKey[],
    outer: Element|null,
    inner: Element|null,
    cols: RenderedDecorator[];
    rowPos:number;
    decorator: () => RenderedDecorator;
    keyCols: ColumnKey<any>[];
}
type RenderState_ = {
    rows:AvlTree<RenderStateRow, RowAndCellMetaKey_>,
    headerCols:RenderedDecorator[],
    headerRow:RenderedDecorator|false,
    table?:RenderedDecorator,
    errors: Element | null,


};

export class TableWidget extends Widget<HTMLDivElement> implements AttachableWidget {
    private helper_: WidgetHelper;
    private selectionHelper_: WidgetHelper;
    private rowClickHelper_: WidgetHelper;
    private tableB_?: Behaviour<Table>;
    private readonly tableBB_: Behaviour<Behaviour<Table>>;
    private selectNewRow_:boolean = false;
    private readonly selectedB_: Behaviour<RowKey[]>;
    private curSelected_: RowKey[];
    private readonly renderState_: RenderState_;
    private state_: TableInfo_;
    private readonly rowClickEvent_: Behaviour<null, { event: MouseEvent; data: RowKey }>;
    private readonly lastClickedB_: Behaviour<null|RowKey>;
    private renderInfoB_?: Behaviour<TableInfo_>;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV, {class: 'recoil-table'}))

        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.rowClickHelper_ = new WidgetHelper(scope, this.getElement(), this, () => {});
        this.selectionHelper_ = new WidgetHelper(scope, this.getElement(), this,  (
            helper, selectedB:Behaviour<RowKey[]>, selectMetaB:Behaviour<TableInfo_>)=> {
            let i = 0;
            let row;
            let selector:(el:Element, sel:boolean|undefined) => void;
            if (helper.isGood()) {
                let selected = selectedB.get();
                let selectMeta = selectMetaB.get();
                let keyCols = selectMeta.keyColumns;
                let canSelect = selectMeta.canSelect;
                for (let selected of this.curSelected_) {
                    let rowMeta = selectMeta.rowMeta.findFirst({keyCols, key: selected});
                    selector = this.getMetaValue('rowSelector', selectMeta.tableMeta, rowMeta ? rowMeta.meta : undefined);
                    row = this.renderState_.rows.findFirst({keyCols, key: selected});
                    if (row && row.outer) {
                        selector(row.outer, false);
                    }
                }

                for (i = 0; i < selected.length; i++) {
                    selector = this.getMetaValue('rowSelector', selectMeta.tableMeta, selectMeta.rowMeta.findFirst({keyCols, key: selected[i]})|| undefined);
                    row = this.renderState_.rows.findFirst({keyCols, key: selected[i]});
                    if (row && row.outer) {
                        selector(row.outer, canSelect);
                    }
                }
                this.curSelected_ = selected;
            }

        });
        // the state the current table we are displaying (only the important stuff)
        this.state_ = TableWidget.emptyState_([]);
        // information on what we are currently rendering
        this.renderState_ = {
            rows: new AvlTree<RenderStateRow,RowAndCellMetaKey_>(TableWidget.rowMetaCompare_),
            headerCols: [],
            headerRow:false,
            errors: null,
        };

        this.curSelected_ = [];
        this.selectedB_ = this.scope_.getFrp().createB([]);
        this.lastClickedB_ = this.scope_.getFrp().createB(null);
        // this will keep the current table in it, it will allow us to get selected before
        // we have attached a table
        this.tableBB_ = this.scope_.getFrp().createNotReadyB();

        this.rowClickEvent_ = scope.getFrp().createCallback((e: {event:MouseEvent, data: RowKey}, selectedB: Behaviour<RowKey[]>, tableB:Behaviour<Table>, lastB)=> {
            this.selectNewRow_ = false;
            let oldSelected = selectedB.get();
            let mode = tableB.get().getMeta().selectionMode || SelectionMode.SINGLE;
            let clickRow = tableB.get().getRow(e.data);
            if (!clickRow || clickRow.getMeta().selectable === false) {
                return;
            }
            let keyEqual = (x:RowKey) => {
                return isEqual(x, e.data);
            };
            if (mode === SelectionMode.SINGLE) {
                if (!oldSelected.find(keyEqual)) {
                    selectedB.set([e.data]);
                }
                lastB.set(e.data);
            } else if (mode === SelectionMode.MULTI) {
                let rowKey = lastB.get();
                if (e.event.ctrlKey) {

                    let found = oldSelected.find(keyEqual);
                    if (found) {
                        selectedB.set(oldSelected.filter((v) => {
                            return !keyEqual(v);
                        }));
                    } else {
                        selectedB.set(oldSelected.concat([e.data]));
                    }
                    lastB.set(e.data);
                } else if (e.event.shiftKey && rowKey !== null && tableB.get().getRow(rowKey)) {
                    let newSelected = [];
                    let started = false;
                    let finished = false;
                    let tbl = tableB.get();
                    for (let {key: pks} of tbl) {
                        if (finished) {
                            return;
                        }

                        let matches = isEqual(pks, lastB.get()) || isEqual(pks, e.data);
                        if (matches) {
                            newSelected.push(pks);
                            finished = started;
                            started = true;
                        } else if (started) {
                            newSelected.push(pks);
                        }
                    }
                    selectedB.set(newSelected);
                } else {
                    selectedB.set([e.data]);
                    lastB.set(e.data);
                }
            }


        }, this.selectedB_, this.scope_.getFrp().switchB(this.tableBB_), this.lastClickedB_);
        this.rowClickHelper_.attach(this.rowClickEvent_);
    }

    static create(tableMeta: TypeFactoryMap, columnMeta: TableMetaType, rawTable: StructType[], opt_ordered?: boolean): Table {
        return Table.create(tableMeta, columnMeta, rawTable, opt_ordered);
    }


    /**
     * use this when adding for the table widget to select a new row
     * this highlight which row was added to the user
     *
     */
    selectNewRow() {
        this.selectNewRow_ = true;
    }

    /**
     * this should be called after the attach function, this way it can filter out the
     * rows that do not exist in the table.
     *
     * note this is a bidirectional behaviour, so setting it will change the selection
     *
     */
    createSelected():Behaviour<RowKey[]> {
        let frp = this.scope_.getFrp();
        return frp.liftBI(
            (selected:RowKey[], table:Table):RowKey[] => {
                let res : RowKey[] = [];
                let reselector = table.getMeta()['reselector'];
                let reselected = false;
                for (let key of selected) {
                    try {
                        if (table.getRow(key) !== null) {
                            res.push(key);
                        } else if (reselector) {
                            let found = null;
                            for (let {row, key:pks} of table)  {
                                if (reselector(key, row, pks)) {
                                    found = pks;
                                }
                            }

                            if (found) {
                                reselected = true;
                                res.push(found);
                            }
                        }
                    } catch (e) {
                        // maybe the table has changed number of pk since we generated selected
                        // so this may throw ignore
                    }
                }
                if (reselected) {
                    this.selectedB_.set(res);
                }
                return res;
            },
             (selected:RowKey[]) => {
                this.selectedB_.set(selected);
            }, this.selectedB_, frp.switchB(this.tableBB_));
    }

    /**
     * creates an empty state
     */
    private static emptyState_(keyColumns:ColumnKey<any>[]):TableInfo_ {
        return {
            rowMeta: new AvlTree(TableWidget.rowMetaCompare_),
            columnMeta: [],
            tableMeta: {},
            keyColumns,
        };
    }


    /**
     * this gets the most relevant value for this field int the meta, it goes backwards
     * through the meta information until it finds the key that it is looking for
     * if it does not find it there it then will check the scope for that value with the name
     * TableWidget.'value' if it is not there it will then return
     * TableWidget.default'Value'_ (note the first letter is capitalised)
     * @template T
     * @param {string} value the key of value to get
     * @param {...Object} var_meta all the meta information
     * @return {T}
     */
    getMetaValue<Type>(value: string, ...var_meta: (StructType|undefined)[]):Type {
        return TableWidget.getMetaValue<Type>(this.scope_, value, ...var_meta);
    }


    /**
     * this gets the most relevant value for this field int the meta, it goes backwards
     * through the meta information until it finds the key that it is looking for
     * if it does not find it there it then will check the scope for that value with the name
     * TableWidget.'value' if it is not there it will then return
     * {@code TableWidget.default'Value'_} (note the first letter is capitalised)
     *
     * @param scope
     * @param value the key of value to get
     * @param var_meta all the meta information
     */
    static getMetaValue<Type>(scope: WidgetScope, value: string, ...var_meta: (StructType|undefined)[]):Type {
        let val;

        for (let i = var_meta.length - 1; i >= 0; i--) {
            let arg = var_meta[i];
            if (arg === null) {
                console.log('arg is null');
            } else if (arg === undefined) {

            } else {
                val = arg[value];
                if (val !== undefined) {
                    return val;
                }
            }
        }
        val = getByParts(scope, (TableWidget as StructType)[value]);

        if (val !== undefined) {
            return val;
        }
        val = (TableWidget as StructType)['default' + toTitleCase(value)];
        if (val !== undefined) {
            return val;
        }

        return (TableWidget as StructType)['default' + toTitleCase(value) + '_'];
    }


    /**
     * the default decorator for making tables

     */
    static defaultTableDecorator(): RenderedDecorator {
        return new RenderedDecorator(
            TableWidget.defaultTableDecorator,
            createDom(TagName.TABLE));
    }


    /**
     * @private
     * @param {Element} row
     * @param {boolean} selected
     */
    static defaultRowSelector(row:Element, selected:boolean) {
        if (selected) {
            add(row, 'recoil_table_selected');
        } else {
            remove(row, 'recoil_table_selected');
        }
    };


    /**
     * the default decorator for making header rows
     */

    static defaultHeaderRowDecorator(): RenderedDecorator {
        return new RenderedDecorator(
            TableWidget.defaultHeaderRowDecorator,
            createDom(TagName.TR));
    }


    /**
     * the default decorator for making rows
     */

    static defaultRowDecorator(): RenderedDecorator {
        return new RenderedDecorator(
            TableWidget.defaultRowDecorator,
            createDom(TagName.TR));
    }


    /**
     * the default decorator for making cells
     */
    static defaultCellDecorator() : RenderedDecorator{
        return new RenderedDecorator(
            TableWidget.defaultCellDecorator,
            createDom(TagName.TD));

    }

    /**
     * the default decorator for making header cells
     */

    static defaultHeaderDecorator(): RenderedDecorator {
        return new RenderedDecorator(
            TableWidget.defaultHeaderDecorator,
            createDom(TagName.TH));
    }


    /**
     * the default factory form for making header widgets for header cells
     */

    static defaultHeaderWidgetFactory(scope: WidgetScope, cellB: Behaviour<TableCell<any>>) {
        let widget = new Label(scope);
        let metaB = scope.getFrp().liftB((cell: TableCell<any>): {
            value: LabelType,
            enabled?: BoolWithExplanation
        } => {
            let meta = cell.getMeta();
            let res: { value: LabelType, enabled?: BoolWithExplanation } = {
                value: meta.name
            };
            if (meta.enabled) {
                res.enabled = meta.enabled;
            }
            return res;
        }, cellB);
        widget.attachStruct(metaB);
        return widget;
    }

    /**
     * compares the rows based on its position
     */
    private static rowMetaPosCompare_(x: { rowPos:number }, y: { rowPos:number }): number {
        return x.rowPos - y.rowPos;
    }

    /**
     * utility function to compare rows in meta data
     * TODO we don't have the position in here so we will loose the row ordering
     */
    private static rowMetaCompare_(x: RowAndCellMetaKey_, y: RowAndCellMetaKey_): number {
        let res;
        // first check the keyCols are the same if not they are not equal
        if (x.keyCols.length != y.keyCols.length) {
            return x.keyCols.length - y.keyCols.length;
        }
        for (let i = 0; i < x.keyCols.length; i++ ) {
            let res = x.keyCols[i].getId().localeCompare(y.keyCols[i].getId());
            if (res !== 0) {
                return res;
            }
        }
        for (let i = 0; i < x.key.length; i++) {
            res = x.keyCols[i].valCompare(x.key[i], y.key[i]);
            if (res !== 0) {
                return res;
            }
        }

        return 0;
    }

    /**
     * @param {Array<string>} fields array of fields to copy
     * @param {...Array<Object>} var_metas each array should be size 2 and
     *                                     like [src,dest]
     * @return {number} number of fields copied
     */
    static copyMeta(fields: string[], ...var_metas: [StructType, StructType][]): number {
        let copied = 0;
        for (let field of fields) {
            for (let metaPair of var_metas) {
                let src = metaPair[0];
                let dst = metaPair[1];
                if (src[field] !== undefined) {
                    dst[field] = src[field];
                    copied++;
                }
            }
        }
        return copied;
    }

    /**
     * creates a data structure with all the information needed to do selection
     * table but does not contain the actual data, this is useful because
     * it will only fire when we need to update the table, it is the widgets inside
     * the table to update the data itself when it changes
     */
    private createSelectInfo_(tableB: Behaviour<Table>): Behaviour<TableInfo_> {
        let frp = this.scope_.getFrp();
        return frp.liftB((table:Table)=> {
            let primaryColumns = table.getPrimaryColumns();
            let info = TableWidget.emptyState_(primaryColumns);
            let mode = table.getMeta().selectionMode || SelectionMode.SINGLE;
            info.canSelect = mode !== SelectionMode.NONE;
            let tableMeta = table.getMeta();
            TableWidget.copyMeta(['rowSelector'], [tableMeta, info.tableMeta]);
            let rowAndColumnFields = ['cellWidgetFactory', 'cellDecorator'];

            let pos = 0;
            for (let {key: rowKey, meta: tableRowMeta} of table) {
                let rowMeta = {};
                TableWidget.copyMeta(
                    rowAndColumnFields.concat('rowSelector'),
                    [tableRowMeta, rowMeta], [tableMeta, info.tableMeta]);
                let rowAndCellMeta:RowAndCellMeta_ = {
                    key: rowKey,
                    rowPos: pos,
                    keyCols: primaryColumns,
                    meta: rowMeta,
                    outer:null,
                    cellMeta: new Map<ColumnKey<any>, StructType>()
                };
                info.rowMeta.add(rowAndCellMeta);
                pos++;
            }
            return info;
        }, tableB);
    }

    /**
     * creates a data structure with all the information needed to lay out the
     * table but does not contain the actual data, this is useful because
     * it will only fire when we need to update the table, it is the widgets inside
     * the table to update the data itself when it changes
     *
     */
    private createRenderInfo_(tableB: Behaviour<Table>): Behaviour<TableInfo_> {
        let frp = this.scope_.getFrp();
        return frp.liftB((table: Table)=> {
            let info = TableWidget.emptyState_(table.getPrimaryColumns());
            let mode = table.getMeta().selectionMode || SelectionMode.SINGLE;
            info.canSelect = mode !== SelectionMode.NONE;

            let tableMeta = table.getMeta();
            TableWidget.copyMeta(['tableDecorator', 'headerRowDecorator'], [tableMeta, info.tableMeta]);
            let rowAndColumnFields = ['cellWidgetFactory', 'cellDecorator'];
            for (let {key, meta: columnMeta} of table.placedColumns()) {

                let myInfo = {key: key};
                TableWidget.copyMeta(
                        ['headerDecorator', 'headerWidgetFactory'].concat(
                        rowAndColumnFields),
                    [tableMeta, info.tableMeta], [columnMeta, myInfo]);
                info.columnMeta.push(myInfo);
            }

            let curPos = 0;
            for (let {key: rowKey, meta: tableRowMeta} of table) {
                let rowMeta = {};
                TableWidget.copyMeta(
                    rowAndColumnFields.concat(['rowDecorator']),
                    [tableRowMeta, rowMeta], [tableMeta, info.tableMeta]);
                let rowAndCellMeta:RowAndCellMeta_ = {
                    key: rowKey,
                    rowPos: curPos++,
                    keyCols: table.getPrimaryColumns(),
                    meta: rowMeta,
                    outer:null,
                    cellMeta: new Map<ColumnKey<any>, StructType>()
                };

                info.rowMeta.add(rowAndCellMeta);
                for (let {key} of table.placedColumns()) {
                    let cell = table.getCell(rowKey, key)!;
                    let cellMeta = {};
                    let added = TableWidget.copyMeta(
                        rowAndColumnFields, [cell.getMeta(), cellMeta]);
                    if (added > 0) {
                        rowAndCellMeta.cellMeta.set(key, cellMeta);
                    }
                }
            }  // table.forEach
            return info;

        }, tableB);
    }

    /**
     * @param newColumnInfo the relevant metadata for the column
     * @return an object containing the pos the position to delete,
     *       and the meta information for that column
     */
    private getColumnRemoves_(newColumnInfo: ColumnInfo_[]) {
        let delColumns = [];
        let newColMap = new Set<ColumnKey<any>>();
        let curColumnInfo = this.state_.columnMeta;

        let i;
        for (i = 0; i < newColumnInfo.length; i++) {
            newColMap.add(newColumnInfo[i].key);
        }

        // backwards it is important otherwise deleting the columns
        // will change the column number
        for (i = curColumnInfo.length - 1; i >= 0; i--) {
            let info = curColumnInfo[i];
            if (!newColMap.has(info.key)) {
                delColumns.push({pos: i, meta: info});
            }
        }
        return delColumns;

    }


    /**
     * before calling this we must delete all columns not in new, and add all
     * new columns have been added
     *
     * @private
     * @param newColumnInfo the column metadata of the new table
     * @return this is a map the index is to the value is from
     */
    private getColumnMoves_(newColumnInfo: { key: ColumnKey<any> }[]):number[] {
        let curColumnInfo = this.state_.columnMeta;
        let curPositions = new Map<ColumnKey<any>, number>();
        let result = [];

        let i;

        for (i = 0; i < curColumnInfo.length; i++) {
            curPositions.set(curColumnInfo[i].key, i);
        }

        for (i = 0; i < newColumnInfo.length; i++) {
            let meta = newColumnInfo[i];
            let curPos = curPositions.get(meta.key)!;
            result.push(curPos);
        }
        return result;
    }


    /**
     * works out which rows need to be removed
     *
     * we should guarantee that there are columns in cur that are not in new,
     * since whe should delete the old cols before calling this
     */
    private getRowRemoves_(newRows: RowAndCellMetaMap_):RowAndCellMetaMap_ {
        let oldRows = this.state_.rowMeta;

        let result = new AvlTree<RowAndCellMeta_, RowAndCellMetaKey_>(TableWidget.rowMetaCompare_);
        for (let oldRow of oldRows) {
            if (!newRows.findFirst(oldRow)) {
                result.add(oldRow);
            }
        }
        return result;
    }
    
    /**
     * @private
     * @param {Object} tableMeta the relevant metadata associated with the table
     * @param row information about currently rendered row
     * @param rowMeta the relevant metadata associated with row
     * @param {Object} columnMeta
     */
    createCell_(tableMeta: StructType, row: RenderStateRow, rowMeta: RowAndCellMeta_, columnMeta: StructType) {

        let renderInfo = this.createRenderInfoCell_(tableMeta, row.key, rowMeta, columnMeta);
        if (renderInfo.outer && row.inner) {
            row.inner.appendChild(renderInfo.outer);
        }
        row.cols.push(renderInfo);
    }


    /**
     * @param tableMeta the relevant metadata associated with the table
     * @param key information about currently rendered row
     * @param rowMeta the relevant metadata associated with row
     * @param columnMeta
     */
    private createRenderInfoCell_(tableMeta: StructType, key: any[], rowMeta: RowAndCellMeta_, columnMeta: StructType): RenderedDecorator {
        let cellMeta = rowMeta.cellMeta.get(columnMeta.key) || {};
        let cellDecorator = this.getMetaValue<() => RenderedDecorator>(
            'cellDecorator', tableMeta, rowMeta.meta, columnMeta, cellMeta);
        let cellFactory = this.getMetaValue<WidgetFactory>(
            'cellWidgetFactory', tableMeta, rowMeta.meta, columnMeta, cellMeta);
        let renderInfo = cellDecorator ? cellDecorator() : new RenderedDecorator(cellDecorator, null);
        renderInfo.decorator = cellDecorator;
        renderInfo.factory = cellFactory;

        if (renderInfo.inner && renderInfo.factory) {
            let widget = renderInfo.factory(
                this.scope_,
                TableCellHelper.create(
                    this.scope_.getFrp(), this.tableB_!,
                    key, columnMeta.key));
            //TODO    renderInfo.widget = widget;
            renderInfo.inner.appendChild(widget.getElement());
        }
        return renderInfo;
    }


    /**
     * add new columns to rows that already exist
     * @private
     * @param {Array<Object>} columns columns to add
     * @param {Object} tableMeta meta data associated with table
     * @param {AvlTree} rowsMeta row meta data
     */
    private addRowColumns_(columns:StructType[], tableMeta: StructType, rowsMeta:RowAndCellMetaMap_) {
        let renderState = this.renderState_;
        for (let row of renderState.rows) {
            let rowMeta = rowsMeta.findFirst(row)!;
            for (let columnMeta of columns) {
                this.createCell_(tableMeta, row, rowMeta, columnMeta);
            }
        }
    }

    /**
     * add any headers to the table specified by columns
     */
    private addHeaders_(columns:{key:ColumnKey<any>}[], tableMeta:StructType) {
        let renderState = this.renderState_;
        if (!renderState.headerRow) {
            return;
        }
        for (let meta of columns) {
            let columnHeaderDecorator = this.getMetaValue<() => RenderedDecorator>(
                'headerDecorator', tableMeta, meta);

            let columnHeaderWidgetFactory = this.getMetaValue<WidgetFactory>(
                'headerWidgetFactory', tableMeta, meta);

            let renderInfo = columnHeaderDecorator();
            if (renderInfo.outer && renderState.headerRow.inner) {
                renderState.headerRow.inner.appendChild(renderInfo.outer);
            }
            renderState.headerCols.push(renderInfo);

            renderInfo.factory = columnHeaderWidgetFactory;
            if (renderInfo.inner) {
                let widget = columnHeaderWidgetFactory(
                    this.scope_,
                    TableCellHelper.createHeader(
                        this.scope_.getFrp(),
                        this.tableB_!, meta.key));
                //        renderInfo.widget = widget;
                renderInfo.inner.appendChild(widget.getElement());
            }
        }
    }

    /**
     * assumes there are no row in the current table that do not exist
     * @param orderedRows the new rows that are sorted it the order they need to be displayed
     */
    private doRowMoves_(orderedRows:AvlTree<RowAndCellMeta_, {rowPos:number}>) {
        let renderState = this.renderState_;
        // get a list of rendered rows in its current order
        // this is currently sorted just on pk
        // remove
        let curSorted = new AvlTree<RenderStateRow, {rowPos:number}>(TableWidget.rowMetaPosCompare_);
        let seen = new AvlTree(TableWidget.rowMetaCompare_);

        for (let row of renderState.rows){
            curSorted.add(row);

        }

        let curRowList:RenderStateRow[] = [];
        for (let row of curSorted) {
            curRowList.push(row);
        }

        let srcPos = 0;
        let destPos = 0;
        for (let row of orderedRows) {
            let needed = renderState.rows.findFirst(row);
            // skip if it doesn't exist yet
            if (needed) {
                // skip rows that we have already done
                let currentRow = curRowList[srcPos];
                // this shouldn't result in an infinite loop because
                // all previous rows have been seen so if we are
                // doing a row it must also have been unseen I hope
                while (seen.findFirst(currentRow)) {
                    srcPos++;
                    currentRow = curRowList[srcPos];
                }

                if (TableWidget.rowMetaCompare_(currentRow, needed) !== 0) {
                    //move needed to before the current row
                    if (!removeNode(needed.outer)) {
                        throw 'node does not exits';
                    }
                    if (needed.outer) {
                        insertSiblingBefore(needed.outer, currentRow.outer);
                    }
                }
                needed.rowPos = destPos;
                seen.add(needed);
            }
            destPos++;
        }
    }

    private doRemoves_(table: TableInfo_) {
        let renderState = this.renderState_;
        let state = this.state_;
        let rowRemoves = this.getRowRemoves_(table.rowMeta);
        rowRemoves.inOrderTraverse(function (key) {

            let renderRow = renderState.rows.remove(key);
            if (renderRow && renderRow.outer) {
                renderState.table?.inner?.removeChild(renderRow.outer);
            }
            state.rowMeta.remove(key);//TODO watch this it changed from {key:x}
        });

        // remove the header rows if any
        let colRemoves = this.getColumnRemoves_(table.columnMeta);
        colRemoves.forEach(function (col) {
            let renderInfo = renderState.headerCols[col.pos];
            if (renderState.headerRow && renderInfo.outer) {
                if (renderState.headerRow.inner) {
                    renderState.headerRow.inner.removeChild(renderInfo.outer);
                }
                renderState.headerCols.splice(col.pos, 1);
            }
            state.columnMeta.splice(col.pos, 1);
        });


        // remove the columns from each row
        for (let row of renderState.rows) {
            for (let col of colRemoves) {
                let renderInfo = row.cols[col.pos];
                if (renderInfo.outer && row.inner) {
                    row.inner.removeChild(renderInfo.outer);
                }
                row.cols.splice(col.pos, 1);
            }
        }
    }

    private insertChildAtPos_(parent: Element, el: Node, row: { cols: RenderedDecorator[] }|null, position: number) {
        let actualPosition = 0;
        let i;
        let cols = row ? row.cols : this.renderState_.headerCols;

        for (i = 0; i < position; i++) {
            if (cols[i] && cols[i].outer) {
                actualPosition++;
            }
        }
        insertChildAt(parent, el, actualPosition);
    }

    private replaceWidgetAndDecorator_(
        oldRenderInfo:RenderedDecorator,
        parent: Element|null, position: number, tableMeta: StructType, row: RowAndCellMeta_|null, columnMeta: StructType,
        rowState: {cols: RenderedDecorator[] } | null): RenderedDecorator {
        let type = row ? 'cell' : 'header';
        let cellMeta = row?.cellMeta.get(columnMeta.key) || {};


        let rowMeta = row ? row.meta : {};
        let decorator = this.getMetaValue<() => RenderedDecorator>(type + 'Decorator', tableMeta, rowMeta, columnMeta, cellMeta);
        let factory = this.getMetaValue<WidgetFactory>(type + 'WidgetFactory', tableMeta, rowMeta, columnMeta, cellMeta);
        let widget:Widget;

        if (isEqual(decorator, oldRenderInfo.decorator)
            && isEqual(factory, oldRenderInfo.factory)) {
            return oldRenderInfo;
        }
        let res: RenderedDecorator = new RenderedDecorator(decorator, null);
        let mkHeader =  ()=> {
            return factory(
                this.scope_,
                TableCellHelper.createHeader(
                    this.scope_.getFrp(),
                    this.tableB_!, columnMeta.key));
        };
        if (!isEqual(decorator, oldRenderInfo.decorator)) {

            if (isEqual(factory, oldRenderInfo.factory)) {
                res = decorator ? decorator() : new RenderedDecorator(decorator, null);
                if (oldRenderInfo.outer && res.outer && parent) {
                    this.replaceChild(parent, oldRenderInfo.outer, res.outer);
                    this.moveChildren(oldRenderInfo.inner, res.inner);
                } else if (oldRenderInfo.outer && parent) {
                    parent.removeChild(oldRenderInfo.outer);
                } else if (res.outer && row && parent) {
                    res = this.createRenderInfoCell_(tableMeta, row.key, row, columnMeta);
                    if (res.outer) {
                        this.insertChildAtPos_(parent, res.outer, rowState, position);
                    }
                } else if (res.outer && parent) {
                    this.insertChildAtPos_(parent, res.outer, rowState, position);
                    widget = mkHeader();
                    res.inner?.appendChild(widget.getElement());
                }
//            res.widget = oldRenderInfo.widget;
            } else if (parent) {
                if (row) {
                    // this is a cell create it as a cell
                    res = this.createRenderInfoCell_(tableMeta, row.key, row, columnMeta);
                    this.replaceChild(parent, oldRenderInfo.outer, res.outer);
                } else {
                    res = decorator();
                    this.replaceChild(parent, oldRenderInfo.outer, res.outer);
                    widget = mkHeader();
                    res.inner?.appendChild(widget.getElement());
                }
            }
            res.factory = factory;

        } else if (oldRenderInfo.outer) {
            // no need to deal with null outer hear because they are not changing
            // so if the old one is null so is the new one therefor we don't need to render
            // the cell
            res.inner = oldRenderInfo.inner;
            res.outer = oldRenderInfo.outer;
            if (oldRenderInfo.inner) {
                removeChildren(oldRenderInfo.inner);
            }
            if (row) {
                let cell = this.createRenderInfoCell_(tableMeta, row.key, row, columnMeta);
                res.factory = cell.factory;
                this.moveChildren(cell.inner, res.inner);
            } else {
                let header = mkHeader();
                res.inner?.appendChild(header.getElement());
            }
        }
        res.decorator = decorator;

        return res;
    }

    /**
     * moves all the children from one element to another
     * @param {Element} from
     * @param {Element} to
     */
    moveChildren(from: Element|null|undefined, to: Element|null|undefined) {
        if (!from) {
            return;
        }
        let children = from.childNodes;
        let toMove = [];

        for (let i = 0; children && i < children.length; i++) {
            toMove.push(children[i]);
        }

        for (let i = 0; i < toMove.length; i++) {
            if (from) {
                from.removeChild(toMove[i]);
            }
            if (to) {
                to.appendChild(toMove[i]);
            }
        }
    };

    replaceChild(parent: Element|null, oldChild: Element | null, newChild: Element | null) {

        if (!parent) {
            return;
        }
        if (newChild) {
            parent.insertBefore(newChild, oldChild);
        }
        if (oldChild) {
            parent.removeChild(oldChild);
        }
    };

    /**
     * updates existing headers and cells if the widget, or decorator has changed
     * @param {Object} table meta data describing the whole table
     */

    private doUpdates_(table:TableInfo_) {
        let frp = this.scope_.getFrp();
        let renderState = this.renderState_;
        let tableMeta = table.tableMeta;
        let meta;
        for (let i = 0; i < table.columnMeta.length; i++) {
            meta = table.columnMeta[i];

            if (renderState.headerRow) {
                let oldRenderInfo = renderState.headerCols[i];
                renderState.headerCols[i] = this.replaceWidgetAndDecorator_(oldRenderInfo, renderState.headerRow.inner, i, tableMeta, null, meta, null);
            }
        }

        for (let row of renderState.rows) {
            let newRow = table.rowMeta.findFirst(row)!;
            let rowDecorator = this.getMetaValue<() => RenderedDecorator>('rowDecorator', tableMeta, newRow.meta);
            if (rowDecorator !== row.decorator) {
                let newRowDec = rowDecorator();
                // clone otherwise removeChildren will change this
                if (row.inner) {
                    let children = [...getChildren(row.inner)];
                    removeChildren(row.inner);
                    for (let child of children) {
                        if (newRowDec.inner) {
                            newRowDec.inner.appendChild(child);
                        }
                    }
                }
                if (newRowDec.outer) {
                    EventHelper.listen(newRowDec.outer, EventType.CLICK, EventHelper.makeLong((e: MouseEvent) => {
                        frp.accessTrans(() => this.rowClickEvent_.set({event: e, data: row.key}));
                    }));
                    if (row.outer) {
                        insertSiblingAfter(newRowDec.outer, row.outer);
                    }
                }
                removeNode(row.outer);

                row.inner = newRowDec.inner;
                row.outer = newRowDec.outer;
                row.decorator = newRowDec.decorator;
            }
            for (let i = 0; i < table.columnMeta.length; i++) {
                let columnMeta = table.columnMeta[i];
                let oldRenderInfo = row.cols[i];
                row.cols[i] = this.replaceWidgetAndDecorator_(oldRenderInfo, row.inner, i, tableMeta, newRow, columnMeta, row);
            }
        }
    }

    /**
     * get columns that didn't exist but now do
     */
    private getAddedColumns_<T extends {key: ColumnKey<any>}>(columnMeta:T[]): T[] {
        let oldColumns = this.state_.columnMeta;
        let oldColMap = new Set<ColumnKey<any>>();
        let res = [];

        let i;
        for (i = 0; i < oldColumns.length; i++) {
            oldColMap.add(oldColumns[i].key);
        }

        for (i = 0; i < columnMeta.length; i++) {
            if (!oldColMap.has(columnMeta[i].key)) {
                res.push(columnMeta[i]);
            }
        }
        return res;

    }

    private doColumnAdds_(table: TableInfo_) {
        let renderState = this.renderState_;
        let state = this.state_;
        let tableMeta = table.tableMeta;
        let addedColumns = this.getAddedColumns_(table.columnMeta);
        let headerRowDecorator = this.getMetaValue<() => RenderedDecorator>('headerRowDecorator', tableMeta);
        let headerRowDecoratorVal = headerRowDecorator ? headerRowDecorator() : null;


        if (headerRowDecoratorVal && renderState.headerRow) {
            if (headerRowDecorator === renderState.headerRow.decorator) {
                //nothing has changed
            } else if (renderState.table) {
                let newHeaderRow = headerRowDecorator();
                this.replaceChild(renderState.table.inner, renderState.headerRow.outer, newHeaderRow.outer);
                if (renderState.headerRow.inner) {
                    this.moveChildren(renderState.headerRow.inner, newHeaderRow.inner);
                } else {
                    renderState.headerCols = [];
                    renderState.headerRow.inner = newHeaderRow.inner;
                    this.addHeaders_(state.columnMeta, tableMeta);
                }

                renderState.headerRow = newHeaderRow;
            }
        } else if (headerRowDecoratorVal) {

            if (renderState.table && renderState.table.inner) {
                renderState.headerRow = headerRowDecoratorVal;
                this.addHeaders_(state.columnMeta, tableMeta);
                if (renderState.headerRow.outer) {
                    insertChildAt(renderState.table.inner,
                        renderState.headerRow.outer, 0);
                }
            }


            // just construct the existing headers TODO
        } else if (renderState.headerRow) {
            if (renderState.table && renderState.table.inner) {
                if (renderState.headerRow.outer) {
                    renderState.table.inner.removeChild(renderState.headerRow.outer);
                }
                renderState.headerRow = false;
            }
        }

        // add new columns to existing rows and headers
        this.addHeaders_(addedColumns, tableMeta);
        addedColumns.forEach(function (meta) {
            state.columnMeta.push(meta);
        });
        this.addRowColumns_(addedColumns, tableMeta, table.rowMeta);
    }

    private doColumnMoves_(table: TableInfo_) {
        let movedColumns = this.getColumnMoves_(table.columnMeta);
        let renderState = this.renderState_;
        let state = this.state_;
        let to;
        let from;
        let newColumnMeta = [];
        let newHeaderCols = [];

        for (to = 0; to < movedColumns.length; to++) {
            from = movedColumns[to];
            newColumnMeta.push(state.columnMeta[from]);
            if (renderState.headerRow) {
                let renderInfo = renderState.headerCols[from];

                if (from !== to) {
                    if (renderState.headerRow.inner && renderInfo.outer) {
                        renderState.headerRow.inner.removeChild(renderInfo.outer);

                        insertChildAt(renderState.headerRow.inner, renderInfo.outer, to);
                    }
                }
                newHeaderCols.push(renderInfo);

            }

        }

        renderState.headerCols = newHeaderCols;

        renderState.rows.inOrderTraverse(function (row) {
            let newCols = [];
            for (to = 0; to < movedColumns.length; to++) {
                from = movedColumns[to];
                let renderInfo = row.cols[from];
                newCols.push(renderInfo);
                if (from !== to) {
                    if (renderInfo.outer && row.inner) {
                        row.inner.removeChild(renderInfo.outer);
                        insertChildAt(row.inner, renderInfo.outer, to);
                    }
                }
            }
            row.cols = newCols;
        });

        state.columnMeta = newColumnMeta;

    }

    /**
     * @return row meta and the position it should be inserted
     */
    private getNewRows_(sortedRowMeta: AvlTree<RowAndCellMeta_, { rowPos:number }>): AvlTree<RowAndCellMeta_, { rowPos:number }> {
        let state = this.state_;
        let result = new AvlTree<RowAndCellMeta_, { rowPos:number }>(TableWidget.rowMetaPosCompare_);

        let pos = 0;

        for (let row of sortedRowMeta){
            if (!state.rowMeta.findFirst(row)) {
                let newRow = {...row};
                result.add(newRow);
            }
            pos++;
        }

        return result;

    }

    /**
     * todo split out the table, and the useful meta data from a table
     * this will be helpful, because we don't really need to trigger an update
     * unless the useful parts have changed
     * @param helper
     * @param tableB meta data associated with table
     */
    private updateState_(helper:WidgetHelper, tableB:Behaviour<TableInfo_>) {
        let renderState = this.renderState_;
        const  frp = this.scope_.getFrp();
        if (helper.isGood()) {
            // not just build table
            if (this.renderState_.errors) {
                this.getElement().removeChild(this.renderState_.errors);
                if (this.renderState_.table) {
                    if (this.renderState_.table.outer) {
                        this.getElement().appendChild(this.renderState_.table.outer);
                    }
                }
                this.renderState_.errors = null;
            }

            let table = tableB.get();
            let tableMeta = table.tableMeta;
            let tableDecorator = this.getMetaValue<()=>RenderedDecorator>('tableDecorator', tableMeta);
            let tableComponent = tableDecorator();

            if (this.renderState_.table) {
                if (this.renderState_.table.decorator !== tableDecorator) {
                    if (this.renderState_.table.outer) {
                        this.getElement().removeChild(this.renderState_.table.outer);
                    }
                    this.moveChildren(this.renderState_.table.inner, tableComponent.inner);
                    if (tableComponent.outer) {
                        insertChildAt(this.getElement(), tableComponent.outer, 0);
                    }
                    this.renderState_.table = tableComponent;
                }

            } else {
                if (tableComponent.outer) {
                    this.getElement().appendChild(tableComponent.outer);
                }
                this.renderState_.table = tableComponent;

            }
            this.renderState_.table.decorator = tableDecorator;

            let sortedRowMeta = new AvlTree<RowAndCellMeta_, { rowPos:number }>(TableWidget.rowMetaPosCompare_);
            for (let row of table.rowMeta) {
                sortedRowMeta.add(row);
            }

            this.doRemoves_(table);
            this.doRowMoves_(sortedRowMeta);
            this.doColumnAdds_(table);
            this.doColumnMoves_(table);
            // all the columns are in the right position, update the decorators and stuff so they
            // are correct
            this.doUpdates_(table);

            // at this point every existing cell has the correct behaviour
            // now all we have to do is add th new rows

            let sortedNewRows = this.getNewRows_(sortedRowMeta);
            let newSelect = null;

            for (let row of sortedNewRows) {

                // do this in order of the columns defined in the metadata
                let rowDecorator = this.getMetaValue<()=>RenderedDecorator>('rowDecorator', tableMeta, row.meta);
                let rowComponent:RenderStateRow = {
                    ...rowDecorator(),
                    cols:[],
                    key: row.key,
                    rowPos: row.rowPos,
                    keyCols: row.keyCols,
                };
                if (rowComponent.outer) {
                    EventHelper.listen(rowComponent.outer, EventType.CLICK, EventHelper.makeLong((e: MouseEvent) => {
                        frp.accessTrans(() => this.rowClickEvent_.set({event: e, data: row.key}));
                    }));
                }


                if (this.selectNewRow_) {
                    newSelect = {key: row.key, el: rowComponent.outer};
                }
                if (this.renderState_.table.inner && rowComponent.outer) {
                    insertChildAt(this.renderState_.table.inner, rowComponent.outer, this.renderState_.headerRow ? row.rowPos + 1 : row.rowPos);
                }


                for (let columnMeta of table.columnMeta) {
                    this.createCell_(tableMeta, rowComponent, row, columnMeta);
                }
                renderState.rows.add(rowComponent);

            }
            this.state_ = table;
            if (newSelect) {
                this.scope_.getFrp().accessTrans(()=>{
                    if (table.canSelect) {
                        this.selectedB_.set([newSelect.key]);
                    }
                    if (newSelect.el) {
                        newSelect.el.scrollIntoView();
                    }
                }, this.selectedB_);
            }

        } else {
            if (!this.renderState_.errors) {
                if (this.renderState_.table) {
                    if (this.renderState_.table.outer) {
                        this.getElement().removeChild(this.renderState_.table.outer);
                    }
                }
                this.renderState_.errors = createDom('div');
                this.getElement().appendChild(this.renderState_.errors);
            }
            removeChildren(this.renderState_.errors);

            for (let error of helper.errors()) {
                let div = createDom('div', {class: 'error'}, createTextNode(error.toString()));
                div.onclick = function () {
                    console.error('Error was', error);
                };
                this.renderState_.errors.appendChild(
                    div);

            }

            // display error or not ready state
        }
        this.selectNewRow_ = false;
    }

    attachStruct(table:BehaviourOrType<Table>) {

        this.tableB_ = this.scope_.getFrp().toBehaviour(table);

        this.scope_.getFrp().accessTrans(
            () => {
                this.tableBB_.set(this.tableB_!);
            }, this.tableBB_);
        this.renderInfoB_ = this.createRenderInfo_(this.tableB_);
        this.helper_.attach(this.renderInfoB_);
        this.selectionHelper_.attach(this.selectedB_, this.createSelectInfo_(this.tableB_));
    }

    attach(table: BehaviourOrType<Table>, meta: BehaviourOrType<TableMetaData>) {
        let frp = this.scope_.getFrp();

        let tableB = frp.toBehaviour(table);
        let metaB = frp.toBehaviour(meta);

        let complete = frp.liftBI(()=> {
            return metaB.get().applyMeta(tableB.get());
        },  (val:Table)=> {
            tableB.set(val);
        }, tableB, metaB);
        this.attachStruct(complete);
    }
}


/**
 *
 * @enum {number}
 * @final
 */
export enum SelectionMode   {
    NONE= 1,
    SINGLE= 2,
    MULTI= 3,
}
