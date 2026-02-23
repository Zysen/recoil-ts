import assert from 'assert/strict';
import test from 'node:test';
import {AvlTree} from "./avltree.ts";
import {compare, isEqual} from "../util/object.ts";

import * as array from"./array.ts";

test("insert with default comparator", t => {

  let tree = new AvlTree<string>();
  var values = ['bill', 'blake', 'elliot', 'jacob', 'john', 'myles', 'ted'];

  // Insert strings into tree out of order
  tree.add(values[4]);
  tree.add(values[3]);
  tree.add(values[0]);
  tree.add(values[6]);
  tree.add(values[5]);
  tree.add(values[1]);
  tree.add(values[2]);

  // Verify strings are stored in sorted order
  var i = 0;
  tree.inOrderTraverse(value => {
    assert.equal(value, values[i]);
    i += 1;
  });
  assert.equal(i, values.length);

  // Verify that no nodes are visited if the start value is larger than all
  // values
  tree.inOrderTraverse(function(value) { assert.fail(); }, 'zed');

  // Verify strings are stored in sorted order
  i = values.length;
  tree.reverseOrderTraverse(function(value) {
    i--;
    assert.equal(value,values[i]);
  });
  assert.equal(i, 0);

  // Verify that no nodes are visited if the start value is smaller than all
  // values
  tree.reverseOrderTraverse(function(value) { assert.fail(); }, 'aardvark');

});

test("compare", () => {
  assert.equal(isEqual(new AvlTree<string>(undefined, ["a","b"]),new AvlTree<string>(undefined, ["b","a"])), true);
  let t1 = new AvlTree<string>(undefined, ["a","b","f"]);
  let t2 = new AvlTree<string>(undefined, ["b","a","e"]);

  assert.equal(isEqual(t1,t2), false);
  let res = compare(t1,t2);
  assert.notEqual(res, 0);
  if (res < 0) {
    assert.equal(compare(t2,t1) > 0, true);
  }
  else {
    assert.equal(compare(t2,t1) < 0, true);
  }


})

test("Iterator test",() => {
  let tree = new AvlTree<string>();
  let data =["grab", "a", "chair", "with", "some", "other", "stuff"];
  let count = 0;
  for (let v of tree) {
    count++;
  }
  assert.equal(0, count);
  for(let v of data){
    tree.add(v);
  }

  tree.add("some");
  data.sort();
  assert.deepEqual([...tree], data);
  assert.deepEqual([...tree.from("b")], ["chair","grab", "other", "some", "stuff","with"]);
  assert.deepEqual([...tree.range("b", "s")], ["chair","grab", "other"]);
});


test("To List",() => {
  let tree = new AvlTree<string>(undefined, ["c", "b", "d"]);

  assert.deepEqual(tree.toList(), ["b","c","d"]);
});

test("SafeFind",() => {
  let tree = new AvlTree<string>(undefined, ["c", "b", "d"]);

  assert.equal(tree.safeFind("a"),"a")
  assert.deepEqual(tree.toList(), ["a", "b","c","d"]);
  assert.equal(tree.safeFind("b"),"b")
  assert.deepEqual(tree.toList(), ["a", "b","c","d"]);

});

/**
 * This test verifies that we can insert strings into and remove strings from
 * the AvlTree and have the only the non-removed values be stored and sorted
 * correctly by the default comparator.
 */
test("removes with default comparator",() => {
  var tree = new AvlTree<string>();
  var values = ['bill', 'blake', 'elliot', 'jacob', 'john', 'myles', 'ted'];

  // Insert strings into tree out of order
  tree.add('frodo');
  tree.add(values[4]);
  tree.add(values[3]);
  tree.add(values[0]);
  tree.add(values[6]);
  tree.add('samwise');
  tree.add(values[5]);
  tree.add(values[1]);
  tree.add(values[2]);
  tree.add('pippin');

  // Remove strings from tree
  assert.equal(tree.remove('samwise'), 'samwise');
  assert.equal(tree.remove('pippin'), 'pippin');
  assert.equal(tree.remove('frodo'), 'frodo');
  assert.equal(tree.remove('merry'), null);


  // Verify strings are stored in sorted order
  var i = 0;
  tree.inOrderTraverse(function(value) {
    assert.equal(values[i], value);
    i += 1;
  });
  assert.equal(i, values.length);
})


/**
 * This test verifies that we can insert values into and remove values from
 * the AvlTree and have them be stored and sorted correctly by a custom
 * comparator.
 */
