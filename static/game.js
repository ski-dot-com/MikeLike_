"use strict";
const socket = io();
const canvas2d = $('#canvas-2d')[0];
const context = canvas2d.getContext('2d');
const canvas3d = $('#canvas-3d')[0];
const playerImage = $("#player-image")[0];
/**
 * @type {HTMLDivElement}
 */
const comment_div=document.getElementById("comment-div");
/**
 * @type {HTMLInputElement}
 */
const comment_prompt=document.getElementById("comment-prompt");

const renderer = new THREE.WebGLRenderer({ canvas: canvas3d });
renderer.setClearColor('skyblue');
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(100, 1, 0.1, 2000);

const isFPS = true;
const mouse_rotate_speed = .001;

camera.position.set(1000, 300, 1000);
camera.lookAt(new THREE.Vector3(500, 0, 500));
camera.matrixAutoUpdate = false;
camera.updateMatrix();
// Materials
{
    const colorMatDict={}
    var getColorMaterial=(color)=>{
        return color in colorMatDict?colorMatDict[color]:(colorMatDict[color]=new THREE.MeshLambertMaterial({ color }))
    }
}
const bulletMaterial = getColorMaterial(0x808080);
const wallMaterial = getColorMaterial('firebrick');
const playerTexture = new THREE.Texture(playerImage);
playerTexture.needsUpdate = true;
const playerMaterial = new THREE.MeshLambertMaterial({ map: playerTexture });
const textMaterial = new THREE.MeshBasicMaterial({ color: 0xf39800, side: THREE.DoubleSide });
const nicknameMaterial = new THREE.MeshBasicMaterial({ color: 'black', side: THREE.DoubleSide });

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(-100, 300, -100);
light.castShadow = true;
light.shadow.camera.left = -2000;
light.shadow.camera.right = 2000;
light.shadow.camera.top = 2000;
light.shadow.camera.bottom = -2000;
light.shadow.camera.far = 2000;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
scene.add(light);
const ambient = new THREE.AmbientLight(0x808080);
scene.add(ambient);

const loader = new THREE.FontLoader();
let font;
loader.load('/static/helvetiker_bold.typeface.json', function (font_) {
    font = font_;
});


// Helpers
// scene.add(new THREE.CameraHelper(light.shadow.camera));
// scene.add(new THREE.GridHelper(200, 50));
// scene.add(new THREE.AxisHelper(2000));
// scene.add(new THREE.DirectionalLightHelper(light, 20));

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

function gameStart() {
    socket.emit('game-start', { nickname: $("#nickname").val() });
    $("#start-screen").hide();
    canvas2d.requestPointerLock();
    isPlaying = true;
}
/**
 * 
 * @param {number?} ms 
 * @returns 
 */
const sleep = (ms=undefined)=>new Promise(resolve=>setTimeout(resolve,ms))
var isPointerLocked = false;
var isPlaying = false;
document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement == canvas2d) {
        isPointerLocked = true;
    } else {
        isPointerLocked = false;
    }
});
document.addEventListener("pointerlockerror", () => {
    isPointerLocked = false;
})
canvas2d.addEventListener("click", (ev) => {
    if (isPlaying)
        if (isPointerLocked) {
            socket.emit(ev.button==0?'left_click':'right_click');
        }
        else {
            canvas2d.requestPointerLock();
        }
})
canvas2d.addEventListener("mousemove", (ev) => {
    if (isPlaying && isPointerLocked) {
        console.log("mousemove")
        movement.r_dx += mouse_rotate_speed*ev.movementX;
        movement.r_dy += mouse_rotate_speed*ev.movementY;
        socket.emit('movement', movement);
    }
})
$("#start-button").on('click', gameStart);

