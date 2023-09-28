'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = http.Server(app);
const io = socketIO(server);
const yargs = require('yargs').argv;
const THREE = require("three");
const { Vector3 }=THREE;
/**
 * 
 * @param {number} val value
 * @param {number} min minimum
 * @param {number} max maximum
 */
const clamp = (val, min, max) => Math.min(max, Math.max(min, val))

const FIELD_SIZE = 1000;
const Vec_1=new Vector3(1,1,1);
const Casters={}
/**
 * レイ。どこで当たるかを判定できる。
 */
Casters.Ray=class Ray{
	/**
	 * @type {THREE.Vector3}
	 */
	#direction
	/**
	 * @param {THREE.Vector3} start 
	 * @param {THREE.Vector3} end 
	 */
	constructor(start,end){
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
				if(!(obj.min_pos.y<=end_cand.y&&end_cand.y<=obj.max_pos.y&&obj.min_pos.z<=end_cand.z&&end_cand.z<=obj.max_pos.z))break;
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
				if(!(obj.min_pos.z<=end_cand.z&&end_cand.z<=obj.max_pos.z&&obj.min_pos.x<=end_cand.x&&end_cand.x<=obj.max_pos.x))break;
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
				if(!(obj.min_pos.x<=end_cand.x&&end_cand.x<=obj.max_pos.x&&obj.min_pos.x<=end_cand.x&&end_cand.x<=obj.max_pos.x))break;
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
/**
 * 衝突を考慮しながら、移動をする(点の移動)。
 * @param   {THREE.Vector3} start 開始点
 * @param   {THREE.Vector3} end 目的地
 * @param   {...GameObject} objs 障害物
 * @returns {THREE.Vector3} 実際の終着点
 */
function calc_route(start,end,...objs){
	while (!start.equals(end)){
		let res = new Casters.Ray(start,end).test(...objs)
		if(!res.axis)break;
		console.log(res.axis)
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
	}
	return end
}
/**
 * ボックス(ボックスキャスト用)。
 */
Casters.Box=class Box{
	/**
	 * @type {Casters.Ray}
	 */
	#ray
	/**
	 * 
	 * @param {THREE.Vector3} start 
	 * @param {THREE.Vector3} end 
	 * @param {THREE.Vector3} min 
	 * @param {THREE.Vector3} max 
	 */
	constructor(start,end,min,max){
		this.#ray=new Casters.Ray(start,end)
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
	 * @param   {...GameObject} objs 
	 * @returns {this} this
	 */
	route(...objs){
		return calc_route(this.start,this.end,...objs.map(o=>new GameObject({
			max:o.max.clone().sub(this.min),
			min:o.min.clone().sub(this.max),
			pos:o.pos
		})))
	}
}
class GameObject {
	/**
	 * 
	 * @param {Partial<ReturnType<GameObject["toJSON"]>>} obj 
	 */
	constructor(obj = {}) {
		/**
		 * @type {number}
		 */
		this.id = Math.floor(Math.random() * 1000000000);
		obj.pos=obj.pos||new Vector3();
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
		this.pos.copy(new Casters.Box(this.pos, to_pos, this.min, this.max).route(...Object.values(walls)))
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
		return Object.values(walls).some((wall) => this.intersect(wall));
	}
	toJSON() {
		return { id: this.id, pos: this.pos, size: this.size, min: this.min, max: this.max, angle_x: this.angle_x, angle_y: this.angle_y };
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
	ray(){
		// console.log("ray")
		const eye=new Vector3(0,40,0).add(this.pos)
		const hit=new Casters.Ray(eye,new Vector3(
			 Math.cos(this.angle_x) /** Math.cos(this.angle_y)  */,
								    /*  Math.sin(this.angle_y)//*/0
			,Math.sin(this.angle_x) /** Math.cos(this.angle_y)  */).multiplyScalar(1000).add(eye)).test(...Object.values(players).filter(x=>x!==this),...Object.values(walls)).hit
		if(hit instanceof Wall){
			delete walls[hit.id];
		}
	}
	damage() {
		this.health--;
		if (this.health === 0) {
			this.remove();
		}
	}
	remove() {
		delete players[this.id];
		io.to(this.socketId).emit('dead');
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
	}
	remove() {
		delete this.player.bullets[this.id];
		delete bullets[this.id];
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
	}
	remove() {
		super.remove();
		clearInterval(this.timer);
		setTimeout(() => {
			const bot = new BotPlayer({ nickname: this.nickname });
			players[bot.id] = bot;
		}, 3000);
	}
}
class Wall extends GameObject {
}


/**
 * @type {Object<number,Player>}
 */
let players = {};
/**
 * @type {Object<number,Bullet>}
 */
let bullets = {};
/**
 * @type {Object<number,Wall>}
 */
let walls = {};

for (let i = 0; i < 3; i++) {
	const wall = new Wall({
		pos: new Vector3(Math.random() * FIELD_SIZE,0,Math.random() * FIELD_SIZE),
		max: new Vector3(200,100,50),
	});
	walls[wall.id] = wall;
}

const bot = new BotPlayer({ nickname: 'bot' });
players[bot.id] = bot;

io.on('connection', function (socket) {
	/**
	 * @type {Player?}
	 */
	let player = null;
	socket.on('game-start', (config) => {
		player = new Player({
			socketId: socket.id,
			nickname: config.nickname,
		});
		players[player.id] = player;
	});
	socket.on('movement', function (movement) {
		if (!player || player.health === 0) { return; }
		player.movement = movement;
	});
	socket.on('shoot', function () {
		if (!player || player.health === 0) { return; }
		player.shoot();
	});
	socket.on('ray', function () {
		if (!player || player.health === 0) { return; }
		player.ray();
	});
	socket.on('disconnect', () => {
		if (!player) { return; }
		delete players[player.id];
		player = null;
	});
});

setInterval(() => {
	Object.values(players).forEach((player) => {
		const movement = player.movement;
		// console.log(movement);
		if (movement.m_forward) {
			player.move(5);
		}
		if (movement.m_back) {
			player.move(-5);
		}
		if (movement.m_right) {
			player.move(0, 5);
		}
		if (movement.m_left) {
			player.move(0, -5);
		}
		if (movement.r_up) {
			//console.log("r_up")
			player.angle_y += 0.1;
		}
		if (movement.r_down) {
			//console.log("r_down")
			player.angle_y -= 0.1;
		}
		if (movement.r_left) {
			player.angle_x -= 0.1;
		}
		if (movement.r_right) {
			player.angle_x += 0.1;
		}
		if (movement.r_dx) {
			player.angle_x += movement.r_dx;
			movement.r_dx = 0;
		}
		if (movement.r_dy) {
			player.angle_y -= movement.r_dy;
			movement.r_dy = 0;
		}
		player.angle_y = clamp(player.angle_y, -Math.PI / 2, Math.PI / 2)
	});
	Object.values(bullets).forEach((bullet) => {
		if (!bullet.move(10)) {
			bullet.remove();
			return;
		}
		Object.values(players).forEach((player) => {
			if (bullet.intersect(player)) {
				if (player !== bullet.player) {
					player.damage();
					bullet.remove();
					bullet.player.point += 1;
				}
			}
		});
	});
	io.sockets.emit('state', players, bullets, walls);
}, 1000 / 30);


app.use('/static', express.static(__dirname + '/static'));

app.get('/', (request, response) => {
	response.sendFile(path.join(__dirname, '/static/3d.html'));
});

const port = parseInt(yargs.port) || 3000;
server.listen(port, () => {
	console.log(`Starting server on port ${port}`);
	console.log(`URL: http://localhost:${port}`);
});
