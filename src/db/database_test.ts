import {BasicDbId, DbId} from "./dbid.ts";
import {DatabaseComms} from "./comms.ts";
import {assertArrayEquals, assertEquals, assertFalse, assertObjectEquals, assertTrue} from "../test.ts";
import { NOT_PRESENT } from "./database.ts";
import {QueryOptions} from "./query.ts";
import {Behaviour, BStatus, Frp} from "../frp/frp.ts";
import {ReadWriteDatabase} from "./readwritedb.ts";
import {ReadOnlyDatabase} from "./readonlydb.ts";
import {DelayedDatabase} from "./delayeddb.ts";
import {BasicSchema} from "./basicschema.ts";

const VAL_KEY = new BasicDbId("/val", ['key'], 'val');
const HELLO_KEY = new BasicDbId("/hello", ['key'], 'hello');
const WORLD_KEY = new BasicDbId("/world", ['key'], 'world');
const LIST_ITEM_KEY = new BasicDbId("list", ['id'], 'list-item');
const LIST_KEY:BasicDbId<number[]> = new BasicDbId<any[]>("list/id", [], 'list', undefined);

const schema = new BasicSchema();

class MyDb implements DatabaseComms {
    private values_: Record<string, any>;
    private readonly delay_: false | (()=>void)[];
    private active_: Record<string, any>;

    constructor(opt_delay?: boolean) {
        this.values_ = {'list': {'List': [{id: 1, v: 1}, {id: 2, v: 2}, {id: 3, v: 3}, {id: 4, v: 4}]}};
        this.delay_ = opt_delay ? [] : false;
        this.active_ = {};
    }


    makeKey(args:any[]):any[] {
        return args;
    }
    set<T>(data:T, oldData:T, idIn:DbId<T> , key:any, _options:QueryOptions):Promise<T> {
        const id = idIn as BasicDbId<T>;
        return new Promise((resolve)=> {
            if (this.delay_) {
                this.delay_.push(() => {
                    this.values_[id.getData()][key] = data;
                    resolve(data);
                });
            } else {
                this.values_[id.getData()][key] = data;
                resolve(data);
            }
        });
    }

    isActive<T>(idIn:DbId<T>, key:any) {
        const id = idIn as BasicDbId<T>;
        if (this.active_[id.getData()] === undefined) {
            return false;
        }
        return this.active_[id.getData()]["" + key];
    }

    stop<T>(idIn:DbId<T>, key:any, _options:QueryOptions) {
        const id = idIn as BasicDbId<T>;
        this.active_[id.getData()]["" + key] = false;
    }

    get<T>( idIn:DbId<T>, key:any, _options:QueryOptions) : Promise<T> {
        const id = idIn as BasicDbId<T>;
        if (this.active_[id.getData()] === undefined) {
            this.active_[id.getData()] = {};
        }
        this.active_[id.getData()]["" + key] = true;
        if (this.values_[id.getData()] === undefined) {
            this.values_[id.getData()] = {};
        }

        if (this.values_[id.getData()][key] === undefined) {
            if (id.getData() === 'list') {
            } else if (id.getData() === 'list-item') {

            } else {
                this.values_[id.getData()][key] = 'xxx' + id.getData() + "-" + key;
            }
        }

        const doIt= (resolve:(v: T) =>void, reject:(e: BStatus<T>)=>void)=> {
            if (id.getData() === 'list-item') {
                let list = this.values_['list']['List'];

                for (let i = 0; i < list.length; i++) {
                    if (list[i].id === key[0]) {
                        resolve(list[i]);
                        return;
                    }
                }
                reject(BStatus.errors([NOT_PRESENT]));
            } else {
                resolve(this.values_[id.getData()][key]);
            }
        };

        if (this.delay_) {
            return new Promise<T>((resolve, reject) => {
                if (this.delay_) { // not needed but the compiler complains delay is readonly
                    this.delay_.push(() => {
                        doIt(resolve, reject);
                    });
                }
            })
        } else {
            return new Promise<T>(doIt)
        }


    };


