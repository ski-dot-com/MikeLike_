// 描画先の要素
const appElement = document.body;

//
// ➊ three.jsセットアップ
//

// ライブラリの読み込み
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// 座表軸
const axes = new THREE.AxesHelper();

// シーンを初期化
const scene = new THREE.Scene();
scene.add(axes);

// カメラを初期化
const camera = new THREE.PerspectiveCamera(50, appElement.offsetWidth / appElement.offsetHeight);
camera.position.set(1, 1, 1);
camera.lookAt(scene.position);

// レンダラーの初期化
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0xffffff, 1.0); // 背景色
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(appElement.offsetWidth, appElement.offsetHeight);

// レンダラーをDOMに追加
appElement.appendChild(renderer.domElement);

// カメラコントローラー設定
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.maxPolarAngle = Math.PI * 0.5;
orbitControls.minDistance = 0.1;
orbitControls.maxDistance = 100;
orbitControls.autoRotate = true;     // カメラの自動回転設定
orbitControls.autoRotateSpeed = 1.0; // カメラの自動回転速度

// ➋ 描画ループを開始
renderer.setAnimationLoop(() => {
  // カメラコントローラーを更新
  orbitControls.update();

  // 描画する
  renderer.render(scene, camera);
});