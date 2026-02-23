import test from "node:test";
import {DefaultPathCompressor, Path} from "./path.ts";
import {assertObjectEquals} from "../test.ts";
import {Add, ChangeType, Delete, deserializeChange, Move, SetChange} from "./change.ts";
import {StructType} from "../frp/struct.ts";
import {BasicSchema} from "./basicschema.ts";


test("Serialize", () => {
    let schema  = new BasicSchema();
    schema.register("obj1", {
        type: "object",
        fields: {
            a: {type: "string"},
            b: {
                type: "object",
                fields: {
                    c: {type: "string"},
                }
            }
        }
    })
    schema.register("a", {
        type: "object",
        fields: {
            b: {
                type: "object",
                fields: {
                    c: {
                        type: "object-list",
                        keys: ["k"],
                        fields: {
                            k: {type: "string"},
                        }
                    },
                    d: {type: "string"},
                }
            },
            b1: {type: "string"},
        },
    });

    schema.register("adel", {
        type: "object",
        fields: {
            b: {
                type: "object",
                fields: {
                    c: {
                        type: "object-list",
                        keys: ["k"],
                        fields: {
                            k: {type: "string"},
                            d: {
                                type: "object",
                                fields: {
                                    e: {type: "number"},
                                }
                            }
                        }
                    }
                },
            },
            b1: {type: "number"},
        }
    });

    schema.register("a1", {
       type:"object",
        fields: {
           b1: {type:"number"}
        }
    });

    schema.registerAlias(Path.fromString("/test/a"), Path.fromString("a1"));

    schema.register("e", {
                type: "object",
                fields: {
                    f: {
                        type: "object",
                        fields: {
                            g: {
                                type: "object-list",
                                keys: ["k"],
                                fields: {
                                    k: {type: "number"},
                                }
                            },
                        }
                    },
                }

    });

    schema.register("key1", {
        type: "object-list",
        keys: ["k"],
        fields: {
            k: {type: "number"},
            v: {type: "number"},
        }
    })

    schema.register("full", {
        type: "object",
        fields: {
            k1: {
                type: "object-list",
                keys: ["k"],
                fields: {
                    k: {type: "number"},
                    a: {type: "number"}

                }
            },
            a: {
                type: "object",
                fields:{
                    v: {type: "number"},
                    v2: {type: "number"},
                    list: {
                        type: "object-list",
                        keys: ["k"],
                        fields:{
                            k: {type: "number"},
                            v: {type: "number"},
                            v2: {type: "number"}
                        }
                    },

                }
            }
        }
    });

    schema.register("ordered", {
        type: "object-list",
        ordered: true,
        keys: ["k"],
        fields: {
            k: {type: "number"},
            v: {type: "number"}
        }
    });

    schema.register("list-a", {
        type: "object-list",
        keys: ["k"],
        fields: {
            k: {type: "number"},
            v: {type: "number"},
            c: {
                type: "object",
                fields: {
                    t: {type: "number"},
                }
            }
        }

    });

    schema.register("cont", {
        type: "object",
        fields: {
            c1: {
                type: "object",
                fields: {
                    c2: {type:"number"}
                }
            },
        }
    });

    schema.registerAlias(Path.fromString("named-a"), Path.fromString("full/a"), (getter, path) => {
        return path.pathAsString() !== "/named-a/v1";
    });


    let path = Path.fromString('/a/b/c').setKeys(['k'], [2]);
    let delPath = Path.fromString('/adel/b/c');
    let path2 = Path.fromString('/e/f/g').setKeys(['k'], [3]);
    let compressor = new DefaultPathCompressor ();
    let vser = {
        serialize: function (path:Path,  v:any) {
            return v;
        },
        deserialize: function (path:Path, v:any) {
            return v;
        }
    };
    assertObjectEquals({parts:'a/b/c', params:[2]},path.serialize(vser, compressor));
    assertObjectEquals(path, Path.deserialize(path.serialize(vser, compressor), schema, vser,compressor));

    let set = new SetChange(path, 1, 2);
    let move = new Move(path, path2);
    let add = new Add(path,[set]);
    let del = new Delete(delPath, [{k:1, d: {e: 'x0', e1: '1'}}]);
    assertObjectEquals(move, deserializeChange(move.serialize(true, schema, vser), schema, vser));
    assertObjectEquals(set, deserializeChange(set.serialize(true, schema, vser), schema, vser));
    assertObjectEquals(add, deserializeChange(add.serialize(true, schema, vser), schema, vser));
    assertObjectEquals(del, deserializeChange(del.serialize(true, schema, vser), schema, vser));
    let res:StructType = set.serialize(true, schema, vser);
    assertObjectEquals({type: ChangeType.SET, old: 1, new: 2,
        path:{parts:'a/b/c', params:[2]}}, res);

    res = del.serialize(true, schema, vser);
    assertObjectEquals({type: ChangeType.DEL, ///path: '/adel/b/c',
        orig: [{k:1, d: { e: 'x0', e1: '1'}}],
        path:{parts:'adel/b/c', params:[]}}, res);
    del = new Delete(delPath.setKeys(['k'],[1]), {k:1, d: {e: 'x0', e1: '1'}});


    // check it serializes keys and values
});
