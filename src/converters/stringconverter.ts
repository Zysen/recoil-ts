import {TypeConverter, UnconvertType} from "./typeconverter.ts";
import {Messages} from "../ui/messages.ts";

export interface StringConverter<T> extends TypeConverter<T, string> {

}

export class DefaultStringConverter implements StringConverter<string> {
    unconvert(val: string): UnconvertType<string> {
        return {value: val};
    }
    convert(val: string): string {
        return val != undefined ? val : '';
    }
}

/**
 * trims the input on unconvert guaranteeing that the data is always trimmed
 */
export class TrimStringConverter implements StringConverter<string> {
    convert(val: string): string {
        return val != undefined ? val : '';
    }
    unconvert(val: string): UnconvertType<string> {
        return {value: val.trim()};
    }

}

/**
 * this converter takes any string converter and handles null
 * values by converting them to an empty string
 */

export class NullStringConverter<Type> implements StringConverter<Type|null> {
    private subconverter_: StringConverter<Type>;
    constructor(subconverter: StringConverter<Type>) {
        this.subconverter_ = subconverter;
    }
    convert(val: Type|null): string {
        if (val === null || val === undefined) {
            return '';
        }
        return this.subconverter_.convert(val);
    }
    unconvert(val: string): UnconvertType<Type|null> {
        if (val === '') {
            return {value: null};
        }
        return this.subconverter_.unconvert(val);
    }
}


/**
 * does no actual coversions, however will match a regular expression
 * on the uncovert stage
 */

export class RegExpConverter implements StringConverter<string> {
    private regExp_: RegExp;

    constructor(regExp: RegExp) {
        this.regExp_ = regExp;

    }
    convert(val: string): string {
        return val
    }
    unconvert(val: string): UnconvertType<string> {
        if (val && val.match(this.regExp_)) {
            return {value: val};
        }
        return {error: Messages.INVALID_VALUE_0.resolve({val})};
    }

    clone() {
        return this;
    }
}

export class MinLength implements StringConverter<string> {
    private len_: number;

    constructor(len: number) {
        this.len_ = len;
    }

    convert(val: string): string {
        return val;
    }
    unconvert(val: string): UnconvertType<string> {
        if (val && val.length >= this.len_) {
            return {value: val};
        }
        return {error: Messages.MUST_BE_AT_LEAST_0_CHARACTORS.resolve({n: this.len_})};
    }
}

