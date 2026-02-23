import test from "node:test";
import {ChangeDb, FilterGetter, ReferenceFilter, trueFilter} from "./changedb.ts";
import {Path} from "./path.ts";
import {AvlTree} from "../structs/avltree.ts";
import {compare} from "../util/object.ts";
import assert from "assert/strict";
import {BasicSchema, DbGenericType} from "./basicschema.ts";
import {ChangePosition, Move, Reorder} from "./change.ts";
import {ChangeDbNode} from "./changeset.ts";
import {Serializable} from "../util/serializable.ts";


test("set before set root", () => {
    let schema: BasicSchema = new BasicSchema();
    schema.register("list1", {
        type: "object-list",
        keys: ["a", "b"],
        fields: {
            "a": {"type": "string"},
            "b": {"type": "number"},
            "c": {"type": "string"},
        }
    })
    let db = new ChangeDb(schema);
    const listPath = Path.fromString("list1");
    let subPath = listPath.setKeys(["a","b"], ["1",1]);

    let listener1Info = {
        count: 0,
        val: null as any,
    }
    let listener1 = (val:any) => {
        listener1Info.count++;
        listener1Info.val = val;
    };
    const listData = [{a: "1", b: 1, c: "data"},{a: "2", b: 2, c: "data2"}]

    // can't set a value before we set the root
    assert.throws(() => db.transaction(() => {
        return db.set(listPath, listData);
    }));
    // can't get a value before we set the root
    assert.throws(() => db.transaction(() => {
        return db.get(listPath);
    }));

    let remover1 = db.addReference(listPath, listener1);
    // can't get a value before we set the root, even with a reference
    assert.throws(() => db.transaction(() => {
        return db.set(subPath, {a: "1", b: 1, c: "data - set"});
    }));

    assert.throws(() => db.transaction(() => {
        return db.get(listPath);
    }));

    // this should work
    db.transaction(() => {
        return db.set(listPath, listData);
    });

    // setting the subpath should still not work

    assert.throws(() => db.transaction(() => {
        return db.set(subPath, {a: "1", b: 1, c: "data - set"});
    }));

    // check listeners fire and get works






    assert.equal(listener1Info.count, 1);
    assert.deepEqual(listener1Info.val, listData);
    // just make sure they are not the same object
    assert.notEqual(listener1Info.val, listData);

    assert.deepEqual(db.get(listPath), listData);
    assert.equal(db.getReferenceCount(listPath), 1);
    remover1();
    assert.equal(db.getReferenceCount(listPath), 0);
    assert.throws(() => {
        db.get(listPath)
    })
    assert.deepEqual(db.unsafeGet(new Path([])), {}); // a child reference still exists
})




test("basic reference", () => {
    let schema: BasicSchema = new BasicSchema();

    schema.register("list1", {
        type: "object-list",
        keys: ["a", "b"],
        fields: {
            "a": {"type": "string"},
            "b": {"type": "number"},
            "c": {"type": "string"},
        }
    })
    let db = new ChangeDb(schema);
    const listPath = Path.fromString("list1");

    let listener1Info = {
        count: 0,
        val: null as any,
    }
    let listener1 = (val:any) => {
        listener1Info.count++;
        listener1Info.val = val;
    };
    const listData = [{a: "1", b: 1, c: "data"},{a: "2", b: 2, c: "data2"}]

    let remover1 = db.addReference(listPath, listener1);
    let changes = db.transaction(() => {
        return db.set(listPath, listData);
    })

    assert.equal(listener1Info.count, 1);
    assert.deepEqual(listener1Info.val, listData);
    // just make sure they are not the same object
    assert.notEqual(listener1Info.val, listData);

    assert.deepEqual(db.get(listPath), listData);
    assert.equal(db.getReferenceCount(listPath), 1);

    remover1();

    assert.equal(db.getReferenceCount(listPath), 0);
    assert.throws(() => {
        db.get(listPath)
    })
    assert.deepEqual(db.unsafeGet(new Path([])), {}); // a child reference still exists
})


