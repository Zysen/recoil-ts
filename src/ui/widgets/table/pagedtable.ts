/**
 * provides paging functionality for table widget
 */
import {Widget} from "../widget.ts";
import {WidgetScope} from "../widgetscope.ts";
import {createDom} from "../../dom/dom.ts";
import {TableWidget} from "./table_widget.ts";
import {WidgetHelper} from "../../widgethelper.ts";
import classlist from "../../dom/classlist.ts";
import {ButtonAttachType, ButtonWidget} from "../button.ts";
import {AttachType, BehaviourOrType} from "../../../frp/struct.ts";
import {Options} from "../../frp/util.ts";
import {Table, TableRow} from "../../../structs/table/table.ts";
import {TableMetaData} from "./meta_data.ts";
import {EventHelper} from "../../eventhelper.ts";
import {EventType} from "../../dom/eventtype.ts";
import {Behaviour} from "../../../frp/frp.ts";
import {Messages} from "../../messages.ts";
import {KeyCodes, Keys} from "../../dom/keycodes.ts";
import {Html} from "../../html.ts";

export type PagerKeyType = null|{page:number, next?:TableRow|null, prev?:TableRow|null}

/**
 * @param {boolean=} opt_new use new layout
 * @param {boolean=} opt_buttons do we want add/remove buttons default true
 * @implements recoil.ui.Widget
 */
export class PagedTableWidget extends Widget {
    private topPager_: PagerWidget;
    private bottomPager_: PagerWidget;
    private tableWidget_: TableWidget;
    private headerWidget_: TableWidget;

    private actionsDiv_: HTMLDivElement | undefined;

    private addButton_: ButtonWidget | undefined;
    private removeButton_: ButtonWidget | undefined;

    constructor(scope: WidgetScope, opt_new?: boolean, opt_buttons?: boolean) {
        super(scope, createDom('div', {class: 'recoil-paged-table'}));
        let buttons = opt_buttons == undefined ? true : !!opt_buttons;

        this.tableWidget_ = new TableWidget(scope);
        this.headerWidget_ = new TableWidget(scope);
//    this.helper_ = new recoil.ui.ComponentWidgetHelper(scope, this.container_, this, this.updateState_);

        this.topPager_ = new PagerWidget(scope);
        this.bottomPager_ = new PagerWidget(scope);

        let tableDiv = createDom('div');
        tableDiv.appendChild(this.tableWidget_.getElement());
        if (!opt_new) {
            classlist.add(tableDiv, 'flex-grow');
        }
        classlist.add(this.getElement(), 'flex-display');

        let headerDiv = createDom('div', {class: 'recoil-table-pager-header'});
        if (!opt_new) {
            headerDiv.appendChild(this.headerWidget_.getElement());
        }
        let div = createDom('div', {class: 'recoil-table-pager-container'});

        this.getElement().appendChild(div);
        if (opt_new) {
            if (buttons) {
                this.actionsDiv_ = createDom('div', {class: 'recoil-table-pager-actions'});
                this.addButton_ = new ButtonWidget(scope);
                this.actionsDiv_.appendChild(this.addButton_.getElement());
                this.removeButton_ = new ButtonWidget(scope);
                this.actionsDiv_.appendChild(this.removeButton_.getElement());
            }
            div.appendChild(createDom(
                'div', {class: 'recoil-table-pager-top'},
                createDom('div', {class: 'recoil-table-pager-top-scroller'},
                    this.topPager_.getElement())));
            if (this.actionsDiv_) {
                div.appendChild(this.actionsDiv_);
            }

            div.appendChild(createDom('div', {class: 'recoil-table-pager-content'}, headerDiv, tableDiv));
        } else {
            div.appendChild(this.topPager_.getElement());
            div.appendChild(headerDiv);
            div.appendChild(tableDiv);
        }
        div.appendChild(this.bottomPager_.getElement());

        let me = this;
    }


    getBottomPager(): PagerWidget {
        return this.bottomPager_;
    };

    /**
     * @param {!recoil.frp.Behaviour|!Object} addB
     * @param {!recoil.frp.Behaviour|!Object} removeB
     */
    attachButtons(addB: ButtonAttachType, removeB: ButtonAttachType) {
        if (!this.addButton_ || !this.removeButton_) {
            throw new Error("buttons not added set opt_new to true in the constructor");
        }
        this.addButton_.attachStruct(addB);
        this.removeButton_.attachStruct(removeB);
    }

    static options = Options('table', 'page', 'count', {
        meta: null,
        header:null,
    })

