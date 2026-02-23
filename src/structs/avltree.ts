
// Copyright 2007 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Datastructure: AvlTree.
 *
 *
 * This file provides the implementation of an AVL-Tree datastructure. The tree
 * maintains a set of unique values in a sorted order. The values can be
 * accessed efficiently in their sorted order since the tree enforces an O(logn)
 * maximum height. See http://en.wikipedia.org/wiki/Avl_tree for more detail.
 *
 * The big-O notation for all operations are below:
 * <pre>
 *   Method                 big-O
 * ----------------------------------------------------------------------------
 * - add                    O(logn)
 * - remove                 O(logn)
 * - clear                  O(1)
 * - contains               O(logn)
 * - indexOf                O(logn)
 * - getCount               O(1)
 * - getMinimum             O(1), or O(logn) when optional root is specified
 * - getMaximum             O(1), or O(logn) when optional root is specified
 * - getHeight              O(1)
 * - getValues              O(n)
 * - inOrderTraverse        O(logn + k), where k is number of traversed nodes
 * - reverseOrderTraverse   O(logn + k), where k is number of traversed nodes
 * </pre>
 */

import {clone,compare, registerCompare} from "../util/object.ts";



/**
 * String comparison function used to compare values in the tree. This function
 * is used by default if no comparator is specified in the tree's constructor.
 *
 * @param {T} a The first value.
 * @param {T} b The second value.
 * @return {number} -1 if a < b, 1 if a > b, 0 if a = b.
 * @template T
 * @const
 */
const DEFAULT_COMPARATOR = function(a:any, b:any):number {
    if (String(a) < String(b)) {
        return -1;
    } else if (String(a) > String(b)) {
        return 1;
    }
    return 0;
};


class Node<Type> {
    value: Type;
    parent: Node<Type>|null;
    left: Node<Type>|null;
    right: Node<Type>|null;
    count:number;
    height:number;
    
    /**
     * Constructs an AVL-Tree node with the specified value. If no parent is
     * specified, the node's parent is assumed to be null. The node's height
     * defaults to 1 and its children default to null.
     *
     */
    constructor(value:Type, opt_parent:Node<Type>|null = null) {
        this.value = value;
        this.parent = opt_parent;
        this.count = 1;
        this.left = null;
        this.right = null;
        this.height = 1;
    }
    
    isRightChild():boolean {
        return !!this.parent && this.parent.right == this;
    }
    
    isLeftChild():boolean {
        return !!this.parent && this.parent.left == this;
    }
    
    
    /**
     * Helper method to fix the height of this node (e.g. after children have
     * changed).
     */
    fixHeight() {
        this.height = Math.max(
            this.left ? this.left.height : 0,
            this.right ? this.right.height : 0) +
            1;
    }
    
};

class AvlTreeIterator<Type, KeyType = Type> implements Iterable<Type>, Iterator<Type, any, any> {
    node:Node<Type>|null;
    endNode:Node<Type>|null;
    prev:Node<Type>|null;
    seenEnd:boolean;

    constructor(startNode :Node<Type>|null, endNode: Node<Type>|null) {
        this.node = startNode;
        this.prev = startNode && startNode.left ? startNode.left : startNode;
        this.endNode = endNode;
        this.seenEnd = false;
    }
    next(): IteratorResult<Type, any> {
        while (this.node != null && !this.seenEnd) {
            this.seenEnd = this.seenEnd || this.endNode === this.node;
            if (this.node.left != null && this.node.left != this.prev && this.node.right != this.prev) {
                this.node = this.node.left;
            } else {
                let ret = null;
                if (this.node.right != this.prev) {
                    ret = {
                        done: false,
                        value: this.node.value
                    }
                }
                let temp = this.node;
                this.node =
                    this.node.right != null && this.node.right != this.prev ? this.node.right : this.node.parent;
                this.prev = temp;
                if (ret) {
                    return ret;
                }
            }
        }
        return {
            done: true
        } as IteratorResult<Type>
    }

