import {Database} from "./database.ts";
import {Behaviour, BStatus, Frp} from "../frp/frp.ts";
import {DatabaseComms} from "./comms.ts";
import {DbId} from "./dbid.ts";
import {Query, QueryOptions} from "./query.ts";
import {SendInfo} from "./manager/sendinfo.ts";
import {ChangeDb} from "./changedb.ts";
import {Schema} from "./schema.ts";


type CacheKey = {id: DbId<any>,  primaryKeys?: any[] | Query, options?: QueryOptions};

export class ReadWriteDatabase implements Database {
    private frp_: Frp;
    private comms_: DatabaseComms;
    private db_: ChangeDb;
    // we could make an order based weak map to cache this


    /**
     * @param frp the associated FRP engine
     * @param dbComs the interface to get and set data to the backend
     */

    constructor(frp: Frp, dbComs: DatabaseComms, schema: Schema) {
        this.frp_ = frp;
        this.comms_ = dbComs;
        this.db_ = new ChangeDb(schema);
    }

    get<T>(id: DbId<T>, primaryKeys?: any[] | Query, options?: QueryOptions): Behaviour<T> {
        return ReadWriteDatabase.showSending_(this.frp_, this.getSendInfo(id, primaryKeys || [], options));
    }

    makeKey(values: any[]): Record<string, any> {
        return this.comms_.makeKey(values);
    }

    getSendInfo<T>(id: DbId<T>, primaryKeys?: any[] | Query, opt_options?:QueryOptions):Behaviour<SendInfo<T>>  {
        let valueB = this.frp_.createNotReadyB<SendInfo<T>>();
        let dbComs = this.comms_;
        let frp = this.frp_;
        let options = opt_options || new QueryOptions();

        let remover: (() => void)|null = null;
        let filter = id.getFilter(primaryKeys, opt_options);
        valueB.refListen(
            (used:boolean)=> {
                frp.accessTrans(()=> {
                    if (used) {
                        if (!remover) {
                            remover = this.db_.addReference(id.getPath(), (val: T) => {
                                valueB.set(SendInfo.create(val, true));
                            }, filter);

                            dbComs.get(id, primaryKeys, options)
                                .then(result => {
                                    this.db_.set(id.getPath(), result, filter);
                                })
                                .catch(e => {
                                    valueB.metaSet(BStatus.errors([e]))
                                });
                        }
                    }
                    else {
                        if (remover) {
                            remover();
                            remover = null;
                            valueB.metaSet(BStatus.notReady());
                        }
                    }
                }, valueB);
            });

        return valueB;
    }

    /**
     * removes the send info from around the object, the send info object allows us to keep both the
     * information that we receive from the server and data we have sent to the server but not yet received
     *
     * this means we can show the user what we expect the data to be, and you don't get it flipping between the values
     *
     * @param frp
     * @param uniq
     */
    static showSending_<T>(frp:Frp, uniq:Behaviour<SendInfo<T>>):Behaviour<T> {
        return frp.metaLiftBI<T, T, T, T>(
            (valStatus:BStatus<SendInfo<T>>) =>{
                if (valStatus.good()) {
                    let val = valStatus.get();
                    return new BStatus<T>(val.isSending() ? val.getSending() : val.getStored());
                }
                else if (valStatus.errors()) {
                    return BStatus.errors(valStatus.errors());

                } else {
                    return BStatus.notReady();
                }
            },
            (val:BStatus<T>)=> {
                // it is possible that we haven't actually recieved a value yet
                let toSend = uniq.metaGet().good() ? uniq.get() : SendInfo.notSet<T>(true);
                uniq.set(toSend.setSending(val.get(), true));
            }, uniq);
    }
}