test("sub reference - preload", () => {
    let schema: BasicSchema = new BasicSchema();

    schema.register("list1", {
        type: "object-list",
        keys: ["a", "b"],
        fields: {
            "a": {"type": "string"},
            "b": {"type": "number"},
            "c": {"type": "string"},
        }
    })
    let db = new ChangeDb(schema);
    const listPath = Path.fromString("list1");

    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    const listData = [{a: "1", b: 1, c: "data"},{a: "2", b: 2, c: "data2"}]

    let subPath = listPath.setKeys(["a","b"], ["1",1]);

    let removerTop = db.addReference(listPath, listener1);
    let removerSub = db.addReference(subPath, listener1);

    db.transaction(() => {
        return db.set(listPath, listData);
    })
    assert.deepEqual([[{a: "1", b: 1, c: "data"},{a: "2", b: 2, c: "data2"}]], listener1Info.vals);
    listener1Info.vals = [];

    db.transaction(() => {
        return db.set(subPath, {a: "1", b: 1, c: "data3"});
    });

    let expected = new AvlTree(compare);
    expected.add([{a: "1", b: 1, c: "data3"},{a: "2", b: 2, c: "data2"}]);
    expected.add({a: "1", b: 1, c: "data3"});

    for (let info of listener1Info.vals) {
        assert.equal(expected.contains(info), true);

    }
    // todo what happens if I change the id of the node I am listening to, probably not important in set however move will
    // probably have to deal with it

    // todo get full item then partial item, then unreference full item fields that are not partial value should be missing
    // todo null containers
    assert.deepEqual(db.get(listPath), [{a: "1", b: 1, c: "data3"},{a: "2", b: 2, c: "data2"}]);
    assert.equal(db.getReferenceCount(listPath), 2);
    assert.equal(db.getReferenceCount(subPath), 1);

    removerTop();

    assert.equal(db.getReferenceCount(listPath), 1); // a child reference still exists
    assert.throws(() => {
        db.get(listPath)
    })
    // check that the data is actually deleted for unreferenced children
    assert.deepEqual(db.unsafeGet(subPath), {a: "1", b: 1, c: "data3"});
    assert.deepEqual(db.unsafeGet(listPath), [{a: "1", b: 1, c: "data3"}]);
    assert.equal(db.getReferenceCount(subPath), 1);
    removerSub();
    assert.equal(db.getReferenceCount(subPath), 0);
    assert.equal(db.getReferenceCount(listPath), 0);

    assert.throws(() => {
        db.get(subPath)
    });
    assert.deepEqual(db.unsafeGet(new Path([])), {}); // a child reference still exists
});

test("array/object nullable values", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    let removers  = [];

    // root level nullable
    schema.register("obj-nullable", {
        type: "object",
        nullable: true,
        fields: {
            "a-null": {"type": "string", nullable: true},
            "b": {"type": "number"},
        }
    });
    schema.register("array-nullable", {
        type: "object-list",
        keys: ["a-null"],
        nullable: true,
        fields: {
            "a-null": {"type": "string", nullable: true},
            "b": {"type": "number"},
        }
    });

    const pNullable = Path.fromString("obj-nullable");
    const pArray = Path.fromString("array-nullable");


    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };
    removers.push(db.addReference(pNullable, listener1));

    db.transaction(() => {
        db.set(pNullable, null);
    })

    assert.equal(db.get(pNullable), null);
    assert.deepEqual(listener1Info.vals, [null]);
    listener1Info.vals = [];

    db.transaction(() => {
        db.set(pNullable, {"a-null":null, b:2});
    });

    assert.deepEqual(db.get(pNullable), {"a-null":null, b: 2});
    assert.deepEqual(listener1Info.vals, [{"a-null":null, b: 2}]);

    listener1Info.vals = [];
    removers.push(db.addReference(pArray, listener1));


    db.transaction(() => {
        db.set(pArray, null);
    });
    assert.equal(db.get(pArray), null);
    assert.deepEqual(listener1Info.vals, [null]);
    listener1Info.vals = [];

    db.transaction(() => {
        db.set(pArray, [{"a-null":null, b:2}]);
    });
    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});

});