    [Symbol.iterator](): Iterator<Type, any, any> {
        return this;
    }
}

/**
 * Constructs an AVL-Tree, which uses the specified comparator to order its
 * values. The values can be accessed efficiently in their sorted order since
 * the tree enforces a O(logn) maximum height.
 *
 */
export class AvlTree<Type, KeyType extends Partial<Type> | Type = Type> implements Iterable<Type> {
    private readonly comparator_:(x:KeyType,y:KeyType) => number;
    private root_: Node<Type>|null;
    private minNode_: Node<Type>|null = null;
    private maxNode_: Node<Type>|null = null;
    
    
    constructor(opt_comparator?:(x: KeyType, y: KeyType) => number, initialValues?: Iterable<Type>) {
        this.comparator_ = opt_comparator || DEFAULT_COMPARATOR;
        this.root_ = null;
        if (initialValues !== undefined) {
            for (let v of initialValues) {
                this.add(v);
            }
        }
    }

    comparator():(x:any, y:any) => number {
        return this.comparator_;
    }

    private findLastNode(value?:Type):Node<Type>|null {
        if (value === undefined) {
            return null;
        }
        let endNode:Node<Type>|null = null;
        this.traverse_(node => {
            let retNode = null;
            let comparison = this.comparator_(node.value as KeyType, value as KeyType);
            if (comparison > 0) {
                retNode = node.left;
            } else if (comparison < 0) {
                retNode = node.right;
                endNode = node;
            } else {
                endNode = node;
            }
            return retNode;  // If null, we'll stop traversing the tree
        });
        return endNode;
    }
    from(startValue?: Type) : Iterable<Type> {
        return this.range(startValue);
    }
    // returns an iterator
    range(startValue?: Type, endValue?: Type) : Iterable<Type> {
        let startNode = null;
        if (this.root_ !== null && startValue !== undefined) {
            this.traverse_(node => {
                let retNode = null;
                let comparison = this.comparator_(node.value as KeyType, startValue as KeyType);
                if (comparison > 0) {
                    retNode = node.left;
                    startNode = node;
                } else if (comparison < 0) {
                    retNode = node.right;
                } else {
                    startNode = node;
                }
                return retNode;  // If null, we'll stop traversing the tree
            });
        } else if (this.root_ !== null) {
            startNode = this.getMinNode_();
        }
        return  new AvlTreeIterator<Type>(startNode, this.findLastNode(endValue));
    }

    [Symbol.iterator](): Iterator<Type, any, any> {
        return new AvlTreeIterator<Type>(this.getMinNode_(), null);
    }


    findFirst(value: KeyType|Type) : Type|null {
        let found:Type|null = null;
         this.inOrderTraverse((travNode)  => {
            if (this.comparator_(travNode as KeyType, value as KeyType ) === 0) {
                found = travNode as Type;
                
            }
            return true;
        }, value);
        return found;
    }
    
    private static height<Type>(node:Node<Type>|null):number {
        return node ? node.height : 0;
    }
    
    
    balanceFactor(node:Node<Type>|null):number {
        if (node) {
            let lh = node.left ? node.left.height : 0;
            let rh = node.right ? node.right.height : 0;
            return lh - rh;
        }
        return 0;
    }

    private balance_(node:Node<Type>):Node<Type> {
        let bf = this.balanceFactor(node);
        if (bf > 1) {
            if (this.balanceFactor(node.left) < 0) {
                this.leftRotate_(node.left  as Node<Type> );
            }
            return this.rightRotate_(node);
        } else if (bf < -1) {
            if (this.balanceFactor(node.right) > 0) {
                this.rightRotate_(node.right as Node<Type>);
            }
            return this.leftRotate_(node);
        }
        return node;
    }
    