    process() {
        if (Array.isArray(this.delay_)) {
            let cmd = this.delay_.pop();
            if (cmd) {
                cmd();
            }
        }
    };

    processQueueSize() {
        return this.delay_ ? this.delay_.length : 0;
    }

    getValue(key: BasicDbId<any>, subKey:string) {
        return this.values_[key.getData()][subKey];
    }

    startTrans(): void {
    }

    stopTrans(): void {
    }

}


function getVals(vals:any) {
    let res = [];
    let i = 0;

    if (typeof vals === 'object') {
        for (let key in vals) {
            if (vals.hasOwnProperty(key)) {
                res[i] = vals[key];
                i++;
            }
        }
    }

    return res;
}


test("Get Same", () => {

    let frp = new Frp();
    let coms = new MyDb();
    let readwriteDb = new ReadWriteDatabase(frp, coms, schema);

    let a1 = readwriteDb.get(HELLO_KEY, ['a']);
    let a2 = readwriteDb.get(HELLO_KEY, ['a']);
    let c1 = readwriteDb.get(HELLO_KEY, ['c']);
    let b1 = readwriteDb.get(WORLD_KEY, ['a']);

    frp.attach(a1);
    frp.attach(a2);
    frp.attach(c1);
    frp.attach(b1);

    assertEquals('xxxhello-a', a1.unsafeMetaGet().get());
    assertEquals('xxxhello-a', a2.unsafeMetaGet().get());
    assertEquals('xxxhello-c', c1.unsafeMetaGet().get());
    assertEquals('xxxworld-a', b1.unsafeMetaGet().get());


    frp.accessTrans(function () {
        a1.set('goodbye');
    }, a1);

    assertEquals('goodbye', a1.unsafeMetaGet().get());
    assertEquals('goodbye', a2.unsafeMetaGet().get());
    assertEquals('xxxhello-c', c1.unsafeMetaGet().get());
    assertEquals('xxxworld-a', b1.unsafeMetaGet().get());


});

test("Set", () => {
    let frp = new Frp();
    let coms = new MyDb(true);
    let readwriteDb = new ReadWriteDatabase(frp, coms, schema);
    let readDb = new ReadOnlyDatabase(frp, readwriteDb);
    let readwriteB = readwriteDb.get(HELLO_KEY, ['a']);
    let readB = readDb.get(HELLO_KEY, ['a']);

    assertFalse(readB.unsafeMetaGet().ready());
    frp.attach(readB);
    assertFalse(readB.unsafeMetaGet().ready());
    coms.process();
    assertTrue(readB.unsafeMetaGet().ready());
    assertEquals('xxxhello-a', readB.unsafeMetaGet().get());

    assertFalse(readwriteB.unsafeMetaGet().ready());
    frp.attach(readwriteB);
    assertTrue(readwriteB.unsafeMetaGet().ready());

    //need to put compare in entity in object_manager

    assertEquals('xxxhello-a', readwriteB.unsafeMetaGet().get());

    frp.accessTrans(function () {
        readwriteB.set('goodbye');
    }, readwriteB);

    assertEquals('goodbye', readwriteB.unsafeMetaGet().get());
    assertEquals('xxxhello-a', readB.unsafeMetaGet().get());
    coms.process();
    assertEquals('goodbye', readwriteB.unsafeMetaGet().get());
    assertEquals('goodbye', readB.unsafeMetaGet().get());
    assertEquals('goodbye', coms.getValue(HELLO_KEY, 'a'));

    // Writing to the readwritedb the change should be reflected on the readdb and
    // write to the readdb and the change should not be on the readwritedb
    frp.accessTrans(function () {
        readwriteB.set('boo');
        readB.set('smokey');
    }, readwriteB, readB);

    coms.process();
    assertEquals(0, coms.processQueueSize());
    assertEquals('boo', readB.unsafeMetaGet().get());
    assertEquals('boo', readwriteB.unsafeMetaGet().get());

});

