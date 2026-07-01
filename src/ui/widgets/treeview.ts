import {WidgetHelper} from "../widgethelper.ts";
import {WidgetScope} from "./widgetscope.ts";
import {Widget} from "./widget.ts";
import {
    createDom,
    createTextNode,
    DomHelper, insertChildAt,
    removeChildren,
    removeNode,
} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {Tree} from "../../structs/tree.ts";
import {getOptionsGroup, StandardOptions} from "../frp/util.ts";
import {Behaviour, Frp} from "../../frp/frp.ts";
import {isEqual} from "../../util/object.ts";
import {Label} from "./label.ts";
import {LocalBehaviour} from "../frp/localbehaviour.ts";
import {AttachType} from "../../frp/struct.ts";
import {enable} from "../dom/classlist.ts";
import {EventHelper} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {getValueB} from "../../frp/tree.ts";

type SelectInfo<Type> = { path: string[], value: Type };

export enum ExpandState {
    collapsed, expanded, leaf
}

export class ExpandInfoExpanded {
    [index: string]: { expand: boolean, children: ExpandInfoExpanded };

    constructor(toClone?: ExpandInfoExpanded | undefined) {
        if (toClone) {
            for (let key in toClone) {
                this[key] = toClone[key];
            }
        }
    }

}

type ExpandInfo = { internal: boolean | undefined, expanded: ExpandInfoExpanded | boolean };

type ConfigInfo<Type> = {
    indentWidth: number,
    showRoot: boolean,
    showLines: boolean,
    collapseChildren: boolean, // if you collapse a node collapse all open children as well
    showRootLines: boolean,
    oneClickExpand: boolean,
    labelClickExpand: boolean,
    isUserCollapsible: boolean,
    isRightToLeft: boolean,
    clickCallback?: (e: Event) => void,
    domHelper: DomHelper,
    renderer: (scope: WidgetScope, path: string[], treeB: Behaviour<Tree<Type>>) => Element,
    iconRenderer: (scope: WidgetScope, path: string[], treeB: Behaviour<Tree<Type>>) => Element,
    expandRenderer: ((scope: WidgetScope, path: string[], treeB: Behaviour<Tree<Type>>, state: ExpandState) => Element) | null,
    afterLabelRenderer: (scope: WidgetScope, path: string, treeB: Behaviour<Tree<Type>>) => Element,
}

export class TreeView<Type> extends Widget {

