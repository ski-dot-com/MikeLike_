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
const fs = require("fs")
const { Vector3 } = THREE;
const {
    GameObject,
    Player,
    Bullet,
    Solid,
	Wall,
	Block
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
	/**
	 * @param {string} comment 
	 */
	function onComment(comment) {
		if (!player || player.health === 0) { return; }
		if (comment.startsWith("/"))return runCommand(comment.slice(1),player)
		if (comment.startsWith("#"))comment=comment.slice(1)
		sendComment(comment, player.nickname)
	}
	socket.on('comment', onComment);
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
const world_path = yargs.world||path.join(__dirname,"default.mkw.json")
readif:if(fs.existsSync(world_path)){
	console.log(`Loading world from "${world_path}"...`);
	readtry:try{
		const world=JSON.parse(fs.readFileSync(world_path).toString())
		if(world.version!==1){
			console.error(`Error: Not supported version: ${world.version}`)
			break readtry;
		}
		[...world.blocks].forEach(v=>new Block(v))
		break readif;
	}
	catch(e) {
		console.error(`Error: ${e}`)
	}
	console.log("Loading Skipped.")
}
function saveWorld(){
	console.log(`Saving world to "${world_path}"...`);
	fs.writeFileSync(world_path,JSON.stringify({
		version:1,
		blocks:Object.values(Block.all).map(v=>v.toJSON())
	}))
	console.log(`World was saved to "${world_path}"...`);
}
{
	function exitHandler(options, exitCode) {
		if (options.cleanup) {
			saveWorld()
		}
		if (exitCode || exitCode === 0) console.log(exitCode);
		if (options.exit) process.exit();
	}

	// do something when app is closing
	process.on('exit', exitHandler.bind(null,{cleanup:true}));

	// catches ctrl+c event
	process.on('SIGINT', exitHandler.bind(null, {exit:true}));

	// catches "kill pid" (for example: nodemon restart)
	process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
	process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

	// catches uncaught exceptions
	process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
}
server.listen(port, () => {
	console.log(`Server Started on port ${port}`);
	console.log(`URL: http://localhost:${port}`);
});
/**
 * コメントを送る。
 * @param {string} message 送るコメント
 * @param {string} user コメントを送るユーザー名
 */
function sendComment(message, user){
	sendMessage(`[${user}]: `+message,"comment")
}
/**
 * メッセージを送る。
 * @param {string} message 送るメッセージ
 * @param {string} user 送るメッセージの種類
 */
function sendMessage(message, type){
	console.log(`${type}: ${message}`)
	io.sockets.emit('message', message, type);
}
/**
 * コマンドを実行する。
 * @param {string} command 実行するコマンド
 * @param {Player} player コマンドを実行したプレイヤー
 */
function runCommand(command,player){
	const args = command.split(/\s/).filter(v=>!!v.length)
	console.log(args)
	if(args.length)switch(args[0]){
		case "set_block_color":
			if(args.length!=2)return runCommand("help set_block_color",player),sendMessage("[Error]: 呼び出し方が不適切です。","error");
			sendMessage(`[Info]: ${player.nickname}が手持ちのブロックの色を"${player.color=args[1]}"に変えました。`,"info");
			return;
		case "save":
			if(args.length!=1)return runCommand("help save",player),sendMessage("[Error]: 呼び出し方が不適切です。","error");
			saveWorld()
			sendMessage(`[Info]: ${player.nickname}がワールドをセーブしました。`,"info");
			return;
		case "help":
			if(args.length!=2){
				sendMessage("set_block_color ブロックの色","info")
				sendMessage("help [コマンド]","info")
				sendMessage("save","info")
				return;
			}
			switch(args[1]){
				case "set_block_color":
					sendMessage("set_block_color ブロックの色","info")
					return;
				case "save":
					sendMessage("save","info")
					return;
				case "help":
					sendMessage("help [コマンド]","info")
					return;
			}
	}
	return runCommand("help",player),sendMessage("[Error]: 不明なコマンドです。","error");
}