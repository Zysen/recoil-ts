import {Database} from "./database.ts";
import {DbId} from "./dbid.ts";
import {Query, QueryOptions} from "./query.ts";
import {Behaviour, BStatus, Frp, FrpEvent} from "../frp/frp.ts";
import {AvlTree} from "../structs/avltree.ts";
import {compareKey} from "../util/object.ts";
import {Action, create} from "../frp/change_manager.ts";

export class DelayedDatabase implements Database {
    private readonly source_: Database;
    private readonly frp_:Frp;
    private readonly changed_ = new AvlTree<{key:any, value: any, refs:number}, {key:number}>(compareKey);
    private readonly changeEvent_: FrpEvent<Symbol>;
    /**
     * A database that will not send data to the server until an event is sent to
     */

    constructor(frp:Frp, source:Database) {
        this.source_ = source;
        this.frp_ = frp;
        this.changeEvent_ = frp.createE();
    }


    /**
     * writes all the data out to the database
     */
    flush() {
        let me = this;
        this.frp_.accessTrans(function() {
            me.changeEvent_.set(Action.FLUSH);
        }, this.changeEvent_);
    }


    /**
     * loose all the changes
     */
    clear() {
        let me = this;
        this.frp_.accessTrans(function() {
            me.changeEvent_.set(Action.CLEAR);
        }, this.changeEvent_);
    }

    makeKey(values: any[]):any {
        return this.source_.makeKey(values);
    }

    /**
     * Returns a behaviour, with a value that we can get, set etc
     * @template T
     * @param id an id to identify the type of object you want
     * @param primaryKeys primary keys of the object you want to get
     * @param opt_options extra option to the query such as poll rate or notify
     * @return the corresponding object
     */

    get<Type>(id:DbId<Type>, primaryKeys:any[]|Query, opt_options?:QueryOptions):Behaviour<Type> {

        let key = this.source_.makeKey([id, primaryKeys, opt_options]);
        let frp = this.frp_;
        let changedIn = frp.createB(frp.createMetaB(BStatus.notReady()));
        let changedOut = frp.switchB(changedIn);
            changedOut.refListen((hasRef)=> {
                let changedVal = this.changed_.findFirst({key: key});
                if (hasRef) {
                    frp.accessTrans(()=> {
                        if (changedVal) {
                            changedVal.refs++;
                            if (changedIn.get() !== changedVal.value) {
                                changedIn.set(changedVal.value);
                            }
                        }
                        else {
                            this.changed_.add({key: key, refs: 1, value: changedIn.get()});
                        }
                    }, changedIn);
                }
                else {
                    if (changedVal) {
                        changedVal.refs--;
                        // TODO would really like to remove from the changed map only if there are not changes
                        if (changedVal.refs === 0 && !changedVal.value.ready()) {
                            this.changed_.remove(changedVal);
                        }
                    }
                }
            });
        let databaseB = this.source_.get(id, primaryKeys, opt_options);
        return create(frp, databaseB, changedOut, this.changeEvent_);
    }
}