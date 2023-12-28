'use strict';

const THREE = require("three");
const { Vector3 } = THREE;
/**
 * レイ。どこで当たるかを判定できる。
 */
class Ray{
	/**
	 * @type {THREE.Vector3}
	 */
	#direction
	/**
	 * @type {(l:number,r:number)=>boolean}
	 */
	#comparer
	/**
	 * @param {THREE.Vector3} start 
	 * @param {THREE.Vector3} end 
	 */
	constructor(start,end,exclude_edge=true){
		/**
		 * @type {THREE.Vector3}
		 */
		this.start=start.clone()
		/**
		 * @type {THREE.Vector3}
		 */
		this.end=end.clone()
		const tmp=new Vector3().subVectors(end,start)
		this.length=tmp.length()
		/**
		 * @type {THREE.Vector3}
		 */
		this.#direction=tmp.normalize()
		/**
		 * @type {GameObject?}
		 */
		this.hit=null
		/**
		 * @type {"x"|"y"|"z"?}
		 */
		this.axis=null
		
		// console.log(this.#direction)
		this.exclude_edge=exclude_edge
		this.#comparer=exclude_edge?(l,r)=>l<r:(l,r)=>l<=r;
	}
	/**
	 * 衝突をテストする。
	 * @param  {...GameObject} objs 
	 * @returns {this} this
	 */
	test(...objs){
		main_loop:for (const obj of objs) {
			do{
				if(!this.#direction.x)break;
				const scaler=((this.#direction.x>0?obj.min_pos.x:obj.max_pos.x)-this.start.x)/this.#direction.x;
				// if(obj instanceof Player)console.log(`${obj.nickname}.x.scaler: ${scaler}`)
				if(scaler<0||scaler>=this.length)break;
				const end_cand=this.#direction.clone().multiplyScalar(scaler).add(this.start);
				//if(obj instanceof Player)console.log(`(wall).x.end_cand:`, end_cand)
				if(!(this.#comparer(obj.min_pos.y,end_cand.y)&&this.#comparer(end_cand.y,obj.max_pos.y)&&this.#comparer(obj.min_pos.z,end_cand.z)&&this.#comparer(end_cand.z,obj.max_pos.z)))break;
				this.end=end_cand;
				this.length=scaler;
				this.hit=obj;
				this.axis="x"
				//if(obj instanceof Player)console.log(`(wall).x.hit`)
				continue main_loop;
			}while(0);
			do{
				if(!this.#direction.y)break;
				const scaler=((this.#direction.y>0?obj.min_pos.y:obj.max_pos.y)-this.start.y)/this.#direction.y;
				//if(obj instanceof Player)console.log(`${obj.nickname}.y.scaler: ${scaler}`)
				if(scaler<0||scaler>=this.length)break;
				const end_cand=this.#direction.clone().multiplyScalar(scaler).add(this.start);
				//if(obj instanceof Wall)console.log(`(wall).y.end_cand:`, end_cand)
				if(!(this.#comparer(obj.min_pos.z,end_cand.z)&&this.#comparer(end_cand.z,obj.max_pos.z)&&this.#comparer(obj.min_pos.x,end_cand.x)&&this.#comparer(end_cand.x,obj.max_pos.x)))break;
				this.end=end_cand;
				this.length=scaler;
				this.hit=obj;
				this.axis="y"
				//if(obj instanceof Wall)console.log(`(wall).y.hit`)
				continue main_loop;
			}while(0);
			do{
				if(!this.#direction.z)break;
				const scaler=((this.#direction.z>0?obj.min_pos.z:obj.max_pos.z)-this.start.z)/this.#direction.z;
				//if(obj instanceof Player)console.log(`${obj.nickname}.z.scaler: ${scaler}`)
				if(scaler<0||scaler>=this.length)break;
				const end_cand=this.#direction.clone().multiplyScalar(scaler).add(this.start);
				//if(obj instanceof Player)console.log(`(wall).z.end_cand:`, end_cand)
				if(!(this.#comparer(obj.min_pos.x,end_cand.x)&&this.#comparer(end_cand.x,obj.max_pos.x)&&this.#comparer(obj.min_pos.y,end_cand.y)&&this.#comparer(end_cand.y,obj.max_pos.y)))break;
				this.end=end_cand;
				this.length=scaler;
				this.hit=obj;
				this.axis="z"
				//if(obj instanceof Player)console.log(`(wall).z.hit`)
				continue main_loop;
			}while(0);
		}
		return this
	}
}
exports.Ray=Ray
/**
 * 衝突を考慮しながら、移動をする(点の移動)。
 * @param   {THREE.Vector3} start 開始点
 * @param   {THREE.Vector3} end 目的地
 * @param   {GameObject[]} objs 障害物
 * @param   {{axises?:string}} ref 障害物
 * @returns {THREE.Vector3} 実際の終着点
 */
function calc_route(start,end,objs,ref={}){
	ref.axises=""
	while (!start.equals(end)){
		let res = new Ray(start,end).test(...objs)
		if(!res.axis)break;
		start = res.end;
		switch (res.axis) {
			case "x":
				end.x=start.x
				break;
			case "y":
				end.y=start.y
				break;
			case "z":
				end.z=start.z
				break;
		}
		ref.axises+=res.axis
	}
	return end
}
/**
 * ボックス(ボックスキャスト用)。
 */
class Box{
	/**
	 * @type {Ray}
	 */
	#ray
	/**
	 * ぶつかった面
	 * @type {string?}
	 */
	axises
	/**
	 * 
	 * @param {THREE.Vector3} start 
	 * @param {THREE.Vector3} end 
	 * @param {THREE.Vector3} min 
	 * @param {THREE.Vector3} max 
	 */
	constructor(start,end,min,max){
		this.#ray=new Ray(start,end,true)
		/**
		 * @type {THREE.Vector3}
		 */
		this.min=min
		/**
		 * @type {THREE.Vector3}
		 */
		this.max=max
	}
	get hit(){
		return this.#ray.hit
	}
	get start(){
		return this.#ray.start
	}
	get end(){
		return this.#ray.end
	}
	get length(){
		return this.#ray.length
	}
	/**
	 * 衝突をテストする。
	 * @param  {...GameObject} objs 
	 * @returns {this} this
	 */
	test(...objs){
		this.#ray.test(...objs.map(o=>new GameObject({
			max:o.max.clone().sub(this.min),
			min:o.min.clone().sub(this.max),
			pos:o.pos
		})))
		return this
	}
	/**
	 * 衝突を考慮して移動する。
	 * @param   {...{min:Vector3,max:Vector3,pos:Vector3}} objs 
	 * @returns {THREE.Vector3} 
	 */
	route(...objs){
		let tmp={}
		let res=calc_route(this.start,this.end,objs.map(o=>({
			max_pos:o.max.clone().sub(this.min).add(o.pos),
			min_pos:o.min.clone().sub(this.max).add(o.pos),
		})),tmp)
		this.axises=tmp.axises
		return res;
	}
}
exports.Box=Box