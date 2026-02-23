export class Tree<T> {
    private readonly value_: T;
    private readonly key_: string;
    private readonly children_: Tree<T>[];
    private readonly keyMap_: Map<string, { idx: number; node: Tree<T> }>;

    constructor(key: string, value: T, children: Tree<T>[] = []) {
        this.key_ = key;
        this.value_ = value;
        this.children_ = [...children]; // clone to keep immutability

        this.keyMap_ = new Map();
        this.children_.forEach((child, idx) => {
            this.keyMap_.set(child.key_,{ idx, node: child });
        });
    }

    /** Return the children of this node. */
    children(): Tree<T>[] {
        return this.children_;
    }

    getNode(path:string[]) : Tree<T>|null {
        let cur: Tree<T> = this;

        for (const key of path) {
            const entry = cur.keyMap_.get(key);
            if (!entry) {
                return null;
            }
            cur = entry.node;
        }
        return cur || null
    }
    /** Return the value at the given path, or null if not found. */
    getValue(path: string[]): T | null {
        let cur= this.getNode(path);
        if (cur) {
            return cur.value_
        }
        return null;
    }

    /** Return a new tree with the given path set to val. */
    setValue(path: string[], val: T): Tree<T> {
        let cur: Tree<T> = this;
        const seen: { node: Tree<T>; idx: number }[] = [];

        for (const key of path) {
            const entry = cur.keyMap_.get(key);
            if (!entry) {
                return this; // path not found
            }
            seen.push({ node: cur, idx: entry.idx });
            cur = entry.node;
        }

        let res = new Tree(cur.key_, val, cur.children_);

        // rebuild ancestors
        for (let i = seen.length - 1; i >= 0; i--) {
            const oldNode = seen[i];
            const newChildren = [...oldNode.node.children_];
            newChildren[oldNode.idx] = res;
            res = new Tree(oldNode.node.key_, oldNode.node.value_, newChildren);
        }

        return res;
    }

    /** Return the value of this node. */
    value(): T {
        return this.value_;
    }

    /** Return the key of this node. */
    key(): string {
        return this.key_;
    }

    /** Insert a child at the given position. */
    insertChildAt(child: Tree<T>, position?: number): Tree<T> {
        const newChildren = [...this.children_];
        if (position === undefined) {
            newChildren.push(child);
        } else {
            // negative index means from the end
            const pos = position < 0 ? newChildren.length + position : position;
            newChildren.splice(pos, 0, child);
        }
        return new Tree(this.key_, this.value_, newChildren);
    }

    /** Remove the first occurrence of a child. */
    removeChild(child: Tree<T>): Tree<T> {
        const newChildren = this.children_.filter(c => c !== child);
        return new Tree(this.key_, this.value_, newChildren);
    }

    /** Remove a child at a specific position. */
    removeChildAt(position: number): Tree<T> {
        const newChildren = [...this.children_];
        newChildren.splice(position, 1);
        return new Tree(this.key_, this.value_, newChildren);
    }

    hasChildren(path: string[]):boolean {
        let n = this.getNode(path);
        if (n && n.children().length > 0) {
            return true;
        }
        return false
    }
}