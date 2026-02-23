import {Behaviour, Frp} from "../frp/frp.ts";
import {DbId} from "./dbid.ts";
import {Query, QueryOptions} from "./query.ts";

export const NOT_PRESENT = Error("NOT_PRESENT");

export interface Database {
    makeKey(value: any[]): any;
    /**
     * gets an individual object from the database
     * @param id an id to identify the type of object you want
     * @param primaryKeys primary keys of the object you want to get
     * @param opt_options extra option to the query such as poll rate or notify
     * @return the corisponding object
     */
    get<T>(id:DbId<T>, primaryKeys: any[]|Query, options?: QueryOptions): Behaviour<T>;
}





