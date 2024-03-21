'use strict';

const THREE = require("three");
const { Vector3 } = THREE;
const Casters = require("./Casters");
const { EventEmitter } = require('events');
const { FIELD_SIZE, BLOCK_SIZE, FLOAT_E } = require("./const");

const Vec_1 = new Vector3(1, 1, 1);
const Vec_0 = new Vector3(0, 0, 0);
function round_E(x){
	return Math.round(x/FLOAT_E)*FLOAT_E
}

/**
 * @type {Map<any,Object<number,GameObject>>}
 */
let everything = new Map()

class GameObject extends EventEmitter {
	static #static_event = new EventEmitter();
	/**
	 * 
	 * @param {string} name 
	 * @param {(self:ThisType)=>void} func 
	 */
	static on(name, func) {
		GameObject.#static_event.on(name, (self, ...args) => {
			if (self instanceof this) {
				func(self, ...args)
			}
		})
	}
	/**
	 * 
	 * @param {string} name 
	 * @param  {...any} args 
	 */
	static emit(name, ...args) {
		GameObject.#static_event.emit(name, ...args)
	}
	static get all() {
		if (!everything.get(this)) everything.set(this, {})
		return everything.get(this);
	}
	/**
	 * @param {Partial<ReturnType<GameObject["toJSON"]>>} obj 
	 */
	constructor(obj = {}) {
		super()
		/**
		 * @type {number}
		 */
		this.id = Math.floor(Math.random() * 1000000000);
		obj.pos = obj.pos || new Vector3();
		{
			let _tmp = this, tmp = _tmp.constructor, tmp_old;
			do {
				tmp_old = tmp;
				if (!everything.get(tmp)) everything.set(tmp, {});
				let tmp_ = everything.get(tmp)
				tmp_[this.id] = this;
				this.on("remove", () => { delete tmp_[this.id] })
				tmp = Object.getPrototypeOf(tmp)
			} while (tmp_old != GameObject);
		}
		/**
		 * @type {THREE.Vector3}
		 */
		this.pos = obj.pos;
		/**
		 * @type {THREE.Vector3}
		 */
		this.min = obj.min?.clone() || new Vector3(0, 0, 0);
		/**
		 * @type {THREE.Vector3}
		 */
		this.max = obj.max?.clone() || Vec_1.clone();
		/**
		 * @type {number}
		 */
		this.angle_x = obj.angle_x;
		/**
		 * @type {number}
		 */
		this.angle_y = obj.angle_y;
		GameObject.emit("create", this);
	}
	/**
	 * @type {THREE.Vector3}
	 */
	get size() {
		return new Vector3().subVectors(this.max, this.min);
	}
	/**
	 * @type {THREE.Vector3}
	 */
	get min_pos() {
		return new Vector3().addVectors(this.pos, this.min);
	}
	/**
	 * @type {THREE.Vector3}
	 */
	get max_pos() {
		return new Vector3().addVectors(this.pos, this.max);
	}
	move(distance_x, distance_y = 0, distance_z = 0, use_angle_x=true, use_angle_y=false) {
		let real_dx=distance_x,real_dy=distance_z,real_dz=distance_y;
		if(use_angle_y){
			[real_dx,real_dy]=[real_dx * Math.cos(this.angle_y) - real_dy * Math.sin(this.angle_y),real_dx * Math.sin(this.angle_y) + real_dy * Math.cos(this.angle_y)];
		}
		if(use_angle_x){
			[real_dx,real_dz]=[real_dx * Math.cos(this.angle_x) - real_dz * Math.sin(this.angle_x),real_dx * Math.sin(this.angle_x) + real_dz * Math.cos(this.angle_x)];
		}
		const d = new Vector3(real_dx,real_dy,real_dz),
			to_pos = new Vector3().addVectors(this.pos, d)
		let tmp;
		this.pos.copy((tmp = new Casters.Box(this.pos, to_pos, this.min, this.max)).route(...Object.values(Solid.all)))
		this.emit("hit", tmp.axises)
		return to_pos.equals(this.pos);
	}
	/**
	 * 
	 * @param {GameObject} obj 接触を判定するオブジェクト
	 * @returns これらのオブジェクトが接触しているかどうか
	 */
	intersect(obj) {
		return [...obj.max_pos.sub(this.min_pos).toArray(), ...this.max_pos.sub(obj.min_pos).toArray()].every(v => v > 0);
	}
	intersectSolids() {
		return Object.values(Solid.all).some((wall) => this.intersect(wall));
	}
	toJSON() {
		return { id: this.id, pos: this.pos, size: this.size, min: this.min, max: this.max, angle_x: this.angle_x, angle_y: this.angle_y };
	}
	remove() {
		this.emit("remove");
	}
}
class Player extends GameObject {
	onground = false
	constructor(obj = {}) {
		super(obj);
		/**
		 * @type {number}
		 */
		this.socketId = obj.socketId;
		/**
		 * @type {string}
		 */
		this.nickname = obj.nickname;
		this.min.x = this.min.z = -(this.max.x = this.max.z = 40);
		this.max.y = 80;
		/**
		 * @type {number}
		 */
		this.health = this.maxHealth = 10;
		this.bullets = {};
		/**
		 * @type {number}
		 */
		this.point = 0;
		this.movement = {};
		/**
		 * @type {number}
		 */
		this.angle_y = 0;
		/**
		 * @type {number}
		 */
		this.sy = 0
		this.color="lime";
		do {
			this.pos.x = Math.random() * (FIELD_SIZE - this.size.x) - this.min.x;
			this.pos.z = Math.random() * (FIELD_SIZE - this.size.z) - this.min.z;
			this.angle_x = Math.random() * 2 * Math.PI;
			this.pos.y = 0;
		} while (this.intersectSolids());
		this.on("hit", (axises) => {
			for (const c of axises) {
				if (c == "y") {
					if (this.sy < 0) this.onground = true
					this.sy = 0
				}
			}
		})
	}
	shoot() {
		// if (Object.keys(this.bullets).length >= 3) {
		// 	return;
		// }
		const bullet = new Bullet({
			pos: this.pos.clone().add(new Vector3(0, 40, 0)),
			angle_x: this.angle_x,
			angle_y: this.angle_y,
			player: this,
		});
		bullet.move(this.max.x / 2,0,0,true,true);
		this.bullets[bullet.id] = bullet;
	}
	right_click() {
		const eye = new Vector3(0, 40, 0).add(this.pos)
		let x,y,z;
		console.log(`eye: (${eye.x}, ${eye.y}, ${eye.z})`);
		const caster = new Casters.Ray(eye, new Vector3(
			x=Math.cos(this.angle_y) * Math.cos(this.angle_x),
			y=Math.sin(this.angle_y), 
			z=Math.cos(this.angle_y) * Math.sin(this.angle_x)
			).multiplyScalar(1000).add(eye)).test(...Object.values(everything.get(Player)).filter(x => x !== this), ...Object.values(everything.get(Solid)))
		if (caster.hit instanceof Solid) {
			console.log(`click at: (${caster.end.x}, ${caster.end.y}, ${caster.end.z})`);
			let axis=caster.axis,is_negative={"x":x,"y":y,"z":z}[axis]>0
			console.log(`click facing: ${axis}${is_negative?"-":"+"}`)
			let tmp_x=Math.floor(round_E(caster.end.x)/BLOCK_SIZE)-(is_negative&&axis=="x"),
				tmp_y=Math.floor(round_E(caster.end.y)/BLOCK_SIZE)-(is_negative&&axis=="y"),
				tmp_z=Math.floor(round_E(caster.end.z)/BLOCK_SIZE)-(is_negative&&axis=="z");
			console.log(`place at: (${tmp_x},${tmp_y},${tmp_z})`)
			let block=Block.place(tmp_x,tmp_y,tmp_z,{color:this.color});
			if([...Object.values(everything.get(Solid)),...Object.values(everything.get(Player))].filter(x=>block.intersect(x)).some(x=>x!=block.solid)){
				console.log(`collision occured.`)
				block.remove();
			}
		}
	}
	left_click() {
		const eye = new Vector3(0, 40, 0).add(this.pos)
		let x,y,z;
		const caster = new Casters.Ray(eye, new Vector3(
			x=Math.cos(this.angle_y) * Math.cos(this.angle_x),
			y=Math.sin(this.angle_y), 
			z=Math.cos(this.angle_y) * Math.sin(this.angle_x)
			).multiplyScalar(1000).add(eye)).test(...Object.values(everything.get(Player)).filter(x => x !== this), ...Object.values(everything.get(Solid)))
		if (caster.hit instanceof BlockSolid) {
			caster.hit.remove();
		}
	}
	
