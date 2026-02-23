import {Behaviour, Frp} from "../frp/frp.ts";
import {Database} from "./database.ts";
import {ReadWriteDatabase} from "./readwritedb.ts";
import {SendInfo} from "./manager/sendinfo.ts";
import {DbId} from "./dbid.ts";
import {Query, QueryOptions} from "./query.ts";

export class ReadOnlyDatabase implements Database {
    private frp_: Frp;
    private db_: ReadWriteDatabase;

    /**
     * @param frp the associated FRP engine
     * @param db
     */
    constructor(frp: Frp, db: ReadWriteDatabase) {
        this.frp_ = frp;
        this.db_ = db;
    }

    makeKey(values: any[]) {
        return this.db_.makeKey(values);
    }

    /**
     * gets an individual object from the database
     * @template T
     * @param {!recoil.db.Type<T>} id an id to identify the type of object you want
     * @param {(!Array<?>|!recoil.db.Query)=} opt_primaryKeys primary keys of the object you want to get
     * @param {recoil.db.QueryOptions=} opt_options extra option to the query such as poll rate or notify
     * @return {!recoil.frp.Behaviour<T>} the corisponding object
     */
    get<T>(id:DbId<T>, primaryKeys: any[]|Query, options?: QueryOptions): Behaviour<T>{
        return this.frp_.liftB(function (v) {
            return v.getStored();
        }, this.db_.getSendInfo(id, primaryKeys || [], options));
    }

    private filterSending_<T>(frp:Frp, uniq:Behaviour<SendInfo<T>>):Behaviour<T> {
        return frp.liftB(
            function(val) {
                return val.getStored();
            },uniq);

    }

}