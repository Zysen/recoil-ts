import type {Schema} from "./schema.ts";
import {AvlTree} from "../structs/avltree.ts";
import {Path, PathItem} from "./path.ts";
import {ChangeDbInterface, FilterGetter, ReferenceFilter, trueFilter} from "./changedb.ts";
import {compareKey} from "../util/object.ts";
import {Serializable} from "../util/serializable.ts";
import {Primitive} from "./changeset.ts";

const PRIMITIVE_TYPES = ["number", "string", "boolean"];
export interface DbGenericType<OutType> {
    deserialize(value: Serializable): OutType;
    serialize(value: OutType): Serializable;
}


export interface ObjectListDef {
    type: "object-list",
    nullable?: true,
    ordered?: true,
    keys: string[];
    fields: Record<string, FieldDef>;
}

export interface ListDef {
    type: "list",
    nullable?: true,
    elementType: PrimitiveDef | ListDef | ObjectListDef | ObjectDef;
}

export interface ObjectDef {
    type: "object",
    nullable?: true,
    fields: Record<string, FieldDef>;
}

export interface PrimitiveDef {
    type: "number" | "string" | "boolean" | DbGenericType<any>;
    nullable?: true;
}


export type FieldDef = ObjectListDef | ListDef | ObjectDef | PrimitiveDef;

export class BasicSchema implements Schema {

    private roots_: Record<string, FieldDef> = {};
    private aliases_ = new AvlTree<{ key: Path, filter: ReferenceFilter, realPath: Path }, { key: Path }>(compareKey);


    resolve(path: Path):FieldDef|null {
        let parts = this.absolute(path).items();
        let cur = this.roots_;

        for (let i = 0; i < parts.length; i++) {
            let p = parts[i];
            let def = cur[p.name()]
            if (def) {
                for (let idx of p.getIndexes()) {
                    if (def.type !== "list") {
                        return null;
                    }
                    def = def.elementType;
                }

                if (i === parts.length - 1) {
                    return def;
                }
                if ('fields' in def) {
                    cur = def.fields;
                }
            }
            else {
                return null;
            }
        }

        return null;
    }

    register(path: string, def: FieldDef) {
        this.roots_[path] = def;
    }

    registerAlias(alias: Path,  realPath: Path, filter:ReferenceFilter = trueFilter) {
        this.aliases_.add({key: alias, filter, realPath});

    }

    getAliasFilter(alias: Path, filter: ReferenceFilter): ReferenceFilter {
        let entry = this.aliases_.findFirst({key: alias});
        if (entry) {
            return entry.filter;
        }
        return filter;
    }

    children(path: Path): string[] {
        let def = this.resolve(path);
        if (def) {
            if ('fields' in def) {
                return Object.keys(def.fields);
            }
        }
        return [];
    }

    isOrderedList(path: Path): boolean {
        let def = this.resolve(path);
        return !!(def && 'ordered' in def && def.ordered);
    }

    isCreatable(path: Path): boolean {
        throw new Error("Method not implemented.");
    }

    applyDefaults(path: Path, db: ChangeDbInterface): void {
        throw new Error("Method not implemented.");
    }

    exists(path: Path): boolean {
        let def = this.resolve(path);
        if (def && def.nullable) {
            return true;
        }
        return true;
    }

    isPartial(path: Path): boolean {
        return false;
    }

    keys(path: Path): string[] {
        let def = this.resolve(path);
        return def && 'keys' in def ? def.keys : [];
    }

    isLeaf(path: Path): boolean {
        let def = this.resolve(path);
        if (!def) {
            // anything without a definition is a leaf otherwise we can just
            // go into container inside container
            return true;
        }
        if (typeof def.type !== 'string') {
            return true;
        }
        return PRIMITIVE_TYPES.includes(def.type);
    }
    allowNullValue(path: Path, val: null | undefined): boolean {
        let def = this.resolve(path);
        return !!def?.nullable;
    }

    isKeyedList(path: Path): boolean {
        let def = this.resolve(path);
        if (def && 'keys' in def  && def.keys.length > 0 && def.type == "object-list") {
            return def.keys.length > path.keys().length;
        }
        return false;
    }

    deserialize(path: Path, val: Serializable): any {
        let def = this.resolve(path);
        if (!def) {
            return val;
        }

        if (typeof def.type === 'string') {
            return val;
        }
        return def.type.deserialize(val);
    }
    serialize(path: Path, val: any): Serializable {
        let def = this.resolve(path);
        if (!def) {
            return val;
        }

        if (typeof def.type === 'string') {
            return val;
        }
        return def.type.serialize(val);
    }

    isList(path: Path): boolean {
        let def = this.resolve(path);
        if (this.isKeyedList(path)) {
            return true;
        }
        return !!(def && (def.type == "list"));
    }

    absolute(path: Path): Path {
        let cur = path;
        let itemsToAdd: PathItem[] = [];

        while (cur.length() > 0) {
            let found = this.aliases_.findFirst({key: cur});
            if (found) {
                return found.realPath.appendItems(itemsToAdd);
            }
            if (cur.lastKeys().length > 0) {
                let last = cur.last();
                cur = cur.unsetKeys();
                found = this.aliases_.findFirst({key: cur});
                if (found) {
                    return found.realPath.setKeys(last.keyNames(), last.keys()).appendItems(itemsToAdd)
                }
            }
            itemsToAdd.unshift(cur.last())
            cur = cur.parent();
        }
        return path;
    }

    createKeyPath(path: Path, obj: Record<string, any>): Path {
        let def = this.resolve(path);
        let keys: any[] = [];
        if (def !== null && ('keys' in def)) {
            def.keys.forEach((key) => {
                keys.push(obj[key]);
            });
            return path.setKeys(def.keys, keys);
        }
        return path;
    }

    /**
     * makes a simple filter that starts the base path, and only accepts fields that are in the list
     * @param basePath
     * @param fields
     */
    static makeSimpleFilter(basePath: Path, ...fields: string[]) {
        let fieldSet = new Set(fields);
        return (_filter: FilterGetter, path: Path)=> {
            if (path.isAncestor(basePath, true)) {
                return true;
            }
            if (!basePath.isAncestor(path, true)) {
                return false;
            }

            if (path.size() === basePath.size() + 1) {
                return fieldSet.has(path.lastName());
            }

            return true;
        };
    }

    /**
     * makes a filter that will only include paths and ancestors and descendants of the paths
     * @param paths
     */
    static makeExclusiveFilter(...paths: Path[]) {
        return (_filter: FilterGetter, path: Path)=> {
            for (let p of paths) {
                if (path.isAncestor(p, true)) {
                    return true;
                }
                if (p.isAncestor(path, true)) {
                    return true;
                }
            }
            return false;
        };
    }

}
