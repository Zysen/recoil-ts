import Sequence from "../util/sequence.ts";
import {DbId} from "./dbid.ts";
import {QueryOptions} from "./query.ts";


/**
 * @final
 * @type {!recoil.util.Sequence}
 */
const DbIdSeq = new Sequence();

export interface DatabaseComms {


    /**
     * gets data from the database
     *
     * if this fails should throw a BStatus<T>
     * @param id identifier of the object that to be retrieve from the database
     * @param key the information we need to get the object/objects
     * @param options
     *
     */
    get<T>( id:DbId<T>, key:any, options:QueryOptions) : Promise<T>;

    /**
     * sets data to the database
     * if this fails should throw a BStatus<T>
     *
     * @param data to set
     * @param oldData old data that we already been received this can be used to only send changes
     * @param id identifier of the object that to be retrieve from the database
     * @param key the information we need to get the object/objects
     * @param options
     */

    set<T>(data:T, oldData:T, id:DbId<T> , key:any, options:QueryOptions):Promise<T>;

    /**
     * @param {!IArrayLike} values
     * @return {!Object}
     */
    makeKey(values:any[]):Record<string, any>;

    /**
     * instruct the database that we are no longer interested in the object
     * @template T
     * @param id identifier of the object that is to be retreived from the database
     * @param key the key to stop
     * @param options the key to stop
     */
    stop<T>(id:DbId<T>, key:any, options:QueryOptions):void;

    /**
     * called when a frp transaction is started
     */
    startTrans():void;

    /**
     * called when a frp transaction is ended, if you want to store changes up until every thing
     * is propogated use this
     */
    stopTrans() :void;

}