    /**
     * Recursively find the correct place to add the given value to the tree.
     *
     * @param {T} value
     * @param {!Node<T>} currentNode
     * @return {boolean}
     */
    private addInternal_(value:Type, currentNode:Node<Type>): boolean {
        let comparison = this.comparator_(value as KeyType, currentNode.value as KeyType);
        let added = false;
        
        if (comparison > 0) {
            if (currentNode.right) {
                added = this.addInternal_(value, currentNode.right);
            } else {
                currentNode.right = new Node(value, currentNode);
                added = true;
                
                if (currentNode == this.maxNode_) {
                    this.maxNode_ = currentNode.right;
                }
            }
        } else if (comparison < 0) {
            if (currentNode.left) {
                added = this.addInternal_(value, currentNode.left);
            } else {
                currentNode.left = new Node(value, currentNode);
                added = true;
                
                if (currentNode == this.minNode_) {
                    this.minNode_ = currentNode.left;
                }
            }
        }
        
        if (added) {
            currentNode.count++;
            currentNode.height =
                Math.max(AvlTree.height(currentNode.left), AvlTree.height(currentNode.right)) + 1;
            
            this.balance_(currentNode);
        }
        
        return added;
    }
    

    /**
     * Inserts a node into the tree with the specified value if the tree does
     * not already contain a node with the specified value. If the value is
     * inserted, the tree is balanced to enforce the AVL-Tree height property.
     *
     */
    add(value:Type):boolean {
        // If the tree is empty, create a root node with the specified value
        if (!this.root_) {
            this.root_ = new Node(value);
            this.minNode_ = this.root_;
            this.maxNode_ = this.root_;
            return true;
        }
        
        return this.addInternal_(value, this.root_);
    }
    

    private static count<Type>(node: Node<Type> | null):number {
        return node ? node.count : 0;
    }
    
    
    /**
     * @return {{value: (T|null), root: ?Node<T>}} The value that was removed or
     *     null if nothing was removed in addition to the root of the modified
     *     subtree.
     */
    private removeInternal_(value:KeyType|Type, currentNode:Node<Type>| null): {value:Type|null, root:Node<Type> | null} {
        if (!currentNode) {
            return {value: null, root: null};
        }
        
        let comparison = this.comparator_(currentNode.value as KeyType, value as KeyType);
        
        if (comparison > 0) {
            let removeResult = this.removeInternal_(value, currentNode.left);
            currentNode.left = removeResult.root;
            value = removeResult.value as KeyType;
        } else if (comparison < 0) {
            let removeResult = this.removeInternal_(value, currentNode.right);
            currentNode.right = removeResult.root;
            value = removeResult.value as KeyType;
        } else {
            value = currentNode.value as KeyType;
            if (!currentNode.left || !currentNode.right) {
                // Zero or one children.
                let replacement = currentNode.left ? currentNode.left : currentNode.right;
                
                if (!replacement) {
                    if (this.maxNode_ == currentNode) {
                        this.maxNode_ = currentNode.parent;
                    }
                    if (this.minNode_ == currentNode) {
                        this.minNode_ = currentNode.parent;
                    }
                    return {value: value as Type, root: null};
                }
                
                if (this.maxNode_ == currentNode) {
                    this.maxNode_ = replacement;
                }
                if (this.minNode_ == currentNode) {
                    this.minNode_ = replacement;
                }
                
                replacement.parent = currentNode.parent;
                currentNode = replacement;
            } else {
                value = currentNode.value;
                let nextInOrder = currentNode.right;
                // Two children. Note this cannot be the max or min value. Find the next
                // in order replacement (the left most child of the current node's right
                // child).
                this.traverse_(node => {
                    if (node.left) {
                        nextInOrder = node.left;
                        return nextInOrder;
                    }
                    return null;
                }, currentNode.right);
                currentNode.value = nextInOrder.value;
                let removeResult = this.removeInternal_(
                    /** @type {?} */ (nextInOrder.value as KeyType), currentNode.right);
                currentNode.right = removeResult.root;
            }
        }

        currentNode.count = AvlTree.count(currentNode.left) + AvlTree.count(currentNode.right) + 1;
        currentNode.height =
            Math.max(AvlTree.height(currentNode.left), AvlTree.height(currentNode.right)) + 1;
        return {root: this.balance_(currentNode), value: value as Type};
    }

    
    /**
     * Removes a node from the tree with the specified value if the tree contains a
     * node with this value. If a node is removed the tree is balanced to enforce
     * the AVL-Tree height property. The value of the removed node is returned.
     *
     * @param value Value to find and remove from the tree.
     * @return The value of the removed node or null if the value was not in
     *     the tree.
     * @override
     */
    remove(value:Type|KeyType):Type|null {
        let result = this.removeInternal_(value, this.root_);
        this.root_ = result.root;
        return result.value;
    }