let movement = {
    r_dx: 0,
    r_dy: 0,
};
{
    /**
     * @param {KeyboardEvent} event 
     */
    let tmp = async(event) => {
        if(isPointerLocked){
            const KeyToCommand = {
                'ArrowUp': 'r_up',
                'ArrowDown': 'r_down',
                'ArrowLeft': 'r_left',
                'ArrowRight': 'r_right',
                'KeyW': 'm_forward',
                'KeyS': 'm_back',
                'KeyA': 'm_left',
                'KeyD': 'm_right',
            };
            //console.log(`key=${event.key},members=${[...Object.keys(event)]},code=${event.code}`)
            const command = KeyToCommand[event.code];
            if (command) {
                if (event.type === 'keydown') {
                    movement[command] = true;
                } else { /* keyup */
                    movement[command] = false;
                }
                socket.emit('movement', movement);
            }
            else if (event.key === 'e' && event.type === 'keydown') {
                socket.emit('shoot');
            }
            else if (event.key === ' ' && event.type === 'keydown') {
                socket.emit('jump');
            }
            else if (event.key === '/' && event.type === 'keydown'){
                event.preventDefault()
                document.exitPointerLock()
                comment_prompt.value="/"
                comment_prompt.focus()
            }
            else if (event.key === 't' && event.type === 'keydown'){
                event.preventDefault()
                document.exitPointerLock()
                comment_prompt.focus()
            }
        }
    }
    document.addEventListener("keydown", tmp)
    document.addEventListener("keyup", tmp)
}
/**
 * @type {Map<number, Touch>}
 */
const touches = {};
$('#canvas-2d').on('touchstart', (event) => {
    socket.emit('shoot');
    movement.forward = true;
    socket.emit('movement', movement);
    Array.from(event.changedTouches).forEach((touch) => {
        touches[touch.identifier] = { pageX: touch.pageX, pageY: touch.pageY };
    });
    event.preventDefault();
});
$('#canvas-2d').on('touchmove', (event) => {
    movement.right = false;
    movement.left = false;
    Array.from(event.touches).forEach((touch) => {
        /**
         * @type {Touch}
         */
        const startTouch = touches[touch.identifier];
        movement.right |= touch.pageX - startTouch.pageX > 30;
        movement.left |= touch.pageX - startTouch.pageX < -30;
    });
    socket.emit('movement', movement);
    event.preventDefault();
});
$('#canvas-2d').on('touchend', (event) => {
    Array.from(event.changedTouches).forEach((touch) => {
        delete touches[touch.identifier];
    });
    if (Object.keys(touches).length === 0) {
        movement = {};
        socket.emit('movement', movement);
    }
    event.preventDefault();
});