test("Inserts And Removes With Custom Comparator", () => {
  let tree = new AvlTree<number>(function(a, b) { return a - b; });

  const NUM_TO_INSERT = 37;
  let valuesToRemove = [1, 0, 6, 7, 36];

  // Insert ints into tree out of order
  let values:number[] = [];
  for (var i = 0; i < NUM_TO_INSERT; i += 1) {
    tree.add(i);
    values.push(i);
  }

  for (var i = 0; i < valuesToRemove.length; i += 1) {
    assert.equal(tree.remove(valuesToRemove[i]), valuesToRemove[i]);
    array.remove(values, valuesToRemove[i]);
  }
  assert.equal(tree.remove(-1), null);
  assert.equal(tree.remove(37), null);

  // Verify strings are stored in sorted order
  var i = 0;
  tree.inOrderTraverse(function(value) {
    assert.equal(values[i], value);
    i += 1;
  });
  assert.equal(i, values.length);
});


/**
 * This test verifies that we can insert values into and remove values from
 * the AvlTree and have it maintain the AVL-Tree upperbound on its height.
 */
test("AvlTree Height", () => {
  let tree = new AvlTree<number>(function(a, b) { return a - b; });

  var NUM_TO_INSERT = 2000;
  var NUM_TO_REMOVE = 500;

  // Insert ints into tree out of order
  for (var i = 0; i < NUM_TO_INSERT; i += 1) {
    tree.add(i);
  }

  // Remove valuse
  for (var i = 0; i < NUM_TO_REMOVE; i += 1) {
    tree.remove(i);
  }

  assert.equal(
      tree.getHeight() <=
      1.4405 * (Math.log(NUM_TO_INSERT - NUM_TO_REMOVE + 2) / Math.log(2)) -
      1.3277, true);
});


/**
 * This test verifies that we can insert values into and remove values from
 * the AvlTree and have its contains method correctly determine the values it
 * is contains.
 */
test("AvlTree Contains", ()=> {
  var tree = new AvlTree<string>();
  var values = ['bill', 'blake', 'elliot', 'jacob', 'john', 'myles', 'ted'];

  // Insert strings into tree out of order
  tree.add('frodo');
  tree.add(values[4]);
  tree.add(values[3]);
  tree.add(values[0]);
  tree.add(values[6]);
  tree.add('samwise');
  tree.add(values[5]);
  tree.add(values[1]);
  tree.add(values[2]);
  tree.add('pippin');

  // Remove strings from tree
  assert.equal(tree.remove('samwise'), 'samwise');
  assert.equal(tree.remove('pippin'), 'pippin');
  assert.equal(tree.remove('frodo'), 'frodo');

  for (var i = 0; i < values.length; i += 1) {
    assert.equal(tree.contains(values[i]), true);
  }
  assert.equal(tree.contains('samwise'), false);
  assert.equal(tree.contains('pippin'), false);
  assert.equal(tree.contains('frodo'), false);
});


/**
 * This test verifies that we can insert values into and remove values from
 * the AvlTree and have its indexOf method correctly determine the in-order
 * index of the values it contains.
 */
test("AvlTree IndexOf", () => {
  var tree = new AvlTree<string>();
  var values = ['bill', 'blake', 'elliot', 'jacob', 'john', 'myles', 'ted'];

  // Insert strings into tree out of order
  tree.add('frodo');
  tree.add(values[4]);
  tree.add(values[3]);
  tree.add(values[0]);
  tree.add(values[6]);
  tree.add('samwise');
  tree.add(values[5]);
  tree.add(values[1]);
  tree.add(values[2]);
  tree.add('pippin');

  // Remove strings from tree
  assert.equal('samwise', tree.remove('samwise'));
  assert.equal('pippin', tree.remove('pippin'));
  assert.equal('frodo', tree.remove('frodo'));

  for (var i = 0; i < values.length; i += 1) {
    assert.equal(i, tree.indexOf(values[i]));
  }
  assert.equal(-1, tree.indexOf('samwise'));
  assert.equal(-1, tree.indexOf('pippin'));
  assert.equal(-1, tree.indexOf('frodo'));
});


/**
 * This test verifies that we can insert values into and remove values from
 * the AvlTree and have its minValue and maxValue routines return the correct
 * min and max values contained by the tree.
 */
test("Min And Max Values", ()=> {
  let tree = new AvlTree<number>(function(a, b) { return a - b; });

  assert.throws(() => new AvlTree().getMinimum());
  assert.throws(() => new AvlTree().getMaximum());

  var NUM_TO_INSERT = 2000;
  var NUM_TO_REMOVE = 500;

  // Insert ints into tree out of order
  for (var i = 0; i < NUM_TO_INSERT; i += 1) {
    tree.add(i);
  }

  // Remove valuse
  for (var i = 0; i < NUM_TO_REMOVE; i += 1) {
    tree.remove(i);
  }

  assert.equal(tree.getMinimum(), NUM_TO_REMOVE);
  assert.equal(tree.getMaximum(), NUM_TO_INSERT - 1);
});


