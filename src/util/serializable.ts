export type BasicType = null|number|string|boolean;

interface SerializableArray extends Array<BasicType|SerializableArray|SerializableRecord> {
}


export interface SerializableRecord extends Record<string, SerializableRecord|BasicType|SerializableArray>{
}

export type Serializable = BasicType| SerializableRecord|SerializableArray;