    private oldValue_: Tree<Type> | null;
    private tree_: TreeNode<Type> | null = null;
    private treeSet_: boolean = false;
    private readonly configHelper_: WidgetHelper;
    private readonly stateHelper_: WidgetHelper;
    private readonly expandHelper_: WidgetHelper;
    private readonly selectedB_: Behaviour<SelectInfo<Type>[]>;
    private readonly treeDiv_: HTMLTableElement;
    private readonly errorDiv_: HTMLDivElement;
    private blockExpandEvents_ = false;
    private expandedB_?: Behaviour<ExpandInfoExpanded | boolean>;
    private valueB_?: Behaviour<Tree<Type>>;
    private configB_?: Behaviour<ConfigInfo<Type>>;
    userToggle?: boolean = false;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV, {class: 'recoil-tree-view'}));
        this.treeDiv_ = createDom(TagName.TABLE, {class: 'recoil-tree'});
        this.errorDiv_ = createDom(TagName.DIV, {class: 'recoil-tree-error'});
        this.getElement().appendChild(this.treeDiv_);
        this.getElement().appendChild(this.errorDiv_);
        this.oldValue_ = null;
        this.configHelper_ = new WidgetHelper(scope, this.getElement(), this, this.updateConfig_);
        this.stateHelper_ = new WidgetHelper(scope, this.getElement(), this, this.updateTree_);
        this.expandHelper_ = new WidgetHelper(scope, this.getElement(), this, this.updateExpand_);
        this.selectedB_ = scope.getFrp().createB([]);
    }

    getSelectedB():Behaviour<SelectInfo<Type>[]> {
        return this.selectedB_;
    }

    /**
     * scrolls the element into view if not on screen
     * @param {!Element} el
     */
    static scrollIfNeeded(el: Element) {
        let findScrollableParent = function (el: Element): Element | null {
            let cur: Element | null = el;
            while (cur) {
                if (cur.scrollHeight > cur.clientHeight) {
                    let style = getComputedStyle(cur);
                    let overflow = style ? style.overflow : '';
                    if (['auto', 'scroll'].indexOf(overflow) >= 0) {
                        return cur;
                    }
                }
                cur = cur.parentElement;
            }
            return null;
        };
        let ancestor = findScrollableParent(el);
        if (ancestor && (ancestor as any).scrollIntoView) {
            let bound = el.getBoundingClientRect();
            let abound = ancestor.getBoundingClientRect();
            if (bound && abound) {
                if (abound.bottom < bound.bottom) {
                    el.scrollIntoView(false);
                } else if (bound.top < abound.top) {
                    el.scrollIntoView(true);

                }
            }
        }
    }

    static defaultNodeFactory<Type>(scope: WidgetScope, nodeB: Behaviour<Type>): Label<Type> {
        let widget = new Label<Type>(scope);
        widget.attachStruct({value: nodeB});
        return widget;
    }


    /**
     * callback handler that gets called when the configuration for the widget
     * gets changed
     *
     */
    private updateConfig_(helper: WidgetHelper) {
        let good = helper.isGood();
        removeChildren(this.treeDiv_);
        if (good) {
            const config = this.configB_!.get();
            enable(this.treeDiv_, "recoil-tree-show-lines", config.showLines);

            this.oldValue_ = null;
            /* todo            this.tree_.listen(goog.events.EventType.CHANGE, (e)=> {
                let item = this.tree_.getSelectedItem();
                let path = [];
                let cur = item;

                while (cur && cur.key_) {
                    path.unshift(cur.key_);
                    cur = cur.getParent();
                }
                if (this.oldValue_) {
                    this.scope_.getFrp().accessTrans(
                         () => {
                            if (item) {
                                this.selectedB_.set([{path: path, value: this.oldValue_.getValue(path)}]);
                            } else {
                                this.selectedB_.set([]);
                            }
                        }, this.selectedB_);
                }

            }, false, this);*/

            // now force the tree to re-render since we just destroyed
            // todo this.treeEl_.setShowRootNode(treeConfig.showRoot === undefined || treeConfig.showRoot);
            // todo this.treeEl_.setShowLines(treeConfig.showLines === undefined || treeConfig.showLines);
//            this.tree_.setShowExpandIcons(treeConfig.showExpandIcons === undefined || treeConfig.showExpandIcons);
            // and created a new one
            this.stateHelper_.forceUpdate();
        } else {
            this.stateHelper_.forceUpdate();
        }

    };

    /**
     * @private
     */
    private clearErrors_() {
        removeChildren(this.errorDiv_);
    }

    private addErrors_(helper: WidgetHelper) {
        for (let error of helper.errors()) {
            let div = createDom('div', {class: 'recoil-error'}, createTextNode(error.toString()));
            div.onclick = function () {
                console.error('Error was', error);
            };
            this.errorDiv_.appendChild(div);

        }
    }

    /**
     * updates the expanded behaviour from the tree
     */
    private updateExpanded_() {
        let expandedB = this.expandedB_;
        if (!this.tree_ || !expandedB) {
            return;
        }


        let getExpandedRec = function (node: TreeNode<Type>,
                                       expandedSet: ExpandInfoExpanded) {
            for (let child of node.getChildren()) {
                if (child.getExpanded() && child.hasChildren()) {
                    let childExpanded = new ExpandInfoExpanded();
                    getExpandedRec(child, childExpanded);
                    childExpanded[child.key()] = {expand: true, children: childExpanded};
                }
            }
        };
        const tree = this.tree_;
        this.scope_.getFrp().accessTrans(
            () => {
                let expanded = {};
                getExpandedRec(tree, expanded);
                expandedB.set(expanded);
            }, expandedB);
    };

    private updateExpand_(helper: WidgetHelper, newValueB: Behaviour<ExpandInfo>) {
        if (!helper.isGood() || newValueB.get().internal) {
            return;
        }

        if (this.tree_ && this.treeSet_) {
            let newValue = newValueB.get();
            try {
                this.blockExpandEvents_ = true;
                if (newValue.expanded === true || newValue.expanded === false) {
                    /* todo                if (newValue.expanded) {
                                        this.tree_.expandAll();
                                    } else {
                                        this.tree_.collapseAll();
                                    }*/
                } else {
                    let expandRec = (node: TreeNode<Type>, expandSet: ExpandInfoExpanded | undefined) => {
                        for (let child of node.getChildren()) {
                            if (child.hasChildren()) {
                                child.setExpanded(!!(expandSet && expandSet[child.key()]));
                                if (expandSet) {
                                    expandRec(child, expandSet[child.key()].children);
                                } else {
                                    expandRec(child, undefined);
                                }
                            } else {
                                child.setExpanded(false);
                            }
                        }
                    };
                    expandRec(this.tree_, newValue.expanded);
                }
                this.updateExpanded_();
            } finally {
                this.blockExpandEvents_ = false;
            }

        }
    }

    /**
     * @private
     * @param {recoil.ui.WidgetHelper} helper
     * @param {!recoil.frp.Behaviour<recoil.structs.Tree>} newValue
     */
    private updateTree_(helper: WidgetHelper, newValue: Behaviour<Tree<Type>>) {
        let good = helper.isGood();
        // clear out errors
        this.clearErrors_();
        if (good) {
            let newTree = newValue.get();
            let oldNode = this.tree_;
            if (oldNode) {
                if (!isEqual(oldNode.key(), newTree.key())) {
                    oldNode.removeAll();
                    oldNode = null;
                }
            }
            this.tree_ = this.populateTreeRec_(this.treeDiv_, {pos: 0}, [], [], oldNode, this.oldValue_, newTree);
            this.oldValue_ = newValue.get();
            this.expandHelper_.forceUpdate();
        } else {
            this.addErrors_(helper);
        }
    }

    /**
     * attachable behaviours for widget
     */
    static options = StandardOptions(
        'value', {
            indentWidth: 19,
            showRoot: true,
            showLines: true,
            oneClickExpand: true,
            collapseChildren: false, // if you collapase a node collapse the children as well
            labelClickExpand: true,
            isRightToLeft: false,
            isUserCollapsible: true,
            clickCallback: null,
            expanded: null,
            renderer: TreeView.defaultLabelRenderer,
            iconRenderer: TreeView.defaultIconRenderer,
            expandRenderer: TreeView.defaultExpandRenderer, // set to null if you don't want to show expand icons
            afterLabelRenderer: TreeView.defaultAfterLabelRenderer,
            domHelper: new DomHelper(),
        });


    attach(options: AttachType<{
        value: Type,
        expanded?: ExpandInfoExpanded | boolean,
        oneClickExpand?: boolean,
        collapseChildren?: boolean,
        expandRenderer?:((scope: WidgetScope, path: string[], treeB: Behaviour<Tree<Type>>, state: ExpandState) => Element) | null,
        labelClickExpand?: boolean,
        showRoot?: boolean, showLines?: boolean,

    }>) {
        let frp = this.scope_.getFrp();

        let bound = TreeView.options.bind(frp, options);

        this.configB_ = getOptionsGroup(bound, [
            bound.indentWidth, bound.showRoot, bound.showLines, bound.showExpandedIcons,
            bound.clickCallback, bound.renderer, bound.iconRenderer,
            bound.afterLabelRenderer, bound.expandRenderer, bound.domHelper,
            bound.oneClickExpand, bound.collapseChildren,
            bound.labelClickExpand, bound.isUserCollapsible, bound.isRightToLeft,
        ]);
        this.valueB_ = bound.value();
        // expanded can't be read only otherwise it won't work
        let expandedInternalB = frp.createB<ExpandInfo>({internal: true, expanded: new ExpandInfoExpanded()});

        this.expandedB_ = frp.liftBI((internal: ExpandInfo, external: ExpandInfoExpanded | boolean | null): boolean | ExpandInfoExpanded => {
                if (external !== null) {
                    return external;
                }
                return internal.expanded;
            },
            (expanded, internalB, externalB) => {
                internalB.set({internal: true, expanded: expanded});
                externalB.set(expanded);
            },
            expandedInternalB, bound.expanded());

        this.configHelper_.attach(this.configB_);
        this.stateHelper_.attach(this.valueB_, this.configB_, this.expandedB_);
        this.expandHelper_.attach(this.expandedB_);

    };

    /**
     * tests if the values of the nodes are the same
     */
    private static same_<Type>(a: Tree<Type>, b: Tree<Type>):boolean {
        return isEqual(a.key(), b.key());
    }

    private expandListener_(e: Event) {
        if (this.blockExpandEvents_) {
            return;
        }
        this.updateExpanded_();
    };

    /**
     * TreeNodes are the current HTML Elements created
     */
    private populateTreeRec_(
        container: HTMLDivElement,
        location: { pos: number },
        path: string[],
        parentLastChildren: boolean[],
        oldNode: TreeNode<Type> | null, oldValue: Tree<Type> | null, newValue: Tree<Type> | null): TreeNode<Type> | null {
        // let numChildren = getNumChildren(parentValue);
        // let oldNumChildren = getNumChildren(oldValue);;
        if (!this.valueB_ || !this.configB_) {
            return null;
        }
        if (!newValue) {
            if (oldValue && oldNode) {
                oldNode.removeAll();
            }
            return null;
        }

        let config = this.configB_.get();
        let newPath: [...string[], string] = [...path, newValue.key()];

        const show = config.showRoot || path.length > 0;
        // do child nodes
        let expanded = this.isExpanded(newPath);
        if (!oldValue || !oldNode) {
            // if the old value or old node doesn't exist we can just construct the tree ignoring the old value trees
            let curNode = new TreeNode<Type>(this.scope_, this.valueB_, this, newPath, newValue.value(), config);
            if (show) {
                insertChildAt(container, curNode.getElement(), location.pos++);
            }

            // if we are not showing the root we can't stop here
            if (!expanded && show) {
                curNode.updateDom(parentLastChildren, newValue.children().length === 0)
                return curNode;
            }
            let children = newValue.children();
            let idx = 0;
            for (let child of children) {

                let childNode = this.populateTreeRec_(container, location, newPath, [...parentLastChildren, idx === children.length - 1], null, null, child);
                if (childNode) {
                    curNode.addChild(childNode);
                }
                idx++;
            }
            curNode.updateDom(parentLastChildren, newValue.children().length === 0)
            return curNode;
        }

        let curNode = oldNode;
        if (container.children[location.pos] !== curNode.getElement()) {
            removeNode(curNode.getElement());
            if (show) {
                insertChildAt(container, curNode.getElement(), location.pos++);
            }
        } else {
            if (show) {
                location.pos++;
            }
        }

        if (!expanded) {
            // just delete all the children of the old node since they shouldn't bet there
            if (oldNode) {
                for (let node of oldNode.getChildren()) {
                    node.removeAll();
                }
            }
            curNode.setChildren([]);
            curNode.updateDom(parentLastChildren, newValue.children().length === 0);
            return curNode;
        } else {
            let differences = TreeView.minDifference(oldValue.children(), newValue.children(), TreeView.same_);

            let newChildren: TreeNode<Type>[] = [];
            let notRemoved = new Set<TreeNode<Type>>(oldNode.getChildren());

            let lastChild = newValue.children()[newValue.children().length - 1];
            for (let diff of differences) {
                let oldChild = oldNode.find(diff.oldVal);
                if (oldChild) {
                    notRemoved.delete(oldChild);
                }
                let newChild: TreeNode<Type> | null = null;
                if (diff.oldVal !== undefined && diff.newVal !== undefined) {
                    newChild = this.populateTreeRec_(container, location, newPath, [...parentLastChildren, lastChild === diff.newVal], oldChild, diff.oldVal, diff.newVal);
                } else if (diff.newVal === undefined) {
                    newChild = this.populateTreeRec_(container, location, newPath, [...parentLastChildren, false], oldChild, diff.oldVal!, null);
                } else if (diff.oldVal === undefined) {
                    newChild = this.populateTreeRec_(container, location, newPath, [...parentLastChildren, lastChild === diff.newVal], null, null, diff.newVal);
                }
                if (newChild) {
                    newChildren.push(newChild);
                }
            }
            for (let child of notRemoved) {
                child.removeAll();
            }

            curNode.setChildren(newChildren);
        }
        curNode.updateDom(parentLastChildren, newValue.children().length === 0);
        return curNode;
    }

    static createDiffGrid<Type>(origList: Tree<Type>[], newList: Tree<Type>[], isEqual: (x: Tree<Type>, y: Tree<Type>) => boolean) {

        let grid: {
            i?: number, j?: number,
            oldVal?: Tree<Type>, newVal?: Tree<Type>,
            val: number
        }[][] = [];
        for (let i = 0; i <= origList.length; i++) {
            grid[i] = [];
            grid[i][0] = {
                val: i
            };
            if (i !== 0) {
                grid[i][0].oldVal = origList[i - 1];
                grid[i][0].i = i - 1;
                grid[i][0].j = 0;
            }

        }

        for (let i = 0; i <= newList.length; i++) {
            grid[0][i] = {
                val: i
            };
            if (i !== 0) {
                grid[0][i].newVal = newList[i - 1];
                grid[0][i].i = 0;
                grid[0][i].j = i - 1;
            }
        }

        for (let i = 1; i <= origList.length; i++) {
            for (let j = 1; j <= newList.length; j++) {
                if (isEqual(origList[i - 1], newList[j - 1]) && grid[i - 1][j - 1].val <= grid[i - 1][j].val && grid[i - 1][j - 1].val <= grid[i][j - 1].val) {
                    grid[i][j] = {
                        val: grid[i - 1][j - 1].val,
                        oldVal: origList[i - 1],
                        newVal: newList[j - 1],
                        i: i - 1,
                        j: j - 1
                    };
                } else if (grid[i][j - 1].val < grid[i - 1][j].val) {
                    grid[i][j] = {
                        val: grid[i][j - 1].val + 1,
                        newVal: newList[j - 1],
                        i: i,
                        j: j - 1
                    };
                } else {
                    grid[i][j] = {
                        val: grid[i - 1][j].val + 1,
                        oldVal: origList[i - 1],
                        i: i - 1,
                        j: j
                    };
                }
            }
        }
        return grid;
    }

    /**
     * this is a minimum edit distance algorithm,
     *
     * the edit types are currently insert, delete, (no modify operation, you must parameterise this in order to use it)
     *
     * the result is a list of objects in the form of {oldValue:? , newValue:?}
     *
     * if both are defined then no change, if only oldValue is defined, it was a delete, if only newValue is defined, it was
     * an insert
     *
     * isEqual is a function that takes 2 items and return if 2 items in the input list are equal.
     */

    static minDifference<Type>(origList: Tree<Type>[], newList: Tree<Type>[], isEqual: (x: Tree<Type>, y: Tree<Type>) => boolean) {
        let grid = TreeView.createDiffGrid(origList, newList, isEqual);

        let res = [];
        let i = origList.length;
        let j = newList.length;

        while (i !== 0 || j !== 0) {
            let g = grid[i][j];
            if (g.newVal == undefined) {
                res.push({
                    oldVal: g.oldVal
                });
            } else if (g.oldVal == undefined) {
                res.push({
                    newVal: g.newVal
                });
            } else {
                res.push({
                    newVal: g.newVal,
                    oldVal: g.oldVal
                });
            }

            i = g.i as number;
            j = g.j as number;

        }
        res.reverse();
        return res;

    };

 static createExpanded(frp: Frp, key: string, version: string, opt_defaultExpanded?: ExpandInfoExpanded) {
        let defaultExpanded = opt_defaultExpanded || new ExpandInfoExpanded();

        let expandedInternalB = frp.createB(false);
        let expandedStoreB = LocalBehaviour.createSessionLocal(
            frp, version, key, defaultExpanded);

        return frp.liftBI(
            function (store, internal) {
                if (internal) {
                    return {internal: true, expanded: store};
                }
                return {expanded: store};
            }, function (val) {
                expandedInternalB.set(!!val.internal);
                expandedStoreB.set(val.expanded);

            }, expandedStoreB, expandedInternalB);

    };

    static defaultLabelRenderer<Type>(scope: WidgetScope, path: string[], treeB: Behaviour<Tree<Type>>): Element {

        let valueB = getValueB(treeB, path);
        let el = createDom(TagName.SPAN, {});
        let helper = new WidgetHelper(scope, el, null, () => {
            removeChildren(el);
            enable(el, "recoil-error", valueB.metaGet().errors().length > 0)
            if (valueB.good()) {
                let value = valueB.get();
                el.appendChild(createTextNode(value == null ? "null" : value.toString()))
            }
            else {
                for (let err of valueB.metaGet().errors()) {
                    el.appendChild(createTextNode(err.toString()))
                }

            }
        });

        helper.attach(valueB);

        return el ;
    }

    static defaultIconRenderer(_scope: WidgetScope, path: string[], value: any): Element {
        return createDom(TagName.SPAN, {}, "someIcon");
    }

    static defaultExpandRenderer<Type>(_scope: WidgetScope, _path: string[], _treeB:Behaviour<Tree<Type>>, expandState: ExpandState): Element {
        switch (expandState) {
            case ExpandState.leaf:
                return createDom(TagName.I, "fa-regular fa-file");
            case ExpandState.collapsed:
                return createDom(TagName.I, "fa-regular fa-folder-closed");
            case ExpandState.expanded:
                return createDom(TagName.I, "fa-regular fa-folder-open");

        }
    }

    static defaultAfterLabelRenderer(scope: WidgetScope, path: string[], value: any): Element {
        return createDom(TagName.SPAN, {}, "after");
    }

    toggle(path: string[]) {
        if (!this.valueB_ || !this.expandedB_ || !this.configB_) {
            return;
        }
        this.scope_.getFrp().accessTrans(() => {
            let value = this.valueB_!.get();
            let expandInfo = this.expandedB_!.get()
            let expand = !TreeView.expandContains(expandInfo, path);
            if (value.hasChildren(path)) {
                return;
            }
            const config = this.configB_!.get();
            this.expandedB_?.set(TreeView.expandPath(value, expandInfo, path, expand, config.showRoot, config.collapseChildren));
        }, this.valueB_, this.configB_, this.expandedB_)
    }

    private static buildFullyExpanded<Type>(tree: Tree<Type>): { expand: boolean, children: ExpandInfoExpanded } {
        let res = {expand: true, children: new ExpandInfoExpanded()};
        for (let child of tree.children()) {
            res.children[child.key()] = TreeView.buildFullyExpanded(child);
        }
        return res;
    }

    public static expandPath<Type>(
        tree: Tree<Type>, curState: ExpandInfoExpanded | boolean, path: string[],
        doExpand: boolean, showRoot:boolean = false, collapseChildren: boolean = false) {

        let state: ExpandInfoExpanded;

        if (curState === true) {
            state = new ExpandInfoExpanded();
            state[tree.key()] = TreeView.buildFullyExpanded(tree);
        } else if (curState === false) {
            state = new ExpandInfoExpanded();
            // if showRoot is false the root is always expanded
            state[tree.key()] = { expand: true, children: new ExpandInfoExpanded() };
        } else {
            state = curState;
        }

        if (doExpand) {
            let cur = {expand: true, children: new ExpandInfoExpanded(state)};
            state = cur.children;
            for (let item of path) {
                let child = cur.children[item];
                let newVal = {expand: true, children: new ExpandInfoExpanded(child?.children)};
                cur.children[item] = newVal;
                cur = newVal;
            }
        } else {
            // todo stop root from collapsing  if show root is false
            let cur = {expand: true, children: new ExpandInfoExpanded(state)};
            state = cur.children;
            let seen = [];
            seen.push(cur);
            for (let item of path) {
                let child = cur.children[item];
                let newVal = {expand: cur.expand, children: new ExpandInfoExpanded(child?.children)};
                cur.children[item] = newVal;
                cur = newVal;
                seen.push(cur);
            }
            seen[seen.length - 1].expand = false;

            if (collapseChildren) {
                let children = seen[seen.length - 1].children;
                for (let child in children) {
                    delete children[child];
                }
            }
            else {
                for (let i = seen.length - 1; i >= 0; i--) {
                    let item = seen[i];
                    if (item.expand || TreeView.hasExpandedChildren(cur.children)) {
                        break;
                    }
                    if (i > 1) {
                        let children = seen[i - 1].children;
                        delete children[path[i - 1]];
                    }
                }
            }

        }
        return state;
    }

    public static expandContains(expanded: ExpandInfoExpanded | boolean, path: string[]) {
        if (expanded === true || expanded === false) {
            return expanded;
        }
        let cur = {expand: true, children: expanded};
        for (let i = 0; i < path.length && cur; i++) {
            if (!cur.expand) {
                return false;
            }
            cur = cur.children[path[i]];
        }
        return cur ? cur.expand : false;
    }

    private static hasExpandedChildren(children: ExpandInfoExpanded) {
        for (let k in children) {
            if (children[k].expand) {
                return true;
            }
            if (TreeView.hasExpandedChildren(children[k].children)) {
                return true;
            }
        }
        return false;
    }

    isExpanded(path: string[]) {
        return this.scope_.getFrp().accessTrans(() => {
            let expanded = this.expandedB_!.get();
            return TreeView.expandContains(expanded, path);
        }, this.expandedB_!)
    }

    expandPath(path: string[], expand: boolean) {
        this.scope_.getFrp().accessTrans(() => {
            let expandedInfo = this.expandedB_!.get();
            const config = this.configB_!.get()
            this.expandedB_?.set(TreeView.expandPath(this.valueB_!.get(), expandedInfo, path, expand,config.showRoot, config.collapseChildren));
        }, this.expandedB_!, this.valueB_!, this.configB_!)
    }
}