/**
 * This test verifies that we can insert values into and remove values from
 * the AvlTree and traverse the tree in reverse order using the
 * reverseOrderTraverse routine.
 */
test("ReverseOrderTraverse", () => {
  let tree = new AvlTree<number>(function(a, b) { return a - b; });

  const NUM_TO_INSERT = 2000;
  const NUM_TO_REMOVE = 500;

  // Insert ints into tree out of order
  for (var i = 0; i < NUM_TO_INSERT; i += 1) {
    tree.add(i);
  }

  // Remove valuse
  for (var i = 0; i < NUM_TO_REMOVE; i += 1) {
    tree.remove(i);
  }

  var i = NUM_TO_INSERT - 1;
  tree.reverseOrderTraverse(function(value) {
    assert.equal(value, i);
    i -= 1;
  });
  assert.equal(i, NUM_TO_REMOVE - 1);
});


/**
 * Verifies correct behavior of getCount(). See http://b/4347755
 */
test("GetCountBehavior", ()=> {
  var tree = new AvlTree<any>();
  tree.add(1);
  tree.remove(1);
  assert.equal(0, tree.getCount());

  var values = ['bill', 'blake', 'elliot', 'jacob', 'john', 'myles', 'ted'];

  // Insert strings into tree out of order
  tree.add('frodo');
  tree.add(values[4]);
  tree.add(values[3]);
  tree.add(values[0]);
  tree.add(values[6]);
  tree.add('samwise');
  tree.add(values[5]);
  tree.add(values[1]);
  tree.add(values[2]);
  tree.add('pippin');
  assert.equal(10, tree.getCount());
  // @ts-ignore
  assert.equal(tree.root_.left.count + tree.root_.right.count + 1, tree.getCount());

  // Remove strings from tree
  assert.equal('samwise', tree.remove('samwise'));
  assert.equal('pippin', tree.remove('pippin'));
  assert.equal('frodo', tree.remove('frodo'));
  assert.equal(null, tree.remove('merry'));
  assert.equal(7, tree.getCount());
  // @ts-ignore
  assert.equal(tree.root_.left.count + tree.root_.right.count + 1, tree.getCount());
});


/**
 * This test verifies that getKthOrder gets the correct value.
 */
test("GetKthOrder", () => {
  var tree = new AvlTree<number>(function(a, b) { return a - b; });

  var NUM_TO_INSERT = 2000;
  var NUM_TO_REMOVE = 500;

  // Insert ints into tree out of order
  for (var i = 0; i < NUM_TO_INSERT; i += 1) {
    tree.add(i);
  }

  // Remove values.
  for (var i = 0; i < NUM_TO_REMOVE; i += 1) {
    tree.remove(i);
  }
  for (var k = 0; k < tree.getCount(); ++k) {
    assert.equal(NUM_TO_REMOVE + k, tree.getKthValue(k));
  }
});


// See https://github.com/google/closure-library/issues/896
test("TreeHeightAfterRightRotate", ()=> {
  const tree = new AvlTree();
  tree.add(0);
  tree.add(8);
  tree.add(5);
  assert.equal(2, tree.getHeight());
  // @ts-ignore
  assert.equal(5, tree.root_.value);
  // @ts-ignore
  assert.equal(0, tree.root_.left.value);
  // @ts-ignore
  assert.equal(8, tree.root_.right.value);
  // @ts-ignore
  assert.equal(2, tree.root_.height);
  // @ts-ignore
  assert.equal(1, tree.root_.left.height);
  // @ts-ignore
  assert.equal(1, tree.root_.right.height);

  assert.equal(0, tree.getMinimum());
  assert.equal(8, tree.getMaximum());
  assert.equal(3, tree.getCount());
});


