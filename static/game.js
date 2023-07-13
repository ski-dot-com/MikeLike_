const socket = io();
const canvas2d = $('#canvas-2d')[0];
const context = canvas2d.getContext('2d');
const canvas3d = $('#canvas-3d')[0];
const playerImage = $("#player-image")[0];

const renderer = new THREE.WebGLRenderer({ canvas: canvas3d });
renderer.setClearColor('skyblue');
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(100, 1, 0.1, 2000);

const isFPS = true;
const mouse_rotate_speed = .001;

// Floor
const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 'lawngreen' });
const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.position.set(500, 0, 500);
floorMesh.receiveShadow = true;
floorMesh.rotation.x = - Math.PI / 2;
scene.add(floorMesh);

camera.position.set(1000, 300, 1000);
camera.lookAt(floorMesh.position);
camera.matrixAutoUpdate = false;
camera.updateMatrix();
// Materials
const bulletMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
const wallMaterial = new THREE.MeshLambertMaterial({ color: 'firebrick' });
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
canvas2d.addEventListener("click", () => {
    if (isPlaying)
        if (isPointerLocked) {
            // TODO クリック時の処理を実装
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
    let tmp = (event) => {
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
        if (event.key === ' ' && event.type === 'keydown') {
            socket.emit('shoot');
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
socket.on('state', (players, bullets, walls) => {
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
            mesh = new THREE.Mesh(new THREE.BoxGeometry(player.size.x, player.size.y, player.size.z), playerMaterial);
            mesh.castShadow = true;
            mesh.name = 'body';
            playerMesh.add(mesh);
        }

        if (font) {
            if (!playerMesh.getObjectByName('nickname')) {
                console.log('create nickname mesh');
                mesh = new THREE.Mesh(
                    new THREE.TextGeometry(player.nickname,
                        { font: font, size: 10, height: 1 }),
                    nicknameMaterial,
                );
                mesh.name = 'nickname';
                playerMesh.add(mesh);

                mesh.position.set(0, mid.y + 30, 0);
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
                        new THREE.TextGeometry('*'.repeat(player.health),
                            { font: font, size: 10, height: 1 }),
                        textMaterial,
                    );
                    mesh.name = 'health';
                    mesh.health = player.health;
                    playerMesh.add(mesh);
                }
                mesh.position.set(0, mid.y + 10, 0);
                mesh.rotation.y = Math.PI / 2;
            }
        }


        if (player.socketId === socket.id) {
            // Your player
            const tmp = 150 * !isFPS
            camera.position.set(
                mid.x / 2 - tmp * Math.cos(player.angle_x) * Math.cos(player.angle_y),
                mid.y / 2 - tmp * Math.sin(player.angle_y),
                mid.z / 2 - tmp * Math.sin(player.angle_x) * Math.cos(player.angle_y)
            );
            camera.rotation.set(0, - player.angle_x - Math.PI / 2, 0);
            camera.updateMatrix();
            camera.matrix.multiply(new THREE.Matrix4().makeRotationX(player.angle_y));
            // camera.rotation.set(player.angle_y, 0, 0);
            // Write to 2D canvas
            context.clearRect(0, 0, canvas2d.width, canvas2d.height);
            context.font = '30px Bold Arial';
            context.fillText('You', 20, 0);
            context.fillText(player.point + ' point', 20, 40);
        }
    });

    // Bullets
    Object.values(bullets).forEach((bullet) => {
        drawHitBox(bullet,bulletMaterial)
    });

    // Walls
    Object.values(walls).forEach((wall) => {
        drawHitBox(wall,wallMaterial)
    });

    // Clear unused Meshes
    Object.keys(Meshes).forEach((key) => {
        const mesh = Meshes[key];
        if (!mesh.used) {
            console.log('removing mesh', key);
            scene.remove(mesh);
            mesh.traverse((mesh2) => {
                if (mesh2.geometry) {
                    mesh2.geometry.dispose();
                }
            });
            delete Meshes[key];
        }
    });
    movement.r_dx=movement.r_dy=0;
});

socket.on('dead', () => {
    document.exitPointerLock();
    $("#start-screen").show();
    isPlaying = false;
});