	damage() {
		this.health--;
		if (this.health === 0) {
			this.remove();
		}
	}
	toJSON() {
		return Object.assign(super.toJSON(), { health: this.health, maxHealth: this.maxHealth, socketId: this.socketId, point: this.point, nickname: this.nickname });
	}
}
class Bullet extends GameObject {
	constructor(obj) {
		super(obj);
		this.min = (this.max = Vec_1.clone().multiplyScalar(7.5)).clone().negate();
		this.player = obj.player;
		this.on("remove", () => {
			delete this.player.bullets[this.id];
		})
	}
}
class BotPlayer extends Player {
	constructor(obj) {
		super(obj);
		this.timer = setInterval(() => {
			if (!this.move(4)) {
				this.angle_x = Math.random() * Math.PI * 2;
			}
			if (Math.random() < 0.03) {
				this.shoot();
			}
		}, 1000 / 30);
		this.on("remove", () => {
			clearInterval(this.timer);
			setTimeout(() => new BotPlayer({ nickname: this.nickname }), 3000);
		})
	}
}
class Solid extends GameObject {
	constructor(obj={}) {
		super(obj);
		this.color = obj.color||0x777777;
	}
	toJSON() {
		return Object.assign(super.toJSON(), {color:this.color});
	}
}
class BlockSolid extends Solid {
	constructor(obj={}) {
		super(obj);
		this.block = obj.block;
	}
	toJSON() {
		return Object.assign(super.toJSON(), {block:this.block});
	}
}
class Wall extends Solid{
	constructor(obj={}) {
		obj.color=obj.color||"firebrick";
		super(obj);
	}
}
class Block extends GameObject{
	constructor(obj={}) {
		super(obj);
		this.color=obj.color||"lime";
		this.min=Vec_0.clone()
		this.max=Vec_1.clone().multiplyScalar(BLOCK_SIZE)
		this.solid=new BlockSolid({pos:this.pos,min:this.min,max:this.max,color:this.color,block:this})
		this.addListener("remove",()=>{
			this.solid.remove()
		})
	}
	/**
	 * 
	 * @param {number} x 
	 * @param {number} y 
	 * @param {number} z 
	 * @param {{}} options 
	 * @returns 
	 */
	static place(x,y,z,options={}){
		return new this(Object.assign(options,{pos:new Vector3(x,y,z).multiplyScalar(BLOCK_SIZE)}))
	}
	intersect(obj){
		return this.solid.intersect(obj)
	}
}
module.exports = {
	GameObject,
	Player,
	Bullet,
	BotPlayer,
	Solid,
	Wall,
	Block,
	BlockSolid
}