test("AddLeftLeftCase",()=> {
  const tree = new AvlTree((a:number, b:number) => a - b);
  tree.add(100);
  tree.add(150);
  tree.add(50);
  tree.add(25);
  tree.add(75);
  tree.add(0);

  //        100                             50
  //       /   \                           /  \
  //      50   150   Rotate Right (100)   25   100
  //     /  \        ----------------->  /     /  \
  //    25   75                         0     75  150
  //   /
  //  0
  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(50, tree.root_.value);
  // @ts-ignore
  assert.equal(25, tree.root_.left.value);
  // @ts-ignore
  assert.equal(0, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(100, tree.root_.right.value);
  // @ts-ignore
  assert.equal(75, tree.root_.right.left.value);
  // @ts-ignore
  assert.equal(150, tree.root_.right.right.value);

  assert.equal(0, tree.getMinimum());
  assert.equal(150, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("RemoveLeftLeftCase", ()=> {
  const tree = new AvlTree((a:number, b:number) => a - b);
  tree.add(100);
  tree.add(150);
  tree.add(50);
  tree.add(25);
  tree.add(75);
  tree.add(200);
  tree.add(0);

  tree.remove(200);

  //        100                             50
  //       /   \                           /  \
  //      50   150   Rotate Right (100)   25   100
  //     /  \        ----------------->  /     /  \
  //    25   75                         0     75  150
  //   /
  //  0
  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(50, tree.root_.value);
  // @ts-ignore
  assert.equal(25, tree.root_.left.value);
  // @ts-ignore
  assert.equal(0, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(100, tree.root_.right.value);
  // @ts-ignore
  assert.equal(75, tree.root_.right.left.value);
  // @ts-ignore
  assert.equal(150, tree.root_.right.right.value);

  assert.equal(0, tree.getMinimum());
  assert.equal(150, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("AddLeftRightCase", ()=> {
  const tree = new AvlTree((a:number, b:number) => a - b);
  tree.add(100);
  tree.add(50);
  tree.add(150);
  tree.add(25);
  tree.add(75);
  tree.add(60);

  //     100                             100                           75
  //     / \                            /   \                         /  \
  //    50   150  Left Rotate (50)     75    150  Right Rotate(100)  50  100
  //   / \        - - - - - - - ->    /           - - - - - - - ->  / \     \
  //  25  75                         50                            25 60    150
  //     /                          / \
  //   60                          25  60

  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(75, tree.root_.value);
  // @ts-ignore
  assert.equal(50, tree.root_.left.value);
  // @ts-ignore
  assert.equal(25, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(60, tree.root_.left.right.value);
  // @ts-ignore
  assert.equal(100, tree.root_.right.value);
  // @ts-ignore
  assert.equal(150, tree.root_.right.right.value);

  assert.equal(25, tree.getMinimum());
  assert.equal(150, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("RemoveLeftRightCase", () => {
  const tree = new AvlTree((a:number, b:number) => a - b);
  tree.add(100);
  tree.add(50);
  tree.add(150);
  tree.add(25);
  tree.add(75);
  tree.add(200);
  tree.add(60);

  tree.remove(200);

  //     100                             100                           75
  //     / \                            /   \                         /  \
  //    50   150  Left Rotate (50)     75    150  Right Rotate(100)  50  100
  //   / \        - - - - - - - ->    /           - - - - - - - ->  / \     \
  //  25  75                         50                            25 60    150
  //     /                          / \
  //   60                          25  60

  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(75, tree.root_.value);
  // @ts-ignore
  assert.equal(50, tree.root_.left.value);
  // @ts-ignore
  assert.equal(25, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(60, tree.root_.left.right.value);
  // @ts-ignore
  assert.equal(100, tree.root_.right.value);
  // @ts-ignore
  assert.equal(150, tree.root_.right.right.value);

  assert.equal(25, tree.getMinimum());
  assert.equal(150, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("AddRightRightCase", () =>{
  const tree = new AvlTree<number>((a:number, b:number) => a - b);
  tree.add(100);
  tree.add(50);
  tree.add(150);
  tree.add(125);
  tree.add(200);
  tree.add(250);

  //   100                             150
  //  /  \                            /   \
  // 50   150     Left Rotate(100)   100   200
  //      / \   - - - - - - - ->    /  \      \
  //     125 200                   50  125    250
  //          \
  //          250

  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(150, tree.root_.value);
  // @ts-ignore
  assert.equal(100, tree.root_.left.value);
  // @ts-ignore
  assert.equal(50, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(125, tree.root_.left.right.value);
  // @ts-ignore
  assert.equal(200, tree.root_.right.value);
  // @ts-ignore
  assert.equal(250, tree.root_.right.right.value);

  assert.equal(50, tree.getMinimum());
  assert.equal(250, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("RemoveRightRightCase", ()=> {
  const tree = new AvlTree<number>((a, b) => a - b);
  tree.add(100);
  tree.add(50);
  tree.add(150);
  tree.add(0);
  tree.add(125);
  tree.add(200);
  tree.add(250);

  tree.remove(0);

  //   100                             150
  //  /  \                            /   \
  // 50   150     Left Rotate(100)   100   200
  //      / \   - - - - - - - ->    /  \      \
  //     125 200                   50  125    250
  //          \
  //          250

  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(150, tree.root_.value);
  // @ts-ignore
  assert.equal(100, tree.root_.left.value);
  // @ts-ignore
  assert.equal(50, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(125, tree.root_.left.right.value);
  // @ts-ignore
  assert.equal(200, tree.root_.right.value);
  // @ts-ignore
  assert.equal(250, tree.root_.right.right.value);

  assert.equal(50, tree.getMinimum());
  assert.equal(250, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("AddRightLeftCase",() => {
  const tree = new AvlTree<number>((a, b) => a - b);
  tree.add(100);
  tree.add(150);
  tree.add(50);
  tree.add(112);
  tree.add(200);
  tree.add(125);

  //   100                            100                             112
  //   / \                            / \                            /  \
  // 50   150   Right Rotate (150)   50  112      Left Rotate(100)  100  150
  //     /   \   - - - - - - - ->           \     - - - - - - - ->  /   /   \
  //    112  200                            150                    50   125  200
  //     \                                  /  \
  //     125                               125 200

  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(112, tree.root_.value);
  // @ts-ignore
  assert.equal(100, tree.root_.left.value);
  // @ts-ignore
  assert.equal(50, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(150, tree.root_.right.value);
  // @ts-ignore
  assert.equal(125, tree.root_.right.left.value);
  // @ts-ignore
  assert.equal(200, tree.root_.right.right.value);

  assert.equal(50, tree.getMinimum());
  assert.equal(200, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


test("Remove Right Left Case", () => {
  const tree = new AvlTree<number>((a, b) => a - b);
  tree.add(100);
  tree.add(150);
  tree.add(50);
  tree.add(0);
  tree.add(112);
  tree.add(200);
  tree.add(125);

  tree.remove(0);

  //   100                            100                             112
  //   / \                            / \                            /  \
  // 50   150   Right Rotate (150)   50  112      Left Rotate(100)  100  150
  //     /   \   - - - - - - - ->           \     - - - - - - - ->  /   /   \
  //    112  200                            150                    50   125  200
  //     \                                  /  \
  //     125                               125 200

  assert.equal(3, tree.getHeight());
  // @ts-ignore
  assert.equal(112, tree.root_.value);
  // @ts-ignore
  assert.equal(100, tree.root_.left.value);
  // @ts-ignore
  assert.equal(50, tree.root_.left.left.value);
  // @ts-ignore
  assert.equal(150, tree.root_.right.value);
  // @ts-ignore
  assert.equal(125, tree.root_.right.left.value);
  // @ts-ignore
  assert.equal(200, tree.root_.right.right.value);

  assert.equal(50, tree.getMinimum());
  assert.equal(200, tree.getMaximum());
  assert.equal(6, tree.getCount());
});


/**
 * Asserts expected properties of an AVL tree.
 *
 * @param {function(?, ?): number} comparator
 * @param {?} node
 */
function assertAvlTree(comparator:(a:number,b:number) =>number, node:any) {
  if (node) {
    assert.equal(node.height < 1.4405 * Math.log2(node.count + 2) - 0.3277, true);
    assert.equal(node.height >= Math.log2(node.count + 1), true);
    let expectedCount = 1;
    let balanceFactor = 0;
    if (node.left) {
      balanceFactor -= node.left.height;
      expectedCount += node.left.count;
      assert.equal(comparator(node.value, node.left.value) > 0, true);
      assertAvlTree(comparator, node.left);
    }
    if (node.right) {
      balanceFactor += node.right.height;
      expectedCount += node.right.count;
      assert.equal(comparator(node.value, node.right.value) < 0, true);
      assertAvlTree(comparator, node.right);
    }
    assert.equal(Math.abs(balanceFactor) < 2, true);
    assert.equal(expectedCount, node.count);
  }
}


test("LargeDataset Is AvlTree", () => {
  let arr = [];
  for (let i = 0; i < 1000; i++) {
    arr.push(i);
  }
  const comparator = (a:number, b:number) => a - b;
  const tree = new AvlTree<number>(comparator);

  while (arr.length) {
    tree.add(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    // @ts-ignore
    assertAvlTree(comparator, tree.root_);
  }


  arr = tree.getValues();
  assert.deepEqual(arr, [...tree])
  for (let i = 0; i < 1000; i++) {
    assert.equal(i, arr[i]);
    assert.equal(i, tree.indexOf(i));
    assert.equal(i, tree.getKthValue(i));
  }

  while (arr.length) {
    tree.remove(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    // @ts-ignore
    assertAvlTree(comparator, tree.root_);
  }
});