    /**
     * Removes all nodes from the tree.
     */
    clear() {
        this.root_ = null;
        this.minNode_ = null;
        this.maxNode_ = null;
    }
    

    /**
     * Returns true if the tree contains a node with the specified value, false
     * otherwise.
     *
     * @param {T} value Value to find in the tree.
     * @return {boolean} Whether the tree contains a node with the specified value.
     * @override
     */
    contains(value:Type|KeyType):boolean {
        // Assume the value is not in the tree and set this value if it is found
        let isContained = false;
        
        // Depth traverse the tree and set isContained if we find the node
        this.traverse_((node) => {
            let retNode = null;
            let comparison = this.comparator_(node.value as KeyType, value as KeyType);
            if (comparison > 0) {
                retNode = node.left;
            } else if (comparison < 0) {
                retNode = node.right;
            } else {
                isContained = true;
            }
            return retNode;  // If null, we'll stop traversing the tree
        });
        
        // Return true if the value is contained in the tree, false otherwise
        return isContained;
    }
    
    
    /**
     * Returns the index (in an in-order traversal) of the node in the tree with
     * the specified value. For example, the minimum value in the tree will
     * return an index of 0 and the maximum will return an index of n - 1 (where
     * n is the number of nodes in the tree).  If the value is not found then -1
     * is returned.
     *
     * @param {T} value Value in the tree whose in-order index is returned.
     * @return {number} The in-order index of the given value in the
     *     tree or -1 if the value is not found.
     */
    indexOf(value:Type|KeyType):number {
        // Assume the value is not in the tree and set this value if it is found
        let retIndex = -1;
        let currIndex = 0;
        
        // Depth traverse the tree and set retIndex if we find the node
        this.traverse_(node => {
            let comparison = this.comparator_(node.value as KeyType, value as KeyType);
            if (comparison > 0) {
                // The value is less than this node, so recurse into the left subtree.
                return node.left;
            }

            if (node.left) {
                // The value is greater than all of the nodes in the left subtree.
                currIndex += node.left.count;
            }
            
            if (comparison < 0) {
                // The value is also greater than this node.
                currIndex++;
                // Recurse into the right subtree.
                return node.right;
            }
            // We found the node, so stop traversing the tree.
            retIndex = currIndex;
            return null;
        });
        
        // Return index if the value is contained in the tree, -1 otherwise
        return retIndex;
    }


    /**
     * Returns the number of values stored in the tree.
     *
     * @return {number} The number of values stored in the tree.
     * @override
     */
    getCount():number {
        return this.root_ ? this.root_.count : 0;
    }
    

    /**
     * Returns a k-th smallest value, based on the comparator, where 0 <= k <
     * this.getCount().
     * @param {number} k The number k.
     * @return {T} The k-th smallest value.
     */
    getKthValue(k:number):Type|null {
        if (k < 0 || k >= this.getCount()) {
            return null;
        }
        return this.getKthNode_(k).value;
    }

    
    /**
     * Returns the value u, such that u is contained in the tree and u < v, for all
     * values v in the tree where v != u.
     *
     * @return {T} The minimum value contained in the tree.
     */
    getMinimum():Type {
        let minNode = this.minNode_;this.getMinNode_()
        if (minNode == null) {
            throw new Error('AvlTree Empty');
        }
        return minNode.value;
    };