test("Delayed", () => {
    let frp = new Frp();
    let tm = frp.tm();
    let coms = new MyDb();

    let readwriteDb = new ReadWriteDatabase(frp, coms, schema);
    let delayedDb = new DelayedDatabase(frp, readwriteDb);


    let val1 = delayedDb.get(VAL_KEY, ["key1"]);
    let val2 = delayedDb.get(VAL_KEY, ["key1"]);

    tm.attach(val1);
    tm.attach(val2);

    assertEquals("xxxval-key1", val2.unsafeMetaGet().get());


    frp.accessTrans(function () {
        val1.set(0);
    }, val1);


    assertEquals(0, val2.unsafeMetaGet().get());

    let val3 = delayedDb.get(VAL_KEY, ["key1"]);
    tm.attach(val3);

    assertEquals(0, val3.unsafeMetaGet().get());

    assertEquals("xxxval-key1", coms.getValue(VAL_KEY, "key1"));

    delayedDb.flush();

    assertEquals(0, coms.getValue(VAL_KEY, "key1"));


    frp.accessTrans(function () {
        val1.set(1);
    }, val1);

    assertEquals(0, coms.getValue(VAL_KEY, "key1"));
    assertEquals(1, val3.unsafeMetaGet().get());

    delayedDb.clear();

    assertEquals(0, coms.getValue(VAL_KEY, "key1"));
    assertEquals(0, val3.unsafeMetaGet().get());

});

test("Unregister", () => {
    let frp = new Frp();
    let coms = new MyDb(false);
    let db = new ReadWriteDatabase(frp, coms, schema);

    let listB = db.get(LIST_KEY, ['List']);

    frp.attach(listB);
    frp.attach(listB);

    assertObjectEquals([{id: 1, v: 1}, {id: 2, v: 2}, {id: 3, v: 3}, {id: 4, v: 4}], listB.unsafeMetaGet().get());

    let a = coms.isActive(LIST_KEY, 'List');
    assertTrue(a);

    frp.detach(listB);
    assertTrue(a);

    frp.detach(listB);

    assertFalse(coms.isActive(LIST_KEY, 'List'));


});

