/**
 * this provides way of choosing an item, based on another item
 * analogous to a switch statement
 */

import {Behaviour, BStatus, Frp} from "./frp.ts";
import {BehaviourOrType} from "./struct.ts";
import {isEqual} from "../util/object.ts";



export class Chooser<CT, T> {
    private readonly frp_: Frp;
    private readonly default_: Behaviour<T> | undefined
    private readonly selectorB_: Behaviour<CT>;
    private bound_: boolean;
    private options_: { select: Behaviour<CT>, result: Behaviour<T> }[] = [];

    /**
     * @param selectorB this is the value if changes which value
     * @param defaultValue
     * gets chosen, I have chosen to make this always be a behaviour, because if it wasn't using the entire
     * class would be pointless
     */
    constructor(selectorB: Behaviour<CT>, defaultValue?: BehaviourOrType<T>) {
        this.frp_ = selectorB.frp();
        this.default_ = arguments.length > 1 ? this.frp_.toBehaviour(defaultValue as T) : undefined;
        this.selectorB_ = selectorB;
        this.bound_ = false;
    }

    /**
     * add a case to the chooser, note that selectValue is always evaluated
     */

    option(selectValue: BehaviourOrType<CT>, resultValue: BehaviourOrType<T>) {
        if (this.bound_) {
            throw 'Invalid call to option, chooser already bound';
        }
        this.options_.push({select: this.frp_.toBehaviour(selectValue), result: this.frp_.toBehaviour(resultValue)});
    }


    /**
     * call this function once you are ready to use the chooser, it converts it into a behaviour
     */
    bind(): Behaviour<T> {
        if (this.bound_) {
            throw 'Invalid call to bind, chooser already bound';
        }
        this.bound_ = true;
        let lift = (): BStatus<Behaviour<T>> => {
            for (let i = 0; i < this.options_.length; i++) {
                let opt = this.options_[i];
                if (isEqual(opt.select.get(), this.selectorB_.get())) {
                    return new BStatus(opt.result);
                }
            }
            if (this.default_) {
                return new BStatus(this.default_);
            }
            return BStatus.notReady();
        };


        let chooserBB = this.frp_.statusLiftBI<Behaviour<T>, Behaviour<T>>(
            lift, () => {
            },
            this.selectorB_,
            ...this.options_.map(v => v.select));
        return this.frp_.switchB(chooserBB);
    }

    static if<T>(condition: Behaviour<boolean>, trueValue: BehaviourOrType<T>, falseValue: BehaviourOrType<T>): Behaviour<T> {
        let chooser = new Chooser(condition, falseValue);
        chooser.option(true, trueValue);
        return chooser.bind();
    }


    /**
     * this is a utility who's only purpose is to get rid of warnings
     * if both  true and false are behaviours the compiler doesn't
     * know if the result is a behaviour or a behaviour of a behaviour
     */
    static ifB<T>(condition: Behaviour<boolean>, trueValue: Behaviour<T>, falseValue: Behaviour<T>): Behaviour<T> {
        let chooser = new Chooser(condition, falseValue);
        chooser.option(true, trueValue);
        return chooser.bind();
    }
}


