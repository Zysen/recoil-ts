import {Field, PathTableMap, QueryData, QueryHelper, QueryScope} from "../query.ts";
import {Escaper} from "./escaper.ts";
import {BasicDbId} from "../dbid.ts";
import {ColumnKey} from "../../structs/table/columnkey.ts";

export class SQLQueryHelper implements QueryHelper {
    private readonly escaper_: Escaper;

    constructor(escaper: Escaper) {
        this.escaper_ = escaper;
    }


    /**
     * @param {string} x
     * @param {string} y
     * @return {string}
     */
    and(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(', x, ' AND ', y , ')');
    }


    concat(values:QueryData[]):QueryData {
        return QueryData.join('concat(', ...QueryData.joinList(values, ','), ')');
    }


    /**
     * @param {string} value
     * @param {!Array<string>} list
     * @return {string}
     */
    in(value:QueryData, list:QueryData[]):QueryData {
        if (list.length === 0) {
            return QueryData.join('(1=2)');
        }
        return QueryData.join('(' , value , ' IN (' , ...QueryData.joinList(list), '))');
    }

    contains(scope:DBQueryScope, value:Field, list:QueryData[], all:boolean):QueryData {
        if (list.length === 0) {
            return QueryData.join('(1=1)');
        }
        // this should only be called for tables names that we gernerate so no need to escape
        let col = (t:string, col:string) => {
            return t + '.' + col;
        };
        let safeCol = (t:string|null, col:string)=> {
            return (t === null ? '' : this.escaper_.escapeId(t) + '.') + this.escaper_.escapeId(col);
        };
        let t1 = scope.nextTable();
        let t2 = scope.nextTable();
        let t3 = scope.nextTable();

        let childPath = scope.getChildPath(value);
        if (childPath.length === 0) {
            return new QueryData('(1=2)', []);
        }
        let last = childPath[childPath.length - 1];

        let eValueCol = this.escaper_.escapeId(last.col);
        let eParentCol = this.escaper_.escapeId(last.parent);
        let eValTable = this.escaper_.escapeId(last.table);


        let itemSelect = QueryData.join(
            'SELECT DISTINCT ' + col(t1, eParentCol) ,
            (all ? ',' + col(t1, eValueCol) : ''),
            ' FROM ' + eValTable + ' ' + t1 + ' WHERE ' + col(t1, eValueCol) + ' IN (',
            ...QueryData.joinList(list.map((v)=> {
                return new QueryData(null, [v]);
            })),')');

        let parentSelect:QueryData;
        if (all) {
            let countSelect = 'SELECT ' + col(t2, eParentCol) + ' parent, count(' + col(t2, eValueCol) + ') c  FROM (' + itemSelect + ') ' + t2 + ' GROUP BY ' + col(t2, eParentCol);
            parentSelect = QueryData.join(
                '(SELECT ' + col(t3, 'parent') + ' FROM (' + countSelect + ')  ' + t3 + ' WHERE ' + col(t3, 'c') + ' = ',
                new QueryData(null, [list.length]),  ')');
        } else {
            parentSelect = QueryData.join('(', itemSelect, ')');
        }
        // go up the parent hierachy until it is the root object
        for (let i = childPath.length - 2; i >= 0; i--) {
            let cur = childPath[i];
            let tbl = scope.getTableAlias(childPath.slice(0, i).map(v => v.table));
            parentSelect = QueryData.join(safeCol(tbl, cur.id) , ' IN ' , parentSelect);
            if (i > 1) {
                parentSelect = QueryData.join(
                    '(SELECT ', this.escaper_.escapeId(cur.parent) , ' FROM ',
                    this.escaper_.escapeId(cur.parent) , ' WHERE ' , parentSelect , ')');
            }
        }
        return parentSelect;
    }
    notIn(value:QueryData, list:QueryData[]):QueryData {
        if (list.length === 0) {
            return QueryData.join('(1=1)');
        }
        return QueryData.join('(', value , ' NOT IN (', ...QueryData.joinList(list), '))');
    }
    or(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(' , x , ' OR ', y , ')');
    }
    not(x:QueryData):QueryData {
        return QueryData.join('(NOT ', x , ')');
    }
    lessThanOrEqual(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(', x , ' <= ' , y , ')');
    }
    lessThan(x:QueryData, y:QueryData) {
        return QueryData.join('(' , x , ' < ' + y , ')');
    }
    greaterThanOrEqual(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(' , x , ' >= ' , y , ')');
    };

