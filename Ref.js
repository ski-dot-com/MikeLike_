let is_ref=Symbol("is_ref")
class Ref{
    constructor(value){
        this.value=value
        this[is_ref]=true
    }
    get_pointer(){return new Pointer(this)}
}
class Pointer{
    /**
     * ポインタを作成する。
     * @param {Ref} of 
     */
    constructor(of){
        this.of=of
    }
    unref(){return this.of}
}
exports.Ref = Ref
exports.DynamicRef = class DynamicRef{
    #getter;
    #setter;
    constructor(getter,setter){
        this.#getter=getter
        this.#setter=setter
    }
    get value(){return this.#getter(     )}
    set value(value)  {this.#setter(value)}
}
exports.Pointer = Pointer
exports.is_ref = is_ref