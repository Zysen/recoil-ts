/**
 * a boolean with an explanation
 * this is useful for enabling and disabling items
 * on the screen and providing a tooltip showing way something is disabled
 */

import {Message} from "./message.ts";
import {Behaviour, BehaviourList1, BStatus, Frp, Status} from "../frp/frp.ts";
import {Messages} from "./messages.ts";
import {Util} from "../frp/util.ts";

export class BoolWithExplanation {
    private val_:boolean;
    private true_:Message|null;
    private false_:Message|null;

    constructor(val:boolean)
    constructor(val:boolean, trueMessage:Message)
    constructor(val:boolean, trueMessage:Message|null, falseMessage:Message|null)
    constructor(val: boolean, trueMessage?:Message|null, falseMessage?: Message|null) {
        this.val_ = val;
        if (falseMessage === undefined && trueMessage !== undefined) {
            this.true_ = val ? trueMessage : null;
            this.false_ = !val ? trueMessage : null;

        }
        else {
            this.true_ = trueMessage ? trueMessage : null;
            this.false_ = falseMessage ? falseMessage : null;
        }

    }
    val():boolean {
        return this.val_;
    }

    reason() :Message|null {
        return this.val_ ? this.true_ : this.false_;
    }

    trueReason():Message|null {
        return this.true_;
    }
    falseReason():Message|null {
        return this.false_;
    }
    not() :BoolWithExplanation{
        return new BoolWithExplanation(!this.val_, this.false_, this.true_);
    }

    /**
     * does an or on all the values and explains why it is true of false
     */

    or(... values:BoolWithExplanation[]):BoolWithExplanation {
        let trueExplain:Message[] = [];
        let falseExplain:Message[] = [];


        this.addExplain_(trueExplain, this.val_, this.true_);
        this.addExplain_(falseExplain, !this.val_, this.false_);

        let res = this.val_;
        for (let arg of values) {
            this.addExplain_(trueExplain, arg.val_, arg.true_);
            this.addExplain_(falseExplain, !arg.val_, arg.false_);
            res = res || arg.val_;
        }

        if (res) {
            return new BoolWithExplanation(true, trueExplain.length == 0 ? null : Messages.join(trueExplain), null);
        }
        else {
            return new BoolWithExplanation(false, null, falseExplain.length === 0 ? null :Messages.join(falseExplain, Messages.OR));
        }
    }

    and(...values:BoolWithExplanation[]):BoolWithExplanation {

        let trueExplain:Message[] = [];
        var falseExplain:Message[] = [];


        this.addExplain_(trueExplain, this.val_, this.true_);
        this.addExplain_(falseExplain, !this.val_, this.false_);

        var res = this.val_;
        for (let arg of values) {
            this.addExplain_(trueExplain, arg.val_, arg.true_);
            this.addExplain_(falseExplain, !arg.val_, arg.false_);

            res = res && arg.val_;
        }

        if (res) {
            return new BoolWithExplanation(true, Messages.join(trueExplain), null);
        }
        else {
            return new BoolWithExplanation(false, null, Messages.join(falseExplain));
        }
    };

    static and(frp: Frp, ...var_behaviours:(Behaviour<BoolWithExplanation>|BoolWithExplanation)[]) {
        let behaviours = var_behaviours.map(b => frp.toBehaviour(b)) as BehaviourList1<BoolWithExplanation>;

        if (behaviours.length > 0) {
            return frp.liftB((...args: BoolWithExplanation[]) => {
                return args[0].or(...args.slice(1));
            }, ...behaviours);
        }
        return frp.createConstB(BoolWithExplanation.TRUE).setName('BoolWithExplanation.and');
    };

    static readonly TRUE = new BoolWithExplanation(true);
    static readonly FALSE = new BoolWithExplanation(false);

    static createB(
        valB: Behaviour<boolean, any, any, any>,
        trueB?: Message|Behaviour<Message>,
        falseB?: Message|Behaviour<Message>): Behaviour<BoolWithExplanation> {

        let frp:Frp = valB.frp();
        return valB.frp().liftB((val:boolean, trueVal:Message|undefined, falseVal:Message|undefined):BoolWithExplanation =>{
            return new BoolWithExplanation(val, trueVal || null, falseVal || null);
        }, valB, frp.toBehaviour(trueB), frp.toBehaviour(falseB));

    }

    static createTrueB(valB: Behaviour<boolean>, trueM:Behaviour<Message>|Message): Behaviour<BoolWithExplanation> {
        return BoolWithExplanation.createB(valB, trueM);
    }
    static createFalseB(valB:Behaviour<boolean>, falseM:Behaviour<Message>|Message) {
        return BoolWithExplanation.createB(valB, undefined, falseM);
    }

    static orB(...args: [Behaviour<BoolWithExplanation>,...(BoolWithExplanation| Behaviour<BoolWithExplanation>)[]]) : Behaviour<BoolWithExplanation> {
        let frp = args[0].frp();
        return frp.liftB((... args:BoolWithExplanation[]): BoolWithExplanation => {
            return args[0].or(...args.slice(1));
        }, ...Util.toBehaviours(frp, args));
    };

    static notB(arg:Behaviour<BoolWithExplanation>) : Behaviour<BoolWithExplanation> {
        let frp = arg.frp();
        return frp.liftBI((val:BoolWithExplanation): BoolWithExplanation => {
            return val.not();
        }, (val:BoolWithExplanation)=> {
            arg.set(val.not())
        }, arg);
    };

    private addExplain_ (all:Message[], shouldAdd: boolean, explain:Message|null) {
        if (shouldAdd && explain) {
            all.push(explain);
        }
    }

    static fromBool(frp: Frp, val:boolean|Behaviour<boolean>) : Behaviour<BoolWithExplanation> {
        let b = frp.toBehaviour(val);
        return frp.liftBI(function(b:boolean) {
            return new BoolWithExplanation(b);
        }, (val:BoolWithExplanation) => {
            b.set(val.val());
        },b);
    }

    /**
     *
     * @param {!recoil.frp.Behaviour<!recoil.ui.BoolWithExplanation>} valB
     * @return {!recoil.frp.Behaviour<string>}
     */
    static toBool(valB:Behaviour<BoolWithExplanation>):Behaviour<boolean> {
        return valB.frp().liftBI((b:BoolWithExplanation) : boolean => {
            return b.val();
        }, (v:boolean) :void => {
            valB.set(v ? BoolWithExplanation.TRUE: BoolWithExplanation.FALSE)
        }, valB);
    }

    static toString(valB:Behaviour<BoolWithExplanation>) {
        return valB.frp().liftB((b) => {
            return b.reason() ? b.reason()!.toString() : '';
        }, valB);
    };

    static isAllGoodExplain (...values:BehaviourList1) {

        let frp = values[0].frp();
        return frp.metaLiftB((...innerValues:Status<any,any>[]):BStatus<BoolWithExplanation> => {
            let result = new BStatus(false);
            let errors = [];
            let ready = true;

            for (let meta of innerValues) {
                if (!meta.good()) {
                    errors.push(...meta.errors());

                    if (ready && !meta.ready() && meta.errors().length === 0) {
                        errors.push(Messages.NOT_READY);
                        ready = false;
                    }
                }

            }
            if (errors.length == 0) {
                return new BStatus(BoolWithExplanation.TRUE);
            }
            return new BStatus(new BoolWithExplanation(false, Messages.join(errors)));

        }, ...values);
    }
}






