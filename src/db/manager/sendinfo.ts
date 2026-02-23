/**
 * data that represents the current value read from
 * the database and any information that was sent
 * @constructor
 * @template T
 * @param {T} value the value read from the database
 * @param {boolean} toplevel
 */

const IDLE = Symbol("idle")
const NO_SET = Symbol("idle");

export class SendInfo<T> {
    private sending_: T|Symbol ;
    private toplevel_: boolean;
    private value_: T|Symbol;

    private constructor(value: T|Symbol, toplevel: boolean) {
        this.value_ = value;
        this.toplevel_ = toplevel;
        this.sending_ = IDLE;

    }

    static notSet<T>(topLevel: boolean): SendInfo<T> {
        return new SendInfo<T>(NO_SET, topLevel);
    }
    static create<T>(value:T, topLevel: boolean): SendInfo<T> {
        return new SendInfo<T>(value, topLevel);
    }

    /**
     * @return {T} maybe IDLE if not sending anything
     */
    getSending(): T {
        if (this.sending_ instanceof Symbol) {
            throw new Error("Can't get sending of idle");
        }
        return this.sending_;
    }


    setSending(value: T, toplevel: boolean): SendInfo<T> {
        let res = new SendInfo(this.value_, toplevel);
        res.sending_ = value;
        return res;
    }

    isSending():boolean {
        return !(this.sending_ instanceof Symbol);
    }
    /**
     * returns if object is a top level object, this is used to determine
     * if we should send the data to the database
     */
    isToplevel(): boolean {
        return this.toplevel_;
    }

    /**
     * @param {T} value
     * @param {boolean} toplevel
     * @return {!recoil.db.SendInfo<T>}
     */
    setRead(value: T, toplevel: boolean): SendInfo<T> {
        let res = new SendInfo(value, toplevel);
        return res;
    }

    getStored(): T {
        if (this.value_ instanceof Symbol) {
            throw new Error("Can't get stored of not set");
        }
        return this.value_;
    }
}