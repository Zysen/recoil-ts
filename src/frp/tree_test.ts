import assert from "assert/strict";
import test from "node:test";
import {Frp} from "./frp.ts";
import {Tree} from "../structs/tree.ts";
import {getValueB} from "./tree.ts";

test("structLiftBI", () => {
    let frp = new Frp();
    let origTree = new Tree<string>("","root",
        [
            new Tree<string>("c1","child1"),
            new Tree<string>("c2","child2", [new Tree<string>("s1","sub child1")]),
            new Tree<string>("c3","child3")]
    );

    let treeB = frp.createB(origTree);
    let rootB = getValueB(treeB, []);
    let c2B = getValueB(treeB, ["c2"]);
    let s1B = getValueB(treeB, ["c2","s1"]);

    frp.attach(rootB);
    frp.attach(c2B);
    frp.attach(s1B);

    frp.accessTrans(() => {
        assert.deepEqual(rootB.get(), "root");
        assert.deepEqual(c2B.get(), "child2");
        assert.deepEqual(s1B.get(), "sub child1");
        s1B.set("bob");
    }, rootB, c2B, s1B)


    frp.accessTrans(() => {
        assert.notDeepEqual(treeB.get(), origTree);
        assert.deepEqual(treeB.get(), new Tree<string>("","root",
            [
                new Tree<string>("c1","child1"),
                new Tree<string>("c2","child2", [new Tree<string>("s1","bob")]),
                new Tree<string>("c3","child3")]
        ));
    }, treeB);
});