export class TreeNode<Type> {
    private readonly key_: string;
    private readonly label_: HTMLElement;
    private readonly row_: HTMLDivElement;
    private readonly spacers_: HTMLTableCellElement[];
    private readonly lines_: HTMLDivElement;
    private readonly element_: HTMLDivElement;
    private readonly icon_: HTMLSpanElement;
    private readonly expand_: HTMLSpanElement;
    private readonly afterLabel_: HTMLSpanElement;

    private parent_: TreeNode<Type> | null = null;
    private children_: TreeNode<Type>[] = [];
    private readonly config_: ConfigInfo<Type>;
    private readonly scope_: WidgetScope;
    private readonly tree_: TreeView<Type>
    private readonly treeB_: Behaviour<Tree<Type>>;
    private path_: [string, ...string[]];
    private expandState_: ExpandState | undefined;


    constructor(scope: WidgetScope, treeB:Behaviour<Tree<Type>>, tree: TreeView<Type>, path: [string, ...string[]] | [...string[], string], value: Type, config: ConfigInfo<Type>) {
        this.scope_ = scope;
        this.key_ = path[path.length - 1];
        this.path_ = path as [string, ...string[]];
        this.treeB_ = treeB;
        this.tree_ = tree;
        this.icon_ = createDom(TagName.SPAN, {class: 'recoil-tree-icon'});
        let pathAdj = config.showRoot? -1: -2;
        this.spacers_ = Array(Math.max(0,path.length + pathAdj)).fill(null).map(_ => createDom(TagName.TD, {
            class: 'recoil-tree-spacer',
            style: {width: config.indentWidth + 'px'}
        }));
        if (config.expandRenderer) {
            this.expand_ = createDom(TagName.SPAN, {
                class: 'recoil-tree-expand',
                tabIndex: 0
            });
        }
        else {
            this.expand_ = createDom(TagName.SPAN, {
                class: 'recoil-tree-expand',
            });

        }
        this.lines_ = createDom(TagName.TD, {class: 'recoil-tree-line'}, this.expand_);
        enable(this.lines_, "recoil-tree-show-expand", !!config.expandRenderer)
        this.label_ = createDom(TagName.SPAN, {class: 'recoil-tree-label'}, config.renderer(scope, path.slice(1), treeB));
        this.afterLabel_ = createDom(TagName.SPAN, {class: 'recoil-tree-after-label'});
        this.row_ = createDom(TagName.TD, {
            class: 'recoil-tree-row',
            colspan: "100%",
        }, this.icon_, this.label_, this.afterLabel_);
        this.element_ = createDom(TagName.TR, {class: 'recoil-tree-element'}, ...[...this.spacers_, this.lines_, this.row_]);
        this.lines_.style.width = (config.indentWidth) + 'px';
        this.config_ = config;

        EventHelper.listen(config.expandRenderer ? this.expand_ : this.row_, EventType.KEYDOWN, (e: KeyboardEvent) => {
            if (this.expandState_ != ExpandState.leaf) {
                if (e.key == " ") {
                    this.tree_.toggle(path);
                    e.preventDefault();
                }
                else if (e.ctrlKey) {
                    if (e.key === "ArrowRight") {
                        if (!this.getExpanded()) {
                            this.tree_.toggle(path);
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } else if (e.key === "ArrowLeft") {
                        if (this.getExpanded()) {
                            this.tree_.toggle(path);
                            e.preventDefault();
                            e.stopPropagation();
                        }

                    }
                }
            }
        });
        EventHelper.listen(this.row_, EventType.CLICK, (e: MouseEvent) => this.onClick_(e, false));
        EventHelper.listen(this.expand_, EventType.CLICK, (e: MouseEvent) => this.onClick_(e, true));

    }

    getElement() {
        return this.element_
    }
    addChild(node: TreeNode<Type>) {
        node.parent_ = this;
        this.children_.push(node);
    }

    hasChildren() {
        return this.children_.length > 0;
    }

    getExpanded(): boolean {
        return this.tree_.isExpanded(this.path());
    }

    getChildren(): TreeNode<Type>[] {
        return this.children_;
    }

    getParent(): TreeNode<Type> | null {
        return this.parent_;
    }

    /**
     * @return {string}
     */
    key(): string {
        return this.key_;
    }

    /**
     * @return {!Array<string>}
     */
    path(): string[] {
        return this.path_;
    }

    setContent(content: Element) {
        removeChildren(this.label_);
        this.label_.appendChild(content);
    }

    /**
     * Selects the node.
     */
    select() {
        //recoil.ui.widgets.TreeNode.superClass_.select.call(this);
    }

    /**
     * Handles a key down event.
     */
    private onKeyDown(e: KeyboardEvent) {
        /* todo  let handled = recoil.ui.widgets.TreeNode.superClass_.onKeyDown.call(this, e);
          if (handled && this.getTree().getSelectedItem()) {
              let selected = this.getTree().getSelectedItem();
              if (selected) {
                  let el = selected.getRowElement();
                  if (el) {
                      TreeView.scrollIfNeeded(el);
                  }
              }
          }
          return handled;*/
    }

    private onClick_(e: MouseEvent, expandClick:boolean) {
        let el = e.target;
        // expand icon

        if (!(el instanceof HTMLElement)) {
            return;
        }
        if (this.config_.clickCallback && this.config_.clickCallback(e)) {
            return;
        }
        if (e.altKey || e.ctrlKey || e.shiftKey) {
            return;
        }
        if (this.config_.isUserCollapsible) {
            let clickExpands = expandClick || (this.config_.labelClickExpand && (this.config_.oneClickExpand || e.detail == 2));

            if (clickExpands) {
                if (e.button !== 0) {
                    return;
                }
                this.tree_.toggle(this.path());

                e.stopPropagation();
                e.preventDefault();
            }
        }
    }

    getRoot() {
        let cur = this.parent_;
        while (cur && cur.parent_) {
            cur = cur.parent_;
        }
        return cur;
    }

    /**
     * Creates HTML for the node.
     * @return {!Element}
     * @protected
     */
    updateDom(parentChildren: boolean[], isLeaf: boolean) {

        let config = this.config_;
        let tree = this.getRoot();
        let hideLines = !config.showLines ||
            tree == this.getParent() && !config.showRoot;
        let childClass =
            hideLines ? "recoil-tree-children-no-lines" : "recoil-tree-children-lines";

        enable(this.lines_, "recoil-tree-expanded", this.children_.length > 0);
        enable(this.lines_, "recoil-tree-leaf", isLeaf);

        let expandState = isLeaf ? ExpandState.leaf : (this.children_.length > 0 ? ExpandState.expanded : ExpandState.collapsed);
        if (this.expandState_ != expandState) {
            removeChildren(this.expand_);
            if (this.config_.expandRenderer) {
                this.expand_.appendChild(this.config_.expandRenderer(this.scope_, this.path().slice(1), this.treeB_, expandState));
            }
            this.expandState_ = expandState;
        }
        const rootAdj = config.showRoot ? 0 : 1;
        for (let i = rootAdj; i  - rootAdj < this.spacers_.length && i < parentChildren.length; i++) {
            let spacer = this.spacers_[i - rootAdj];

            enable(spacer, "recoil-tree-spacer-last-sibling", parentChildren[i]);
            enable(spacer, "recoil-tree-spacer-last-spacer", i + 1 - rootAdj == this.spacers_.length);
        }
        /*
        let nonEmptyAndExpanded = this.getExpanded() && this.hasChildren();
        if (this.children_.length > 0) {
            if (!this.childrenElement_) {
                this.childrenElement_ = this.domHelper_.createDom(TagName.DIV, {class: "recoil-tree-children"});
                this.element_.appendChild(this.childrenElement_)
            }
            removeChildren(this.childrenElement_);

            let content:Element[] = [];
            if (nonEmptyAndExpanded) {
                // children
                for (let child of this.getChildren()) {
                    content.push(child.element_);
                }
            }

            enable(this.childrenElement_, "recoil-tree-children-no-lines", hideLines);
            enable(this.childrenElement_, "recoil-tree-children-lines", hideLines);
            enable(this.childrenElement_, "recoil-tree-line-style", true);

            for (let child of content) {
                this.childrenElement_.appendChild(child);
            }

        } else if (this.childrenElement_) {
            removeNode(this.childrenElement_);
            this.childrenElement_ = null;
        }
        */
    }

    updateExpandIcon() {

    }

    /**
     * Sets the node to be expanded.
     * @param {boolean} expanded Whether to expand or close the node.
     * @suppress {visibility}
     */
    setExpanded(expanded: ExpandInfoExpanded | boolean) {
        let isStateChange = expanded != this.getExpanded();
        if (isStateChange) {
            // Only fire events if the expanded state has actually changed.
            /*            let prevented = !this.dispatchEvent(
                            expanded ? goog.ui.tree.BaseNode.EventType.BEFORE_EXPAND :
                                goog.ui.tree.BaseNode.EventType.BEFORE_COLLAPSE);
                        if (prevented) return;*/
        }
        /*
        this.setExpandedInternal(expanded);
        let tree = this.getTree();
        let expandOverride = tree.userToggle && this.getConfig().expandOverride;
        let el = this.getElement();

        if (this.hasChildren()) {
            if (!expanded && tree && this.contains(tree.getSelectedItem())) {
                this.select();
            }

            if (el) {
                if (this.childrenElement_) {

                    if (!expandOverride) {
                        setElementShown(this.childrenElement_, expanded);
                    }
                    // Make sure we have the HTML for the children here.
                    if (expanded && this.isInDocument() && !ce.hasChildNodes()) {
                        let children = [];
                        this.domHelper_.removeChildren(ce);
                        for (let child of this.children_) {
                            let childEl = child.toDom();
                            children.push(childEl);
                            ce.appendChild(childEl);
                        }
                    }
                    if (expandOverride) {
                        expandOverride(this.childrenElement_, expanded);
                    }
                }
                this.updateExpandIcon();
            }
        } else {
            if (this.childrenElement_) {
                setElementShown(this.childrenElement_, false);
            }
        }
        if (el) {
            this.updateIcon_();
            // todo goog.a11y.aria.setState(el, 'expanded', expanded);
        }
*/
        if (isStateChange) {
            // todo this.dispatchEvent(
            //expanded ? goog.ui.tree.BaseNode.EventType.EXPAND :
            //   goog.ui.tree.BaseNode.EventType.COLLAPSE);
        }
    }

    setExpandedAll(expanded: boolean) {
        this.setExpanded(expanded);
        for (let child of this.children_) {
            child.setExpandedAll(expanded);
        }
    }

    setChildren(newChildren: TreeNode<Type>[]) {
        this.children_ = newChildren;
    }

    find(val: Tree<Type> | undefined) {
        if (!val) {
            return null;
        }
        for (let child of this.children_) {
            if (isEqual(child.key_, val.key())) {
                return child;
            }
        }
        return null;
    }

    removeAll() {
        removeNode(this.getElement());
        for (let child of this.children_) {
            child.removeAll();
        }
    }
}


