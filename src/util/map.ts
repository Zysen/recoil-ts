export function safeGet<KeyType,ValueType>(map: Map<KeyType,ValueType>, key:KeyType, def:ValueType):ValueType {
    if (map.has(key)) {
        return map.get(key)!;
    }
    map.set(key, def);
    return def;
}