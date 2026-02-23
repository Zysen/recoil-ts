import {Path} from "./path.ts";
import assert from "node:assert";
import test from "node:test";
import {assertThrows} from "../test.ts";

test("ancestor", () => {
    assert.equal(Path.fromString("a/b").isAncestor(Path.fromString("a/b"), true), true);
    assert.equal(Path.fromString("a/b").isAncestor(Path.fromString("a/b"), false), false);

    assert.equal(Path.fromString("a/b").isAncestor(Path.fromString("a/b/c"), true), true);
    assert.equal(Path.fromString("a/b").isAncestor(Path.fromString("a/b/c"), false), true);


    assert.equal(Path.fromString("a/b").setKeys(["a"],[1]).isAncestor(Path.fromString("a/b"), true), false);
    assert.equal(Path.fromString("a/b").setKeys(["a"],[1]).isAncestor(Path.fromString("a/b"), false), false);
    assert.equal(Path.fromString("a/b").setKeys(["a"],[1]).isAncestor(Path.fromString("a/b").setKeys(["a"],[1]).appendName("c"), false), true);

    assert.equal(Path.fromString("a/b").setKeys(["a"],[1]).isAncestor(Path.fromString("a/b").setKeys(["a"],[2]), true), false);
    assert.equal(Path.fromString("a/b").setKeys(["a"],[1]).isAncestor(Path.fromString("a/b").setKeys(["a"],[2]), false), false);



    assert.equal(Path.fromString("a/b").appendIndex(1).isAncestor(Path.fromString("a/b").appendIndex(1), true), true);
    assert.equal(Path.fromString("a/b").appendIndex(1).isAncestor(Path.fromString("a/b").appendIndex(1), false), false);

    assert.equal(Path.fromString("a/b").appendIndex(1).isAncestor(Path.fromString("a/b").appendIndexes([1,2]), true), true);
    assert.equal(Path.fromString("a/b").appendIndex(1).isAncestor(Path.fromString("a/b").appendIndexes([1,2]), false), true);
    assert.equal(Path.fromString("a/b").appendIndex(1).isAncestor(Path.fromString("a/b").appendIndexes([1,2]).appendName("c"), false), true);

})


test("truncateToLength", () => {

    const ab = Path.fromString("a/b");
    const a = Path.fromString("a");
    const ab_a1 = ab.setKeys(["a"],[1]);
    const ab_a2 = ab.setKeys(["a"],[2]);
    const ab_a2b2_c = ab.setKeys(["a", "b"],[2, 2]).appendName("c");
    const ab_a1b2 = ab.setKeys(["a", "b"],[1,2]);
    const ab_a2b2 = ab.setKeys(["a", "b"],[2,2]);
    const ab_$1 = ab.appendIndexes([1]);
    const ab_$2 = ab.appendIndexes([2]);
    const ab_$1$2 = ab.appendIndexes([1,2]);
    const ab_$1$2_c = ab_$1$2.appendName("c");

    assert.deepEqual(ab.truncateToLength(a), a);
    assertThrows(() => {
        ab.truncateToLength(ab.setKeys(["a"],[1]));
    });
    assert.deepEqual(ab_a1.truncateToLength(ab), ab);
    assert.deepEqual(ab_a2b2.truncateToLength(ab_a1), ab_a2);
    assert.deepEqual(ab_a2b2_c.truncateToLength(ab_a1), ab_a2);
    assert.deepEqual(ab_a2b2_c.truncateToLength(ab_a1b2), ab_a2b2);

    assert.deepEqual(ab_$1.truncateToLength(ab), ab);
    assert.deepEqual(ab_$1$2.truncateToLength(ab_$2), ab_$1);
    assert.deepEqual(ab_$1$2_c.truncateToLength(ab_$2), ab_$1);

    assertThrows(() => ab_$2.truncateToLength(ab_$1$2));
    assertThrows(() => ab.truncateToLength(ab_a1));
})


test("move", () => {

    const ab = Path.fromString("a/b");
    const a = Path.fromString("a");
    const ab_a1 = ab.setKeys(["a"],[1]);
    const ab_a2 = ab.setKeys(["a"],[2]);

    const ab_a1b1 = ab.setKeys(["a", "b"],[1,1]);
    const ab_a2b2 = ab.setKeys(["a", "b"],[2,2]);
    const ab_a3b3 = ab.setKeys(["a", "b"],[2,2]);



    const ab_a1b1_c = ab_a1b1.appendName("c");
    const ab_a2b2_c = ab_a2b2.appendName("c");
    const ab_a3b3_c = ab_a3b3.appendName("c");

    const ab_$1 = ab.appendIndexes([1]);
    const ab_$2 = ab.appendIndexes([2]);
    const ab_$3 = ab.appendIndexes([3]);
    const ab_$1_c = ab_$1.appendName("c");
    const ab_$2_c = ab_$2.appendName("c");

    const ab_$1$1 = ab.appendIndexes([1,1]);
    const ab_$2$1 = ab.appendIndexes([2,1]);
    const ab_$1$2 = ab.appendIndexes([1,2]);
    const ab_$1$2_c = ab_$1$2.appendName("c");
    const ab_$1$1_c = ab_$1$1.appendName("c");

    assert.deepEqual(ab_a1.move(ab_a1, ab_a2), ab_a2);
    assert.deepEqual(ab_a1b1.move(ab_a1b1, ab_a2b2), ab_a2b2);
    assert.deepEqual(ab_a3b3_c.move(ab_a1b1, ab_a2b2), ab_a3b3_c);


    assert.deepEqual(ab_$1.move(ab_$1, ab_$2), ab_$2);
    assert.deepEqual(ab_$1_c.move(ab_$1, ab_$2), ab_$2_c);
    assert.deepEqual(ab_$3.move(ab_$1, ab_$2), ab_$3);


    assert.deepEqual(ab_$1$1.move(ab_$1$1, ab_$1$2), ab_$1$2);
    assert.deepEqual(ab_$1$1.move(ab_$1$1, ab_$2$1), ab_$2$1);
    assert.deepEqual(ab_$1$1_c.move(ab_$1$1, ab_$1$2), ab_$1$2_c);


});