    /**
     * @param {string} x
     * @param {string} y
     * @return {string}
     */
    greaterThan(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(' , x , ' > ' + y , ')');
    }

    true():QueryData {
        return QueryData.join('(1 = 1)');
    }
    false():QueryData {
        return QueryData.join('(2 = 1)');
    }

    value(val:any):QueryData {
        return new QueryData(null, [val]);
    }

    field(scope: QueryScope, path:[ColumnKey<any>] | [string, ...string[]]):QueryData {
        let escaper = this.escaper_;
        let resolved = (scope as DBQueryScope).resolve(path);
        if (resolved.chain && resolved.field) {
            //    4 = (SELECT mentorid FROM `user` u WHERE (u.id = t0.userid))))
            let last = resolved.field[resolved.field.length - 1];
            let lastTable = resolved.field[resolved.field.length - 2];


            let sql = QueryData.join('(SELECT DISTINCT ' + escaper.escapeId(resolved.chain[lastTable]!) + '.'
                + escaper.escapeId(last));
            let tables:QueryData[] = [];
            let fields:QueryData[] = [];
            for (let i = 2; i < resolved.field.length - 2; i += 2) {
                let table = resolved.field[i];
                fields.push(QueryData.join(escaper.escapeId(resolved.field[i - 1]) + ' = ' + escaper.escapeId(resolved.field[i + 1])));
                tables.push(QueryData.join(escaper.escapeId(table) + ' ' + escaper.escapeId(resolved.chain[table]!)));
            }
            sql = QueryData.join(sql, ' FROM ', ...QueryData.joinList(tables) + ' WHERE ', ...QueryData.joinList(fields, ' AND '),')');
            return sql;
        }
        if (resolved.field !== undefined) {
            return QueryData.join(...QueryData.joinList(resolved.field.map((v)=> new QueryData(escaper.escapeId(v), [])),'.'));
        } else {
            return new QueryData(null, [resolved.value]);
        }

    }

    exists(value:QueryData, exists:boolean):QueryData {
        if (exists) {
            return QueryData.join('(EXISTS ', value , ')');
        }
        return QueryData.join('(NOT EXISTS ' , value , ')');

    }

    /**
     * @param {string} x
     * @param {string} y
     * @return {string}
     */
    notEquals(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(', x,' <> ', y,')');

    }

    private makeLike(val: QueryData, prefix:string|null, data: string, suffix:string|null):QueryData {
        let needsEscape = data.includes("%");


        let parts:(QueryData|string)[] = ['(', val, ' LIKE '];

        if (needsEscape) {
            let escaped =  data.replaceAll("\\", "\\\\").replaceAll("%", "\\%");
            let match= (prefix||"") + escaped + (suffix || "");

            parts.push(new QueryData(null, [match]));
            parts.push(" ESCAPE '\\\\'");
        }
        else {
            let match= (prefix||"") + data + (suffix || "");
            parts.push(new QueryData(null, [match]));
        }
        parts.push(')');
        return QueryData.join(...parts);

    }

    startsWith(x:QueryData, y:string):QueryData {
        return this.makeLike(x, null, y, '%' );
    }
    containsStr(x:QueryData, y:string):QueryData {
        return this.makeLike(x, '%', y, '%' );
    }

    equals(x:QueryData, y:QueryData):QueryData {
        return QueryData.join('(', x,' = ', y,')');

    }