    /**
     * Returns the value u, such that u is contained in the tree and u > v, for all
     * values v in the tree where v != u.
     *
     * @return {T} The maximum value contained in the tree.
     */
    getMaximum():Type {
        let maxNode = this.maxNode_;this.getMaxNode_()
        if (maxNode == null) {
            throw new Error('AvlTree Empty');
        }
        return maxNode.value;
    };


    /**
     * Returns the height of the tree (the maximum depth). This height should
     * always be <= 1.4405*(Math.log(n+2)/Math.log(2))-1.3277, where n is the
     * number of nodes in the tree.
     *
     * @return {number} The height of the tree.
     */
    getHeight():number {
        return this.root_ ? this.root_.height : 0;
    };
    

    /**
     * Inserts the values stored in the tree into a new Array and returns the Array.
     *
     * @return {!Array<T>} An array containing all of the trees values in sorted
     *     order.
     */
    getValues():Type[] {
        let ret: Type[] = [];
        this.inOrderTraverse(function(value) { ret.push(value); });
        return ret;
    };

    
    /**
     * Performs an in-order traversal of the tree and calls `func` with each
     * traversed node, optionally starting from the smallest node with a value >= to
     * the specified start value. The traversal ends after traversing the tree's
     * maximum node or when `func` returns a value that evaluates to true.
     *
     * @param {Function} func Function to call on each traversed node.
     * @param {T=} opt_startValue If specified, traversal will begin on the node
     *     with the smallest value >= opt_startValue.
     */
    inOrderTraverse(func:(v:Type)=> any, opt_startValue?:KeyType|Type) {
        // If our tree is empty, return immediately
        if (!this.root_) {
            return;
        }
        
        // Depth traverse the tree to find node to begin in-order traversal from
        /** @type {undefined|!Node} */
        let startNode;
        if (opt_startValue !== undefined) {
            this.traverse_(node => {
                let retNode = null;
                let comparison = this.comparator_(node.value as KeyType, opt_startValue as KeyType);
                if (comparison > 0) {
                    retNode = node.left;
                    startNode = node;
                } else if (comparison < 0) {
                    retNode = node.right;
                } else {
                    startNode = node;
                }
                return retNode;  // If null, we'll stop traversing the tree
            });
            if (!startNode) {
                return;
            }
        } else {
            startNode = /** @type {!Node} */ (this.getMinNode_());
        }
        
        // Traverse the tree and call func on each traversed node's value
        let node = startNode as Node<Type>;
        let prev = node.left ? node.left : node;
        while (node != null) {
            if (node.left != null && node.left != prev && node.right != prev) {
                node = node.left;
            } else {
                if (node.right != prev) {
                    if (func(node.value)) {
                        return;
                    }
                }
                let temp = node;
                node =
                    (node.right != null && node.right != prev ? node.right : node.parent) as Node<Type>;
                prev = temp;
            }
        }
    }
    

    /**
     * Performs a reverse-order traversal of the tree and calls `func` with
     * each traversed node, optionally starting from the largest node with a value
     * <= to the specified start value. The traversal ends after traversing the
     * tree's minimum node or when func returns a value that evaluates to true.
     *
     * @param func Function to call on each traversed node.
     * @param {T=} opt_startValue If specified, traversal will begin on the node
     *     with the largest value <= opt_startValue.
     */
    reverseOrderTraverse(func: (v:Type) => any, opt_startValue?: Type) {
        // If our tree is empty, return immediately
        if (!this.root_) {
            return;
        }
        
        // Depth traverse the tree to find node to begin reverse-order traversal from
        let startNode;
        if (opt_startValue !== undefined) {
            this.traverse_((node) => {
                let retNode = null;
                let comparison = this.comparator_(node.value as KeyType, opt_startValue as KeyType);
                if (comparison > 0) {
                    retNode = node.left;
                } else if (comparison < 0) {
                    retNode = node.right;
                    startNode = node;
                } else {
                    startNode = node;
                }
                return retNode;  // If null, we'll stop traversing the tree
            });
            if (!startNode) {
                return;
            }
        } else {
            startNode = this.getMaxNode_() as Node<Type>;
        }
        
        // Traverse the tree and call func on each traversed node's value
        let node:Node<Type>|null = startNode, prev = startNode.right ? startNode.right : startNode;
        while (node != null) {
            if (node.right != null && node.right != prev && node.left != prev) {
                node = node.right;
            } else {
                if (node.left != prev) {
                    if (func(node.value)) {
                        return;
                    }
                }
                let temp = node;
                node = node.left != null && node.left != prev ? node.left : node.parent;
                prev = temp;
            }
        }
    }
    

