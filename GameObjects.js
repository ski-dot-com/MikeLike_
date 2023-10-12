'use strict';

const THREE = require("three");
const { Vector3 } = THREE;
const Casters=require("./Casters");
const {EventEmitter} = require('events');
const {FIELD_SIZE}=require("./const")

const Vec_1=new Vector3(1,1,1);

/**
 * @type {Map<any,Object<number,GameObject>>}
 */
let everything=new Map()

class GameObject extends EventEmitter{
	static #static_event=new EventEmitter();
	/**
	 * 
	 * @param {string} name 
	 * @param {(self:ThisType)=>void} func 
	 */
	static on(name,func){
		GameObject.#static_event.on(name,(self,...args)=>{
			if(self instanceof this){
				func(self,...args)
			}
		})
	}
	/**
	 * 
	 * @param {string} name 
	 * @param  {...any} args 
	 */
	static emit(name,...args){
		GameObject.#static_event.emit(name,...args)
	}
	static get all(){
		if(!everything.get(this))everything.set(this,{})
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
		obj.pos=obj.pos||new Vector3();
		{
			let tmp=this;
			do{
				tmp=Object.getPrototypeOf(tmp);
				if(!everything.get(tmp))everything.set(tmp,{});
				let tmp_=everything.get(tmp)
				tmp_[this.id]=this;
				this.on("remove",()=>{delete tmp_[this.id]})
			}while(tmp!=GameObject);
		}
		/**
		 * @type {THREE.Vector3}
		 */
		this.pos=obj.pos;
		/**
		 * @type {THREE.Vector3}
		 */
		this.min=obj.min?.clone()||new Vector3(0,0,0);
		/**
		 * @type {THREE.Vector3}
		 */
		this.max=obj.max?.clone()||Vec_1.clone();
		/**
		 * @type {number}
		 */
		this.angle_x = obj.angle_x;
		/**
		 * @type {number}
		 */
		this.angle_y = obj.angle_y;
		GameObject.emit("create",this);
	}
	/**
	 * @type {THREE.Vector3}
	 */
	get size(){
		return new Vector3().subVectors(this.max,this.min);
	}
	/**
	 * @type {THREE.Vector3}
	 */
	get min_pos(){
		return new Vector3().addVectors(this.pos,this.min);
	}
	/**
	 * @type {THREE.Vector3}
	 */
	get max_pos(){
		return new Vector3().addVectors(this.pos,this.max);
	}
	move(distance_x, distance_y = 0) {
		const d=new Vector3(distance_x * Math.cos(this.angle_x)-distance_y * Math.sin(this.angle_x),0, distance_x * Math.sin(this.angle_x)+distance_y * Math.cos(this.angle_x)), 
			to_pos=new Vector3().addVectors(this.pos, d)
		this.pos.copy(new Casters.Box(this.pos, to_pos, this.min, this.max).route(...Object.values(Wall.all)))
		return to_pos.equals(this.pos);
	}
	/**
	 * 
	 * @param {GameObject} obj 接触を判定するオブジェクト
	 * @returns これらのオブジェクトが接触しているかどうか
	 */
	intersect(obj) {
		return  [...obj.max_pos.sub(this.min_pos).toArray(),...this.max_pos.sub(obj.min_pos).toArray()].every(v=>v>=0);
	}
	intersectWalls() {
		return Object.values(Wall.all).some((wall) => this.intersect(wall));
	}
	toJSON() {
		return { id: this.id, pos: this.pos, size: this.size, min: this.min, max: this.max, angle_x: this.angle_x, angle_y: this.angle_y };
	}
	remove(){
		this.emit("remove");
	}
}
class Player extends GameObject {
	constructor(obj = {}) {
		super(obj);
		this.socketId = obj.socketId;
		this.nickname = obj.nickname;
		this.min.x = this.min.z = -(this.max.x = this.max.z = 40);
		this.max.y = 80;
		this.health = this.maxHealth = 10;
		this.bullets = {};
		this.point = 0;
		this.movement = {};
		this.angle_y = 0;
		do {
			this.pos.x = Math.random() * (FIELD_SIZE - this.size.x) - this.min.x;
			this.pos.z = Math.random() * (FIELD_SIZE - this.size.z) - this.min.z;
			this.angle_x = Math.random() * 2 * Math.PI;
		} while (this.intersectWalls());
	}
	shoot() {
		if (Object.keys(this.bullets).length >= 3) {
			return;
		}
		const bullet = new Bullet({
			pos:this.pos.clone().add(new Vector3(0,40)),
			angle_x: this.angle_x,
			player: this,
		});
		bullet.move(this.max.x / 2);
		this.bullets[bullet.id] = bullet;
		bullets[bullet.id] = bullet;
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
		this.min=(this.max=Vec_1.clone().multiplyScalar(7.5)).clone().negate();
		this.player = obj.player;
		this.on("remove",()=>{
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
		this.on("remove",()=>{
			clearInterval(this.timer);
			setTimeout(new BotPlayer({ nickname: this.nickname }), 3000);
		})
	}
}
class Wall extends GameObject {
}
module.exports={
    GameObject,
    Player,
    Bullet,
    BotPlayer,
    Wall
}