    isNull(x:QueryData) {
        return QueryData.join('(', x,' IS NULL)');
    }
}

export class DBQueryScope extends QueryScope {
    private colMap_: PathTableMap;
    private tableCount_: number;
    private childPath_: (v: any) => ({ id: string, parent: string, col: string, table: string })[]

    constructor(map: Map<string, any>, helper: QueryHelper, childPath: (v: any) => ({
        id: string,
        parent: string,
        col: string,
        table: string
    }[])) {
        super(map, helper);
        this.colMap_ = new PathTableMap();
        this.tableCount_ = 0;
        this.childPath_ = childPath;
    }


    /**
     * @return {!Array<{id: string, parent: string, col: string, table:string}>}
     */
    getChildPath(field:Field):{id: string, parent: string, col: string, table: string}[] {
        return this.childPath_(field.path());
    }

    /**
     * @param path
     * @param columns
     * @return the name of the table added
     */
    addPathTable(path:string[], columns:ColumnKey<any>[]):string {
        return this.addPathNamedTable(path, columns, undefined);
    }


    /**
     * @param path the path to the table from the root
     * @param columns
     * @param tname
     * @return the name of the table added
     */
    addPathNamedTable(path:string[], columns:ColumnKey<any>[], tname?:string):string {
        let table = tname === undefined ? this.nextTable() : tname;
        this.colMap_.setTable(path, columns, table);
        return table;
    }

    getTableAlias(path:string[]) {
        return this.colMap_.getTableAlias(path);
    }


    /**
     * gets a unique table name from the scope
     * @return {string}
     */
    nextTable() {
        let table = 't' + this.tableCount_;
        this.tableCount_++;
        return table;
    }

    private colToString(col:string|ColumnKey<any>):string {
        return col instanceof  ColumnKey ? col.getName() : col;
    }
    /**
     * @param parts indexes to get the object
     * @return {{field:(!Array<string>|undefined),value:(?|undefined)}}
     */
    resolve(parts:(ColumnKey<any>|string)[]): {field?:string[], value?:any, chain?:Record<string, string|null>} {
        if (parts.length === 0) {
            throw 'No parts in path specified';
        }
        if (parts.length == 1 && typeof(parts[0]) === 'string' && this.map_.hasOwnProperty(parts[0])) {

            return {value: this.map_[parts[0]]};
        }

        if (parts.length > 0 && parts[parts.length - 1] instanceof ColumnKey) {

            let table = this.colMap_.getTable(parts);
            if (!table && parts.length === 1 && parts[0] instanceof ColumnKey) {
                return {field: [parts[0].getName()]};
            }
            let last = parts[parts.length - 1];

            if (table === null) {
                return {field: [this.colToString(last)]};

            }
            return {field: [table, this.colToString(last)]};
        }
        let tbl = this.colMap_.getTableAlias(parts.slice(0, parts.length - 1));

        if (tbl === '' && parts.length === 1) {
            // if we only have one table this is ok
            return {field: [this.colToString(parts[parts.length - 1])]};
        }

        if (!tbl) {
            let childPath = this.childPath_(parts);
            if (childPath.length > 0) {
                let res:{field:string[], chain:Record<string, string|null>} = {field: [], chain: {}};
                let alias = this.colMap_.getTableAlias([]);
                for (let i = 0; i < childPath.length; i++) {
                    let item = childPath[i];
                    let next = childPath[i + 1];
                    res.chain[item.table] = alias;
                    res.field.push(item.table);
                    res.field.push(item.col ? item.col : item.id);

                    if (next) {
                        alias = this.nextTable();
                        res.field.push(next.table);
                        res.field.push(item.col ? next.id : next.parent);
                    }

                }
                return res;
            }

            throw 'Unable to find table for ' + parts.join('/');
        }
        return {field: [tbl, this.colToString(parts[parts.length - 1])]};
    }


}
