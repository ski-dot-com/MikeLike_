'use strict';

const express = require('express');
const http = require('http');
const { type } = require('os');
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
        const old_pos=this.pos.clone();

        this.pos.x += distance_x * Math.cos(this.angle_x);
        this.pos.z += distance_x * Math.sin(this.angle_x);
        this.pos.x -= distance_y * Math.sin(this.angle_x);
        this.pos.z += distance_y * Math.cos(this.angle_x);

        let collision = false;
        if (this.min_pos.x < 0 || this.max_pos.x >= FIELD_SIZE || this.min_pos.z < 0 || this.max_pos.z >= FIELD_SIZE) {
            collision = true;
        }
        if (this.intersectWalls()) {
            collision = true;
        }
        if (collision) {
            this.pos.x = old_pos.x; this.pos.z = old_pos.z;
        }
        return !collision;
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

let players = {};
let bullets = {};
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