    /**
     * Performs a traversal defined by the supplied `traversalFunc`. The first
     * call to `traversalFunc` is passed the root or the optionally specified
     * startNode. After that, calls `traversalFunc` with the node returned
     * by the previous call to `traversalFunc` until `traversalFunc`
     * returns null or the optionally specified endNode. The first call to
     * traversalFunc is passed the root or the optionally specified startNode.
     *
     * @param {function(
     *     this:AvlTree<T>,
     *     !Node<T>):?Node<T>} traversalFunc
     * Function used to traverse the tree.
     * @param {Node<T>=} opt_startNode The node at which the
     *     traversal begins.
     * @param {Node<T>=} opt_endNode The node at which the
     *     traversal ends.
     */
    private traverse_(
        traversalFunc : (arg: Node<Type>) => Node<Type>|null, opt_startNode? : Node<Type>, opt_endNode? : Node<Type>) {
        let node = opt_startNode ? opt_startNode : this.root_;
        let endNode = opt_endNode ? opt_endNode : null;
        while (node && node != endNode) {
            node = traversalFunc.call(this, node);
        }
    }
    

    /**
     * Performs a left tree rotation on the specified node.
     *
     * @param {!Node<T>} node Pivot node to rotate from.
     * @return {!Node<T>} New root of the sub tree.
     */
    private leftRotate_(node:Node<Type>):Node<Type> {
        // Re-assign parent-child references for the parent of the node being removed
        if (node.isLeftChild()) {
            (node.parent as Node<Type>).left = node.right;
            (node.right as Node<Type>).parent = node.parent;
        } else if (node.isRightChild()) {
            (node.parent as Node<Type>).right = node.right;
            (node.right as Node<Type>).parent = node.parent;
        } else {
            this.root_ = node.right as Node<Type>;
            this.root_.parent = null;
        }
        
        // Re-assign parent-child references for the child of the node being removed
        let temp = node.right as Node<Type>;
        node.right = (node.right as Node<Type>).left;
        if (node.right != null) node.right.parent = node;
        temp.left = node;
        node.parent = temp;
        
        // Update counts.
        temp.count = node.count;
        node.count -= (temp.right ? temp.right.count : 0) + 1;
        
        node.fixHeight();
        temp.fixHeight();
        
        return temp;
    }
    

    /**
     * Performs a right tree rotation on the specified node.
     *
     * @param {!Node<T>} node Pivot node to rotate from.
     * @return {!Node<T>} New root of the sub tree.
     */
    private rightRotate_(node:Node<Type>):Node<Type> {
        // Re-assign parent-child references for the parent of the node being removed
        if (node.isLeftChild()) {
            (node.parent as Node<Type>).left = node.left;
            (node.left as Node<Type>).parent = node.parent;
        } else if (node.isRightChild()) {
            (node.parent as Node<Type>).right = node.left;
            (node.left as Node<Type>).parent = node.parent;
        } else {
            this.root_ = node.left as Node<Type>;
            this.root_.parent = null;
        }
        
        // Re-assign parent-child references for the child of the node being removed
        let temp = node.left as Node<Type>;
        node.left = (node.left as Node<Type>).right;
        if (node.left != null) node.left.parent = node;
        temp.right = node;
        node.parent = temp;
        
        // Update counts.
        temp.count = node.count;
        node.count -= (temp.left ? temp.left.count : 0) + 1;
        
        node.fixHeight();
        temp.fixHeight();

        return temp;
    }