test("object null values", () => {
    let schema: BasicSchema = new BasicSchema();
    let removers:any[]  = [];
    const pObj = Path.fromString("object-nullable");
    const pArray = Path.fromString("array-el-nullable");
    let db = new ChangeDb(schema);


    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };
    schema.register("array-el-nullable", {
        type: "object-list",
        keys: ["a-null"],
        nullable: true,
        fields: {
            "a-null": {"type": "string", nullable: true},
            "b": {"type": "number"},
        }
    });
    schema.register("object-nullable", {
        type: "object",
        nullable: true,
        fields: {
            "a-null": {"type": "string", nullable: true},
            "b": {"type": "number"},
        }
    });

    removers.push(db.addReference(pObj, listener1));
    removers.push(db.addReference(pArray, listener1));

    db.transaction(() => {
       db.set(pArray, [{"a-null":null, b:2}, {"a-null":3, b: 3}]);
       db.set(pObj, {"a-null":null, b:2});
    });

    assert.deepEqual(db.get(pArray), [{"a-null":null, b:2}, {"a-null":3, b: 3}]);
    assert.deepEqual(db.get(pObj), {"a-null":null, b: 2});
    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});
});


test("ordered lists", () => {
    let schema: BasicSchema = new BasicSchema();
    let removers:any[]  = [];
    const pArray = Path.fromString("array");
    let db = new ChangeDb(schema);
    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    schema.register("array", {
        type: "object-list",
        keys: ["a"],
        ordered: true,
        fields: {
            "a": {"type": "string"},
            "b": {"type": "number"},
        }
    });
    removers.push(db.addReference(pArray, listener1));
    db.transaction(() => {
        db.set(pArray, [{a:1, b:1},{a:2, b:2},{a:3, b:3}]);
    });

    assert.deepEqual(db.get(pArray),[{a:1, b:1},{a:2, b:2},{a:3, b:3}]);

    new Reorder(pArray.setKeys(["a"], [1]), pArray.setKeys(["a"], [2]), ChangePosition.AFTER, null).applyToDb(db, schema);
    assert.deepEqual(db.get(pArray),[{a:2, b:2},{a:1, b:1},{a:3, b:3}]);

    new Reorder(pArray.setKeys(["a"], [1]), null, ChangePosition.AFTER, null).applyToDb(db, schema);
    assert.deepEqual(db.get(pArray),[{a:1, b:1},{a:2, b:2},{a:3, b:3}]);

    new Reorder(pArray.setKeys(["a"], [1]), null, ChangePosition.BEFORE, null).applyToDb(db, schema);
    assert.deepEqual(db.get(pArray),[{a:2, b:2},{a:3, b:3}, {a:1, b:1}]);

    new Reorder(pArray.setKeys(["a"], [1]), pArray.setKeys(["a"], [2]), ChangePosition.BEFORE, null).applyToDb(db, schema);
    assert.deepEqual(db.get(pArray),[{a:1, b:1},{a:2, b:2},{a:3, b:3}]);

    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});
});

