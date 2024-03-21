'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = http.Server(app);
const io = socketIO(server);
const yargs = require('yargs').alias(["w","p"],["world","port"]).argv;
const THREE = require("three");
const { Vector3 } = THREE;
const {
    GameObject,
    Player,
    Bullet,
    Solid,
	Wall
} = require("./GameObjects");
const {FIELD_SIZE}=require("./const");
/**
 * 
 * @param {number} val value
 * @param {number} min minimum
 * @param {number} max maximum
 */
const clamp = (val, min, max) => Math.min(max, Math.max(min, val))


GameObject.on("create",(_,self)=>{
	if(self instanceof Player){
		io.to(self.socketId).emit('dead');
	}
})
/**
 * @type {Object<number,Player>}
 */
let players = Player.all;
/**
 * @type {Object<number,Bullet>}
 */
let bullets = Bullet.all;
/**
 * @type {Object<number,Solid>}
 */
let solids = Solid.all;

for(let x = -20; x<=FIELD_SIZE+20;x+=FIELD_SIZE+20){
	new Wall({
		pos: new Vector3(x,0,0),
		max: new Vector3(20,100,FIELD_SIZE),
	});
}
for(let z = -20; z<=FIELD_SIZE+20;z+=FIELD_SIZE+20){
	new Wall({
		pos: new Vector3(-20,0,z),
		max: new Vector3(FIELD_SIZE+40,100,20),
	});
}
new Wall({
	pos: new Vector3(-20,-10,-20),
	max: new Vector3(FIELD_SIZE+40,10,FIELD_SIZE+40),
});

//new BotPlayer({ nickname: 'bot' });

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
	});
	socket.on('movement', function (movement) {
		if (!player || player.health === 0) { return; }
		player.movement = movement;
	});
	socket.on('shoot', function () {
		if (!player || player.health === 0) { return; }
		player.shoot();
	});
	socket.on('jump', function () {
		if (!player || player.health === 0) { return; }
		if(player.onground)player.sy=400;
	});
	socket.on('right_click', function () {
		if (!player || player.health === 0) { return; }
		player.right_click();
	});
	socket.on('left_click', function () {
		if (!player || player.health === 0) { return; }
		player.left_click();
	});
	socket.on('disconnect', () => {
		if (!player) { return; }
		player.remove();
		player = null;
	});
});

setInterval(() => {
	Object.values(players).forEach((player_) => {
		/**
		 * @type {Player}
		 */
		let player=player_
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
		player.sy-=800/30
		player.onground=false;
		player.move(0,0,player.sy/30);
	});
	Object.values(bullets).forEach((bullet) => {
		if (!bullet.move(10,0,0,true,true)) {
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
	io.sockets.emit('state', players, bullets, solids);
}, 1000 / 30);


app.use('/static', express.static(__dirname + '/static'));

app.get('/', (request, response) => {
	response.sendFile(path.join(__dirname, '/static/3d.html'));
});

const port = parseInt(yargs.port) || 3000;
console.log(yargs.world)
server.listen(port, () => {
	console.log(`Starting server on port ${port}`);
	console.log(`URL: http://localhost:${port}`);
});