    /**
     * Returns the node in the tree that has k nodes before it in an in-order
     * traversal, optionally rooted at `opt_rootNode`.
     *
     * @param {number} k The number of nodes before the node to be returned in an
     *     in-order traversal, where 0 <= k < root.count.
     * @param {Node<T>=} opt_rootNode Optional root node.
     * @return {Node<T>} The node at the specified index.
     */
    private getKthNode_(k:number, opt_rootNode?:Node<Type>):Node<Type> {
        let root = opt_rootNode || (this.root_ as Node<Type>);
        let numNodesInLeftSubtree = root.left ? root.left.count : 0;

        if (k < numNodesInLeftSubtree) {
            return this.getKthNode_(k, root.left as Node<Type>);
        } else if (k == numNodesInLeftSubtree) {
            return root;
        } else {
            return this.getKthNode_(k - numNodesInLeftSubtree - 1, root.right as Node<Type>);
        }
    }


    /**
     * Returns the node with the smallest value in tree, optionally rooted at
     * `opt_rootNode`.
     *
     * @param {Node<T>=} opt_rootNode Optional root node.
     * @return {Node<T>} The node with the smallest value in
     *     the tree.
     */
    private getMinNode_(opt_rootNode?:Node<Type>) {
        if (!opt_rootNode) {
            return this.minNode_;
        }
        
        let minNode = opt_rootNode;
        this.traverse_(function(node) {
            let retNode = null;
            if (node.left) {
                minNode = node.left;
                retNode = node.left;
            }
            return retNode;  // If null, we'll stop traversing the tree
        }, opt_rootNode);
        
        return minNode;
    };


    /**
     * Returns the node with the largest value in tree, optionally rooted at
     * opt_rootNode.
     *
     * @param {Node<T>=} opt_rootNode Optional root node.
     * @return {Node<T>} The node with the largest value in
     *     the tree.
     */
    private getMaxNode_(opt_rootNode? : Node<Type>):Node<Type>|null {
        if (!opt_rootNode) {
            return this.maxNode_;
        }
        
        let maxNode = opt_rootNode;
        this.traverse_(function(node) {
            let retNode = null;
            if (node.right) {
                maxNode = node.right;
                retNode = node.right;
            }
            return retNode;  // If null, we'll stop traversing the tree
        }, opt_rootNode);
        
        return maxNode;
    }
    
    static fromList<Type>(list:[Type], opt_compareFn:(a:Type,b:Type) => number) {
        var res = new AvlTree(opt_compareFn || compare);
        list.forEach(function(v) {
            res.add(v);
        });
        
        return res;
    }
    
    toList():Type[] {
        return [...this];
    }

    /**
     * find a value in the map, if it is not present add it
     * @param val
     */
    safeFind(val:Type) : Type {
        let res = this.findFirst(val);
        if (res === null) {
            this.add(val);
            return val;
        }
        return res;
    }

    clone(opt_used : WeakMap<any,any> = new WeakMap()) : AvlTree<Type, KeyType> {
        let me = opt_used.get(this);
        if (me) {
            return me;
        }
        let result = new AvlTree<Type,KeyType>(this.comparator_);
        opt_used.set(this, result);
        this.inOrderTraverse(function(el) {
            result.add(clone(el, opt_used));
        });
        return result;

    }
}

registerCompare(AvlTree,
    (x: AvlTree<any>, y:AvlTree<any>,ignore: Set<string>, xPath : Set<Object>, yPath: Set<Object>):number => {
    let count = y.getCount();
    if (x.getCount() != count) {
        return x.getCount() - count;
    }

    let itX = x[Symbol.iterator]();
    let itY = y[Symbol.iterator]();

    let xItVal = itX.next();
    let yItVal = itY.next();

    while (!xItVal.done && !yItVal.done) {
        let res = compare(xItVal.value, yItVal.value, new Set(), xPath, yPath);
        if (res !== 0) {
            return res;
        }
        xItVal = itX.next();
        yItVal = itY.next();
    }
    return 0;
});