test("test move", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    let removers:any[]  = [];
    const pArray = Path.fromString("array");
    const pUArray = Path.fromString("uarray");
    const pArray1 = Path.fromString("array").setKeys(["a"], [1]);

    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    schema.register("array", {
        type: "object-list",
        keys: ["a"],
        ordered: true,
        fields: {
            "a": {"type": "number"},
            "b": {"type": "number"},
        }
    });

    schema.register("uarray", {
        type: "object-list",
        keys: ["a"],
        fields: {
            "a": {"type": "number"},
            "b": {"type": "number"},
        }
    });

    removers.push(db.addReference(pArray1, listener1));
    removers.push(db.addReference(pArray, listener1));
    removers.push(db.addReference(pUArray, listener1));

    db.transaction(() => {
        db.set(pArray, [{a:1, b:1},{a:2, b:2},{a:3, b:3}]);
        db.set(pArray1, {a:1, b:1});
        db.set(pUArray, [{a:1, b:1},{a:2, b:2},{a:3, b:3}]);
    });


    // todo check references on moved objects they moved

    new Move(pArray.setKeys(["a"], [1]), pArray.setKeys(["a"], [7])).applyToDb(db, schema);
    assert.deepEqual(db.get(pArray),[{a:7, b:1},{a:2, b:2},{a:3, b:3}]);

    // order not important here
    new Move(pUArray.setKeys(["a"], [1]), pUArray.setKeys(["a"], [7])).applyToDb(db, schema);
    assert.deepEqual(db.get(pArray).sort((x:any, y:any) => x.a - y.a),[{a:2, b:2},{a:3, b:3}, {a:7, b:1}]);

    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});
});


test("primative lists", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    const pArray = Path.fromString("array");
    const pArray1 = pArray.appendIndex(1);

    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    let removers  = [];
    removers.push(db.addReference(pArray, listener1));
    removers.push(db.addReference(pArray.appendIndex(1), listener1));

    schema.register("array", {
        type: "list",
        elementType: {type: "string"}
    });

    db.transaction(() => {
        db.set(pArray, ["a","b", "c"]);
        db.set(pArray1, "d");

    })

    assert.deepEqual(db.get(pArray),["a","d","c"]);

    // todo check we have a refrence to a subpath and what happens
    // happens to a list we reference an element in it but the top level element gets unreferenced what is left,
    // just leave null primitives, of course this is just strange anyway since how could you reference a index of a list
    // you haven't got the length of

    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});
});

test("list of lists", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    const pArray = Path.fromString("array");
    const pArray$0 = Path.fromString("array").appendIndexes([0]);
    const pArray$0$0 = Path.fromString("array").appendIndexes([0,0]);
    let removers  = [];
    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    schema.register("array", {
        type: "list",
        elementType: {
            type: "list",
            elementType: {"type": "number"},
        }
    });
    removers.push(db.addReference(pArray, listener1));
    removers.push(db.addReference(pArray$0, listener1));

    db.transaction(() => {
        db.set(pArray, [[1,2],[3,4]]);
        db.set(pArray$0, [5,6]);
    });

    assert.deepEqual(db.get(pArray), [[5,6],[3,4]]);

    removers.push(db.addReference(pArray$0$0, listener1));

    db.transaction(() => {
        db.set(pArray$0$0, 7);
    });

    assert.deepEqual(db.get(pArray), [[7,6],[3,4]]);

    for (let remover of removers) {
        remover();
    }

    assert.deepEqual(db.unsafeGet(new Path([])), {});
});

class DateType implements DbGenericType<Date> {
    deserialize(value: Serializable): Date {
        if (typeof value === "number") {
            return new Date(value);
        }
        throw new Error("Wrong type");
    }
    serialize(value: Date): Serializable {
        return value.getTime();
    }
}


test("other primative types", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    const pObj = Path.fromString("obj");
    let removers  = [];

    schema.register("obj", {
        type: "object",
        fields: {
            dt: {type: new DateType()},
        }
    });
    let listener1 = (val:any) => {};
    removers.push(db.addReference(pObj, listener1));

    let dt = new Date();

    db.transaction(() => {
        db.setSerialize(pObj, {dt: dt.getTime()});
    });

    assert.equal(db.get(pObj).dt.getTime(), dt.getTime());
    assert.equal(dt.getTime(), db.getSerialized(pObj).dt);


    for (let remover of removers) {
        remover();
    }

    assert.deepEqual(db.unsafeGet(new Path([])), {});
});

