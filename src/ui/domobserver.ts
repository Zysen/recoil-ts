import {Behaviour} from "../frp/frp.ts";
import {contains} from "./dom/dom.ts";

type CallbackFn = (exists:boolean) => void;
type EntryType = {callbacks: CallbackFn[], state: boolean};
/**
 * this watches for insertions and deletions from nodes from the dom
 * it is careful not to keep references to items not in the
 */
export class DomObserver {
    // has to be a weak map otherwize we leak because we never unobserver elements
    private readonly watchedNodes: WeakMap<EventTarget, EntryType> = new WeakMap();
    private observer: MutationObserver;
    private transFunc: (f:() => void) => void;

    private constructor() {
        this.observer = new MutationObserver(this.observeFunc.bind(this));
        this.observer.observe(document, {childList: true, subtree: true});
        this.transFunc =(f)=> {
            f();
        };
        if (DomObserver.instance) {
            console.warn('multiple do observers');
        }
    }


    private updateAll(seen: WeakMap<Node, { exists:boolean}>, node:Node, exists:boolean) {
        if (seen.get(node)) {
            return;
        }

        let entry = this.watchedNodes.get(node);

        if (entry && entry.state !== exists) {
            entry.state = exists;
            entry.callbacks.forEach(function (cb) {
                cb(exists);
            });
        }
        seen.set(node, {exists: exists});
        let children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
            this.updateAll(seen, children[i], exists);
        }
    }

    /**
     * creates a function that will be called by mutation observer to process the mutations
     *
     */
    private observeFunc(mutations: MutationRecord[]): void {

        let seen = new WeakMap(); // not really used as a weak map more as a lookup by node
        this.transFunc(() => {
            for (let mutation of mutations) {
                let node;
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    let node:Node = mutation.addedNodes[i];
                    this.updateAll(seen, node, DomObserver.exists(node));
                }
                for (let i = 0; i < mutation.removedNodes.length; i++) {
                    node = mutation.removedNodes[i];
                    this.updateAll(seen, node, DomObserver.exists(node));
                }
            }
        });

    }

    /**
     * sets a function that will be used to group callbacks into 1
     * transaction this is for efficiency
     */
    setTransactionFunc(func: (func: () => void) => void): void {
        this.transFunc = func;
    }
    
    /**
     * listens to node and fires callback when its visibility has changed if the node is removed from the DOM it will no
     * longer listen, also the node must be in the DOM to observe
     */
    listen(node:Element|Text, callback:(exists:boolean) => void) {
        let exists = DomObserver.exists(node);
        let entryOrig = this.watchedNodes.get(node);
        let entry = entryOrig || ({callbacks: [], state: exists} as EntryType);
        
        entry.callbacks.push(callback);
        this.transFunc(()=>  {
            if (entry.state === exists) {
                callback(exists);
            } else {
                entry.state = exists;
                for (let cb of entry.callbacks) {
                    cb(exists);
                }
            }
            if (!entryOrig) {
                this.watchedNodes.set(node, entry);
            }
        });
    }
    /**
     * gets the behaviours attached to the dom node
     * @param node
     * @param map a map of behaviour id to behaviours to add to
     *                          for behaviours associated with this node
     * @return returns either opt_map or a new map if opt_map is not provided
     */
    getBehaviours(node:EventTarget, map: Set<Behaviour<any>> = new Set) {
        let entry = this.watchedNodes.get(node);

        if (entry) {
            for (let cb of entry.callbacks) {
                if ((cb as any).behaviours) {
                    for (let b of (cb as any).behaviours()) {
                        map.add(b);
                    }
                }
            }
        }
        return map;
    };

    /**
     * stops listening to the node, will not call the callback function
     *
     * @param node
     * @param callback
     * @throws
     */
    unlisten(node:Node, callback: (exists:boolean)=> void) {
        let entry = this.watchedNodes.get(node) || {callbacks: []};
        for (let i = entry.callbacks.length - 1; i >= 0; i--) {
            if (entry.callbacks[i] === callback) {
                entry.callbacks.splice(i, 1);
                break;
            }
        }
        if (entry.callbacks.length === 0) {
            this.watchedNodes.delete(node);
        }
    };


    /**
     * checks to see if a node has been added to the root dom element yet
     *
     */
    static exists(node:Node): boolean {
        return contains(document, node);
    };

    static readonly instance:DomObserver = new DomObserver();

}