    /**
     * the optional parameter is really meta, if not provide it is assumed that header and table include there meta data
     * this is the way is should be done however for backward compatablity I am leaving it the old way too
     */
    attachStruct(options: AttachType<{
        header?: Table,
        table: Table,
        meta?: TableMetaData,
        page: number,
        count: number,
    }>) {
        let bound = PagedTableWidget.options.bind(this.scope_.getFrp(), options);
        const frp = this.scope_.getFrp();
        let tableB = bound.table();
        let metaTableB = frp.liftBI((t: Table, meta: TableMetaData | null) => {
            if (meta) {
                return meta.applyMeta(t);
            }
            return t;
        }, (v: Table) => {
            tableB.set(v)
        }, tableB, bound.meta());

        let headerB = bound.header();
        let header

        if (this.actionsDiv_) {
            let html = new Html(this.scope_);
            let editableB = this.scope_.getFrp().liftB((t) => {
                let editable = t.getMeta().editable;
                return editable === undefined ? true : editable;
            }, tableB);
            html.show(this.actionsDiv_, editableB);
        }
        if (header) {
            this.headerWidget_.attachStruct(header);
        }
        this.tableWidget_.attachStruct(metaTableB);
        this.topPager_.attachStruct(options);
        this.bottomPager_.attachStruct(options);
    }


    /**
     * this should be called after the attach this way it can filter out the
     * rows that do not exist in the table.
     *
     * note this is a bidirectional behaviour, so setting it will change the selection
     *
     * @return {!recoil.frp.Behaviour<!Array<!Array<Object>>>}
     */
    createSelected() {
        return this.tableWidget_.createSelected();
    }
}

/**
 * @constructor
 * @param {!recoil.ui.WidgetScope} scope
 * @implements recoil.ui.Widget
 */
export class PagerWidget extends Widget<HTMLDivElement> {
    private first_: HTMLLinkElement;
    private last_: HTMLLinkElement;
    private next_: HTMLLinkElement;
    private prev_: HTMLLinkElement;
    private pageInput_: HTMLInputElement;

    private helper_: WidgetHelper;

    private pageB_?: Behaviour<number>;
    private countB_?: Behaviour<number>;

    constructor(scope: WidgetScope) {
        super(scope, createDom('div', 'recoil-table-pager-scroller'))
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);

        this.first_ = createDom('a', {
            class: 'first'
        }, '\u00ab');
        this.last_ = createDom('a', {
            class: 'last'
        }, '\u00bb');
        this.next_ = createDom('a', {
            class: 'next'
        }, '\u203A');
        this.prev_ = createDom('a', {
            class: 'previous'
        }, '\u2039');


        let selectPage = createDom('input', {
            type: 'text',
            class: 'page'
        });

        let container = createDom('table', {
            class: 'recoil-table-pager pagination'
        });

        this.pageInput_ = selectPage;

        EventHelper.listen(this.pageInput_, EventType.KEYDOWN, (e:KeyboardEvent) =>{
            if (e.key === Keys.ENTER) {
                selectPage.blur();
            }
        });

        let row = createDom('div', {class: 'row'});

        EventHelper.listen(selectPage, EventType.BLUR, () => this.scope_.getFrp().accessTrans(
            () => {
                if (this.helper_.isGood()) {
                    let val = parseInt(selectPage.value, 10);
                    if (val + '' === selectPage.value && val > 0 && val <= this.countB_!.get()) {
                        this.pageB_!.set(val);
                    }
                }
                this.updateInfo_();
            }, this.pageB_!, this.countB_!));

        EventHelper.listen(selectPage, EventType.FOCUS, () =>
            this.scope_.getFrp().accessTrans(
                () => {
                    if (this.helper_.isGood()) {
                        selectPage.value = String(this.pageB_!.get());
                        selectPage.setSelectionRange(0, selectPage.value.length);
                    }
                }, this.pageB_!, this.countB_!));

        EventHelper.listen(this.last_, EventType.CLICK, () => {
            this.scope_.getFrp().accessTrans(
                () => {
                    if (this.helper_.isGood()) {
                        this.pageB_!.set(this.countB_!.get());
                    }
                }, this.pageB_!, this.countB_!)
        });

        EventHelper.listen(this.first_, EventType.CLICK, () =>
            this.scope_.getFrp().accessTrans(
                () => {
                    if (this.helper_.isGood()) {
                        this.pageB_!.set(1);
                    }
                }, this.pageB_!, this.countB_!)
        );

        EventHelper.listen(this.prev_, EventType.CLICK, () =>
            this.scope_.getFrp().accessTrans(
                () => {
                    if (this.helper_.isGood()) {
                        if (this.pageB_!.get() > 1) {
                            this.pageB_!.set(this.pageB_!.get() - 1);
                        }
                    }
                }, this.pageB_!, this.countB_!));

        EventHelper.listen(this.next_, EventType.CLICK, () =>
            this.scope_.getFrp().accessTrans(
                () => {
                    if (this.helper_.isGood()) {
                        if (this.pageB_!.get() < this.countB_!.get()) {
                            this.pageB_!.set(this.pageB_!.get() + 1);
                        }
                    }
                }, this.pageB_!, this.countB_!));

        container.appendChild(row);

        row.appendChild(this.first_);
        row.appendChild(this.prev_);
        row.appendChild(selectPage);
        row.appendChild(this.next_);
        row.appendChild(this.last_);

