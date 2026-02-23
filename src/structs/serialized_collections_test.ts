import assert from 'assert/strict';
import test from 'node:test';

import {SerializedMap, SerializedSet} from "./serialized_collections.ts";

test("map", () => {
    let map = new SerializedMap<number[], number>(v => v.join());

    map.set([1], 1);
    map.set([2], 2);
    map.set([1], 3);

    assert.equal(map.size, 2);
    assert.equal(map.get([1]), 3);
    assert.equal(map.get([2]), 2);


    assert.deepEqual([...map.values()], [3,2]);
    assert.deepEqual([...map.keys()], [[1],[2]]);
    assert.deepEqual([...map.entries()], [[[1],3],[[2],2]]);
    assert.deepEqual([...map], [[[1],3],[[2],2]]);

    map.set([3], 5)
    assert.deepEqual([...map], [[[1],3],[[2],2],[[3],5]]);

    map.delete([3]);
    assert.deepEqual([...map], [[[1],3],[[2],2]]);

    assert.equal(map.get([1]), 3);
    assert.equal(map.has([1]), true);
    assert.equal(map.has([7]), false);

    let vals: {key:number[], value: number, map:Map<any,any>}[] = [];
    let me = {};
    let foundMe = null;

    map.forEach(function (value, key, map)  {
        vals.push({key, value, map});
        // @ts-ignore
        foundMe = this;
    }, me);

    assert.deepEqual(vals, [{key:[1], value:3, map}, {key:[2], value: 2, map}]);
    assert.equal(foundMe, me)

    map.forEach((value, key, map) =>  {
        // @ts-ignore
        foundMe = this;
    }, me);
    assert.equal(foundMe, this)

    map.clear();
    assert.deepEqual([...map], []);


});


test("set", () => {
    let set = new SerializedSet<number[]>(v => v.join());

    set.add([1]);
    set.add([2]);
    set.add([1]);

    assert.equal(set.size, 2);
    assert.equal(set.has([1]), true);
    assert.equal(set.has([2]), true);
    assert.equal(set.has([3]), false);


    assert.deepEqual([...set.values()], [[1],[2]]);
    assert.deepEqual([...set.keys()], [[1],[2]]);
    assert.deepEqual([...set.entries()], [[[1],[1]],[[2],[2]]]);
    assert.deepEqual([...set], [[1],[2]]);

    set.add([3])
    assert.deepEqual([...set], [[1],[2],[3]]);

    set.delete([3]);
    assert.deepEqual([...set], [[1],[2]]);

    assert.equal(set.has([1]), true);
    assert.equal(set.has([2]), true);
    assert.equal(set.has([7]), false);

    let vals: {key:number[], value: number[], set:Set<any>}[] = [];
    let me = {};
    let foundMe = null;

    set.forEach(function (value, key, set)  {
        vals.push({key, value, set});
        // @ts-ignore
        foundMe = this;
    }, me);

    assert.deepEqual(vals, [{key:[1], value:[1], set}, {key:[2], value: [2], set}]);
    assert.equal(foundMe, me)

    set.forEach((value, key, map) =>  {
        // @ts-ignore
        foundMe = this;
    }, me);
    assert.equal(foundMe, this)

    set.clear();
    assert.deepEqual([...set], []);


});
