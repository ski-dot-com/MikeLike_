const { Ref,is_ref }=require("./Ref")
function unwrap_refs(value){
    return value[is_ref]?unwrap_refs(value.value):value
}
/**
 * コマンド用の関数を作成する。
 * @param {Function} f 本体
 * @param {bool[]?} sign 引数や戻り値がRefをとるかどうか。[引数1, 引数2,...,戻り値]の順番。省略されればfalse扱い。
 */
function make_command_func(f,sign){
    if((!sign)||!sign.length)sign=[false]
    const res_func=sign.at(-1)?x=>x:unwrap_refs
    const arg_funcs=sign.slice(0,-1).map(v=>v?x=>x:unwrap_refs)
    const sign_len=sign.length
    return (...args)=>res_func(f(...arg_funcs.map((f,i)=>f(args[i])),...args.slice(sign_len).map((v)=>unwrap_refs(v))))
}
/**
 * コマンドを実行するクラス。
 */
class CommandRunner{
    constructor(globals){
        this.globals=globals||{}
    }
    signs=["+=","-=","*=","/=","=","+","-","*","/",".","(",")",","]
    /**
     * 
     * @param {*} locals 
     * @param {string} command 
     */
    run_command(locals,command){
        const stackframe=[Object.assign({},this.globals,locals)]
        let tokens=command.split(/\s/g).filter(v=>v.length).map(v=>v[0]=="#"?" "+v:v);
        for(let sign of this.signs){
            tokens=tokens.flatMap(v=>v[0]==" "?v:v.split(sign).flatMap(v=>[v," "+sign]).slice(-1))
        }
        /**
         * @type {string[]}
         */
        let parse_stack=[]
        /**
         * @type {string[][]}
         */
        const parse_stack_stack=[];
        /**
         * @type {number}
         */
        let argc=1;
        /**
         * @type {number[]}
         */
        const argc_stack=[];
        /**
         * @type {string[]}
         */
        const code=[];
        const tokens_len=tokens.length;
        let is_after_period=false;
        let i = 0;
        /**
         * @type {string}
         */
        let token;
        while(i<tokens_len){
            parse_main_for:for(;i<tokens_len;i++){
                token=tokens[i];
                do{
                    switch(token){
                        case " (":
                        case " )":
                        case " ,":
                            break parse_main_for;
                        case " +=":
                        case " -=":
                        case " *=":
                        case " /=":
                        case " =":
                            // do nothing
                        case " +":
                        case " -":
                            if(parse_stack[0]==" +"||parse_stack[0]==" -"){
                                code.push(parse_stack.shift());continue;
                            }
                        case " *":
                        case " /":
                            if(parse_stack[0]==" *"||parse_stack[0]==" &"){
                                code.push(parse_stack.shift());continue;
                            }
                        case " .":
                            if(parse_stack[0]==" ."){
                                code.push(parse_stack.shift());continue;
                            }
                            if(token==" .")is_after_period=true;
                            parse_stack.unshift(token)
                            break;
                        default:
                            code.push(is_after_period?" $"+token:token)
                            is_after_period=false
                    }
                }while(0);
            }
            code+=parse_stack;
            switch(token){
                case " (":parse_stack_stack.push(parse_stack);parse_stack=[];argc_stack.push(argc);argc=1;break;
                case " )":parse_stack=parse_stack_stack.pop();code.push(argc);code.push(" call");argc=argc_stack.pop();break;
                case " ,":parse_stack=[];argc+=1;break;
            }
        }
        /**
         * @type {any[]}
         */
        let eval_stack=[];
        for(const op of code){
            switch(op){
                case " +=":
                    eval_stack=[eval_stack[1].value=unwrap_refs(eval_stack[1].value)+unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " -=":
                    eval_stack=[eval_stack[1].value=unwrap_refs(eval_stack[1].value)-unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " *=":
                    eval_stack=[eval_stack[1].value=unwrap_refs(eval_stack[1].value)*unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " /=":
                    eval_stack=[eval_stack[1].value=unwrap_refs(eval_stack[1].value)/unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " =":
                    eval_stack=[eval_stack[1].value=unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " +":
                    eval_stack=[unwrap_refs(eval_stack[1])+unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " -":
                    eval_stack=[unwrap_refs(eval_stack[1])-unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " *":
                    eval_stack=[unwrap_refs(eval_stack[1])*unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " /":
                    eval_stack=[unwrap_refs(eval_stack[1])/unwrap_refs(eval_stack[0])]+eval_stack.slice(2);break;
                case " .":
                    eval_stack=[unwrap_refs(eval_stack[1])[unwrap_refs(eval_stack[0])]]+eval_stack.slice(2);break;
                case " call":
                    {
                        let argc=unwrap_refs(eval_stack[0])
                        eval_stack=[unwrap_refs(eval_stack[argc+1])(...eval_stack.slice(1,argc+1).reverse())]+eval_stack.slice(2);break;
                    }
                default:
                    {
                        let tmp = Number.parseFloat(token);
                        eval_stack.unshift(isNaN(tmp)?tmp:stackframe[0][token]);
                    }
            }
        }
    }
}