test("aliases", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    let removers  = [];
    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    schema.register("obj", {
        type: "object",
        fields: {
            "a": {
                type: "object-list",
                keys: ["k"],
                fields: {
                    k: {type: "number"},
                    v: {type: "number"}
                }
            },
            "b": {"type": "number"},
        }
    });

    const kOnly:ReferenceFilter = (getter: FilterGetter, path:Path):boolean => {
        return path.size() != 2 || path.last().name() === 'k';
    }
    const pList = Path.fromString("list");
    const pListK = Path.fromString("listk");
    const pObjA = Path.fromString("obj/a");

    schema.registerAlias(pList, pObjA);
    schema.registerAlias(pListK, pObjA, kOnly);

    removers.push(db.addReference(pList, listener1));
    removers.push(db.addReference(pListK, listener1));

    db.transaction(() => {
       db.set(pList, [{k:1, v: 1}, {k:2, v:2}]);
       db.set(pListK, [{k:1}, {k:2}]);
    });

    assert.deepEqual(db.get(pList), [{k:1, v: 1}, {k:2, v:2}]);
    assert.deepEqual(db.get(pListK), [{k:1}, {k:2}]);


    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});
});

test("filters", () => {
    let schema: BasicSchema = new BasicSchema();
    let db = new ChangeDb(schema);
    let removers  = [];
    let listener1Info:{vals:any[]} = {
        vals: [],
    }
    let listener1 = (val:any) => {
        listener1Info.vals.push(val);
    };

    schema.register("list1", {
        type: "object-list",
        keys: ["a"],
        fields: {
            "a": {"type": "number"},
            "b": {"type": "number"},
        }
    });


    schema.register("obj", {
        type: "object",
        fields: {
            "a": {"type": "number"},
            "b": {"type": "number"},
        }
    });

    const pList1 = Path.fromString("list1");
    const pObj = Path.fromString("obj");

    const oddOnly = (getter: FilterGetter, path:Path):boolean => {
        return path.size() != 1 || getter.get(path).a % 2 === 1;
    }

    const aOnly = (getter: FilterGetter, path:Path):boolean => {
        return path.size() != 2 || path.last().name() === "a";
    }

    removers.push(db.addReference(pList1, listener1));
    removers.push(db.addReference(pList1, listener1, oddOnly));
    removers.push(db.addReference(pObj, listener1));
    removers.push(db.addReference(pObj, listener1, aOnly));

    db.transaction(() => {
        db.set(pList1, [{a: 1, b: 1}, {a: 2, b: 2}, {a: 3, b: 3}, {a: 4, b: 4}]);
        db.set(pList1, [{a: 1, b: 2}, {a: 3, b: 3}], oddOnly);

        db.set(pObj, {a: 1, b: 2});
        db.set(pObj, {a: 1}, aOnly);
    });

    assert.deepEqual(db.get(pList1), [{a: 1, b: 2}, {a: 2, b: 2}, {a: 3, b: 3}, {a: 4, b: 4}]);
    assert.deepEqual(db.get(pList1, oddOnly), [{a: 1, b: 2}, {a: 3, b: 3}]);
    assert.deepEqual(db.get(pObj), {a:1,b: 2});
    assert.deepEqual(db.get(pObj, aOnly), {a:1});

    assert.equal(listener1Info.vals.length, 6);
    assert.deepEqual(listener1Info.vals[0],  [{a: 1, b: 1}, {a: 2, b: 2}, {a: 3, b: 3}, {a: 4, b: 4}]);

    // don't care what order these happened in
    listener1Info.vals.shift();
    listener1Info.vals.sort((a, b) => a.length-b.length);
    assert.deepEqual(listener1Info.vals[0],  [{a: 1, b: 2}, {a: 3, b: 3}]);
    assert.deepEqual(listener1Info.vals[1],  [{a: 1, b: 2}, {a: 2, b: 2}, {a: 3, b: 3}, {a: 4, b: 4}]);


    // todo look at listener
    // todo filter object fields

    // such as dates or really anything that we want the schema to allow
    //assert.equal(true, false);

    for (let remover of removers) {
        remover();
    }
    assert.deepEqual(db.unsafeGet(new Path([])), {});
});