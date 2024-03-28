export const is_ref:unique symbol;
export class Ref<T>{
    constructor(value:T);
    value:T
    [is_ref]:true;
}
export class Pointer<T>{
    constructor(of:Ref<T>);
    unref():Ref<T>
}
export interface DynamicRef<T>{
    new(getter:()=>T):{
        get value():T;
    }
    new(getter:()=>T,setter:(value:T)=>void):{
        get value():T;
        set value(value:T);
    }
    new(getter:undefined,setter:(value:T)=>void):{
        set value(value:T);
    }
}