const Meshes = [];
socket.on('state', (players, bullets, solids) => {
    Object.values(Meshes).forEach((mesh) => { mesh.used = false; });
    /**
     * @typedef {{x:number,y:number,z:number}} Vector3Like
     */
    /**
     * 
     * @param {{pos:Vector3Like,min:Vector3Like,max:Vector3Like,size:Vector3Like,id:number}} param0 
     * @param {THREE.Material} mat 
     */
    function drawHitBox({pos,min,max,size,id},mat) {
        let mid = new THREE.Vector3(
            (max.x+min.x)/2+pos.x,
            (max.y+min.y)/2+pos.y,
            (max.z+min.z)/2+pos.z
            )
        let mesh = Meshes[id];
        if (!mesh) {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
            mesh.castShadow = true;
            Meshes[id] = mesh;
            scene.add(mesh);
        }
        mesh.used = true;
        mesh.position.set(mid.x, mid.y, mid.z);
    }
    // Players
    Object.values(players).forEach((player) => {
        // /** @type {{a:number}}*/let player=player_;
        let playerMesh = Meshes[player.id];
        if (!playerMesh) {
            console.log('create player mesh');
            playerMesh = new THREE.Group();
            playerMesh.castShadow = true;
            Meshes[player.id] = playerMesh;
            scene.add(playerMesh);
        }
        let mid = new THREE.Vector3(
            (player.max.x+player.min.x)/2+player.pos.x,
            (player.max.y+player.min.y)/2+player.pos.y,
            (player.max.z+player.min.z)/2+player.pos.z
            ),
            min_pos = new THREE.Vector3(
            player.min.x+player.pos.x,
            player.min.y+player.pos.y,
            player.min.z+player.pos.z
            ),
            max_pos = new THREE.Vector3(
            player.max.x+player.pos.x,
            player.max.y+player.pos.y,
            player.max.z+player.pos.z
            )
        playerMesh.used = true;
        /**@type {THREE.Vector3}*/(playerMesh.position).copy(mid);
        playerMesh.rotation.y = - player.angle_x;
        playerMesh.rotation.z = player.angle_y;

        if (!playerMesh.getObjectByName('body')) {
            console.log('create body mesh');
            let mesh = new THREE.Mesh(new THREE.BoxGeometry(player.size.x, player.size.y, player.size.z), playerMaterial);
            mesh.castShadow = true;
            mesh.name = 'body';
            playerMesh.add(mesh);
        }

        if (font) {
            if (!playerMesh.getObjectByName('nickname')) {
                console.log('create nickname mesh');
                let mesh = new THREE.Mesh(
                    new THREE.TextGeometry(player.nickname,
                        { font: font, size: 10, height: 1 }),
                    nicknameMaterial,
                );
                mesh.name = 'nickname';
                playerMesh.add(mesh);

                mesh.position.set(0, player.max.y + 30, 0);
                mesh.rotation.y = Math.PI / 2;
            }
            {
                let mesh = playerMesh.getObjectByName('health');

                if (mesh && mesh.health !== player.health) {
                    playerMesh.remove(mesh);
                    mesh.geometry.dispose();
                    mesh = null;
                }
                if (!mesh) {
                    console.log('create health mesh');
                    mesh = new THREE.Mesh(
                        new THREE.TextGeometry('*'.repeat(player.health).padEnd(10,"-"),
                            { font: font, size: 10, height: 1 }),
                        textMaterial,
                    );
                    mesh.name = 'health';
                    mesh.health = player.health;
                    playerMesh.add(mesh);
                }
                mesh.position.set(0, player.max.y + 10, 0);
                mesh.rotation.y = Math.PI / 2;
            }
        }


        if (player.socketId === socket.id) {
            // Your player
            const tmp = 150 * !isFPS
            camera.position.set(
                mid.x - tmp * Math.cos(player.angle_x) * Math.cos(player.angle_y),
                mid.y - tmp * Math.sin(player.angle_y),
                mid.z - tmp * Math.sin(player.angle_x) * Math.cos(player.angle_y)
            );
            camera.rotation.set(0, - player.angle_x - Math.PI / 2, 0);
            camera.updateMatrix();
            camera.matrix.multiply(new THREE.Matrix4().makeRotationX(player.angle_y));
            // camera.rotation.set(player.angle_y, 0, 0);
            // Write to 2D canvas
            context.clearRect(0, 0, canvas2d.width, canvas2d.height);
            context.font = '30px Bold Arial';
            context.fillText('You', 20, 40);
            context.fillText(player.point + ' point', 100, 40);
            context.font = '30px Bold Arial';
            context.fillText('HP', 20, 80);
            context.fillText('*'.repeat(player.health).padEnd(10,"-"), 100, 80);
            context.font = '30px Bold Arial';
            context.fillText('pos', 20, 120);
            context.fillText(`(${player.pos.x},${player.pos.y},${player.pos.z})`, 100, 120);
        }
    });

    // Bullets
    Object.values(bullets).forEach((bullet) => {
        drawHitBox(bullet,bulletMaterial)
    });

    // Walls
    Object.values(solids).forEach((solid) => {
        drawHitBox(solid,getColorMaterial(solid.color))
    });

    // Clear unused Meshes
    Object.keys(Meshes).forEach((key) => {
        const mesh = Meshes[key];
        if (!mesh.used) {
            scene.remove(mesh);
            mesh.traverse((mesh2) => {
                if (mesh2.geometry) {
                    mesh2.geometry.dispose();
                }
            });
            delete Meshes[key];
            console.log(`mesh#${key} collected`);
        }
    });
    movement.r_dx=movement.r_dy=0;
});

socket.on('dead', () => {
    document.exitPointerLock();
    $("#start-screen").show();
    isPlaying = false;
});
socket.on("message",(message, type)=>{
    const tmp = document.createElement("p");
    tmp.classList.add(type)
    tmp.innerText=message;
    comment_div.insertBefore(tmp,comment_div.lastElementChild)
    setTimeout(()=>{
        tmp.animate([
            {
                opacity: 1
            },
            {
                opacity: 0
            },
        ],3000).addEventListener("finish",(ev)=>{
            tmp.remove()
        })
    },12000)
})
comment_prompt.addEventListener("keydown",(ev)=>{
    if(ev.key!="Enter")return
    socket.emit("comment",comment_prompt.value);
    comment_prompt.value="";
    comment_prompt.blur();
    canvas2d.requestPointerLock();
    canvas2d.focus();
})