test("GetList", () => {
    let frp = new Frp();
    let coms = new MyDb(false);
    let db = new ReadWriteDatabase(frp, coms, schema);
    let listB = db.get(LIST_KEY, ['List']) as Behaviour<any[]>;
    let list1B = db.get<number>(LIST_KEY, ['List']);
    let listItem0B = db.get(LIST_ITEM_KEY, [1]);
    let listItem1B = db.get(LIST_ITEM_KEY, [2]);
    let listItem2B = db.get(LIST_ITEM_KEY, [3]);
    let listItem3B = db.get(LIST_ITEM_KEY, [4]);

    frp.attach(listB);

    let val = listB.unsafeMetaGet().get();

    // current problems we are initialting a database read when we get these
    // items, we should not go to the database for sub items that is the coms
    // layers job to do if it wants, but what happens if we update via sub items
    // shouldn't register with a val stop this a bit

    assertObjectEquals([{id: 1, v: 1}, {id: 2, v: 2}, {id: 3, v: 3}, {id: 4, v: 4}], val);

    frp.attach(listItem0B);
    frp.attach(listItem1B);
    frp.attach(listItem2B);
    frp.attach(listItem3B);
    //currently there is no code to register subitems to the main list so
    //this is expected to fail
    assertObjectEquals({id: 1, v: 1}, listItem0B.unsafeMetaGet().get());
    assertObjectEquals({id: 2, v: 2}, listItem1B.unsafeMetaGet().get());
    assertObjectEquals({id: 3, v: 3}, listItem2B.unsafeMetaGet().get());
    assertObjectEquals({id: 4, v: 4}, listItem3B.unsafeMetaGet().get());

    frp.accessTrans(function () {
        listB.set([{id: 1, v: 11}, {id: 2, v: 12}, {id: 3, v: 13}, {id: 4, v: 14}]);
    }, listB);

    assertObjectEquals([{id: 1, v: 11}, {id: 2, v: 12}, {id: 3, v: 13}, {id: 4, v: 14}], listB.unsafeMetaGet().get());
    assertObjectEquals({id: 1, v: 11}, listItem0B.unsafeMetaGet().get());
    assertObjectEquals({id: 2, v: 12}, listItem1B.unsafeMetaGet().get());
    assertObjectEquals({id: 3, v: 13}, listItem2B.unsafeMetaGet().get());
    assertObjectEquals({id: 4, v: 14}, listItem3B.unsafeMetaGet().get());

    // testing delete and object, we need ownership
    frp.accessTrans(function () {
        listB.set([{id: 1, v: 21}, {id: 2, v: 22}, {id: 4, v: 24}]);
    }, listB);

    assertObjectEquals([{id: 1, v: 21}, {id: 2, v: 22}, {id: 4, v: 24}], listB.unsafeMetaGet().get());
    assertObjectEquals({id: 1, v: 21}, listItem0B.unsafeMetaGet().get());
    assertObjectEquals({id: 2, v: 22}, listItem1B.unsafeMetaGet().get());
    assertObjectEquals([NOT_PRESENT], listItem2B.unsafeMetaGet().errors());
    assertObjectEquals({id: 4, v: 24}, listItem3B.unsafeMetaGet().get());


    // test inserting
    frp.accessTrans(function () {
        listB.set([{id: 1, v: 11}, {id: 2, v: 12}, {id: 4, v: 14}, {id: 5, v: 15}]);
    }, listB);

    let listItem5B = db.get(LIST_ITEM_KEY, [5]);
    frp.attach(listItem5B);

    assertArrayEquals([{id: 1, v: 11}, {id: 2, v: 12}, {id: 4, v: 14}, {id: 5, v: 15}], listB.unsafeMetaGet().get());
    assertObjectEquals({id: 1, v: 11}, listItem0B.unsafeMetaGet().get());
    assertObjectEquals({id: 2, v: 12}, listItem1B.unsafeMetaGet().get());
    assertObjectEquals({id: 4, v: 14}, listItem3B.unsafeMetaGet().get());
    assertObjectEquals({id: 5, v: 15}, listItem5B.unsafeMetaGet().get());

    // test reference counting, are there any entries left in the object manager, are getting data from the database
    // what happens if we never use it does the item hang around
    let listItem6B = db.get(LIST_ITEM_KEY, [6]).debug("list 6");
    frp.attach(listItem6B);

    assertObjectEquals([NOT_PRESENT], listItem6B.unsafeMetaGet().errors());

    frp.accessTrans(function () {
        listItem6B.set({id: 6, v: 16});
    }, listItem6B);

    assertObjectEquals({id: 6, v: 16}, listItem6B.unsafeMetaGet().get());

    /*    assertArrayEquals([{id : 1, v : 11},{id : 2, v: 12}, {id : 4, v: 14}, {id : 5, v:15}, {id : 6 , v : 16}], listB.unsafeMetaGet().get());


        frp.accessTrans(function () {
            listB.set([{id : 1, v : 11}, {id : 2, v: 12},{id : 4, v : 14}, {id : 5, v : 15}, {id : 6 , v : 17}]);
        }, listB);


        assertArrayEquals([{id : 1, v : 11},{id : 2, v: 12}, {id : 4, v: 14}, {id : 5, v:15}, {id : 6 , v : 16}], listB.unsafeMetaGet().get());
        assertObjectEquals({id : 1, v : 11}, listItem0B.unsafeMetaGet().get());
        assertObjectEquals({id : 2, v : 12}, listItem1B.unsafeMetaGet().get());
        assertObjectEquals({id : 4, v : 14}, listItem3B.unsafeMetaGet().get());
        assertObjectEquals({id : 5, v : 15}, listItem5B.unsafeMetaGet().get());
        assertObjectEquals({id : 6, v : 17}, listItem6B.unsafeMetaGet().get());

    */

    // test other types of objects not just list, items avl, object
    // TODO also test geting the sub item first then the list
    // set sub items

    //TODO test reference counting cleanup

});