        this.getElement().appendChild(container);
    }

    static options = Options('page', 'count');

    /**
     * @param {!recoil.frp.Behaviour<number>} page the page that need to be displayed, must be behaviour otherwise
     8                                              we can't change the page
     * @param {!recoil.frp.Behaviour<number> |number} count
     */
    attachStruct(options: AttachType<{
        page: number,
        count: number,
    }>) {

        let bound = PagerWidget.options.bind(this.scope_.getFrp(), options);

        this.pageB_ = bound.page();
        this.countB_ = bound.count();
        this.helper_.attach(this.pageB_, this.countB_);
    }

    /***
     * helper to mark buttons disabled
     */
    private disable_(disabled: boolean, ...items: Element[]) {

        for (let item of items) {
            if (disabled) {
                classlist.add(item, 'disabled');
            } else {
                classlist.remove(item, 'disabled');
            }
        }
    }

    /**
     * updates the info in the table widget
     * @private
     */

    private updateInfo_() {
        if (this.helper_.isGood()) {
            this.pageInput_.value = Messages.PAGE_X_OF_Y.resolve(
                {x: this.pageB_!.get(), y: this.countB_!.get()}).toString();
            let c = this.countB_!.get();
            let p = this.pageB_!.get();
            let enabled = c > 1;
            this.pageInput_.disabled = !enabled;
            this.disable_(!enabled || p === 1, this.first_, this.prev_);
            this.disable_(!enabled || p === c, this.last_, this.next_);
            this.pageInput_.disabled = !enabled;
        } else {
            this.pageInput_.disabled = true;
            this.disable_(true, this.first_, this.prev_, this.last_, this.next_);
            this.pageInput_.value = Messages.PAGE_X_OF_Y.resolve(
                {
                    x: this.pageB_!.metaGet().good() ? this.pageB_!.get() : Messages.__UNKNOWN_VAL,
                    y: this.countB_!.metaGet().good() ? this.countB_!.get() : Messages.__UNKNOWN_VAL
                }).toString();
        }
    }

    /**
     * updates the display in the pager widget
     * @private
     */
    private updateState_() {
        let enabled = this.helper_.isGood();
        if (this.helper_.isGood()) {
            if (this.pageInput_ !== document.activeElement) {
                this.updateInfo_();
            }
        } else {
            this.updateInfo_();
        }

    }

    /**
     * a pager that takes a table with 2 extra rows
     * @param {!recoil.frp.Behaviour<!recoil.structs.table.Table>} tableB table to be paged, it should contain an extra row for before and after (if it exists)
     * @param {!recoil.frp.Behaviour<Object>} keyB an object specifies to do nextcan be null - first, page: _, prev: row, next: row
     * @param {!recoil.frp.Behaviour<number>|number} pageSize size of a page
     * @param {!recoil.frp.Behaviour<number>|number} tableSize size of the entire table
     * @return {{page:!recoil.frp.Behaviour<number>,table: !recoil.frp.Behaviour<!recoil.structs.table.Table>, count : !recoil.frp.Behaviour<number>}}
     */

    static createNextTablePager(tableB: Behaviour<Table>, keyB: Behaviour<PagerKeyType>, pageSize: BehaviourOrType<number>, tableSize: BehaviourOrType<number>) {
        let frp = tableB.frp();
        let pageSizeB = frp.toBehaviour(pageSize);
        let tableSizeB = frp.toBehaviour(tableSize);
        let memoryB = frp.createB(1);
        let countB = frp.liftB(function (size, pageSize) {
            return Math.ceil(size / pageSize);
        }, tableSizeB, pageSizeB);

        let rememberPageB = tableB.frp().liftBI(
            () => {
                if (countB.get() < memoryB.get()) {
                    keyB.set({page: Math.max(1, countB.get())});
                    memoryB.set(Math.max(1, countB.get()));
                }
                return {orig: memoryB.get(), val: memoryB.get()};
            },
            (val) => {
                // allow setting of value it table is not good, changing the page will probaly cause this
                if (!tableB.good()) {
                    memoryB.set(val.val);
                    return;
                }
                let table = tableB.get();
                let first:TableRow|null = null;
                let last:TableRow|null = null;

                for (let {row} of table) {
                    first = first || row;
                    last = row;
                }

                if (val.orig + 1 === val.val) {
                    // value has increased by 1 just get the next page
                    if (last) {
                        keyB.set({next: last, page: val.val});
                        memoryB.set(val.val);
                    }
                } else if (val.val === 1) {
                    // we want the first page no need for a key
                    keyB.set(null);
                    memoryB.set(val.val);
                } else if (val.orig - 1 === val.val) {
                    // went back 1 use prev
                    keyB.set({prev: first, page: val.val});
                    memoryB.set(val.val);
                } else {
                    // random page just get that
                    keyB.set({page: val.val});
                    memoryB.set(val.val);
                }
            }, tableB, keyB, memoryB, pageSizeB, countB);


        let pageB = frp.liftBI(
            function (page) {
                return rememberPageB.get().val;
            },
            function (val) {
                if (rememberPageB.get() === null) {
                    rememberPageB.set({orig: null, val: val});
                } else {
                    rememberPageB.set({orig: rememberPageB.get().orig, val: val});
                }
            }, rememberPageB);
        return {
            table: tableB,
            page: pageB,
            count: countB
        };
    }
}
