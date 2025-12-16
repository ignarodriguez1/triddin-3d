import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./style.css";

function showError(message) {
  const container = document.getElementById("error-container");
  container.textContent = message;
  container.style.display = "block";
  console.error(message);
}

// 1. Verificación explícita de soporte WebGL
function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

if (!isWebGLAvailable()) {
  showError("Tu navegador o tarjeta gráfica no soporta WebGL.");
} else {
  try {
    // 2. Inicialización de Three.js
    const canvas = document.getElementById("glCanvas");
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true, // Permitir transparencia si se necesita
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Mejorar nitidez en pantallas de alta densidad
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Mejora colores
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mapeo de tonos cinemático
    renderer.toneMappingExposure = 0.6; // Reducido para evitar blancos quemados (antes 1.0)
    renderer.shadowMap.enabled = true; // Habilitar sombras
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333); // Fondo gris oscuro

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Controles de Cámara
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Mejorar iluminación con entorno
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;

    // Luces adicionales para resaltar
    // Reducido intensidad de luz ambiental
    const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
    scene.add(ambientLight);

    // Reducido intensidad de luz direccional
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7.5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096; // Sombras ultra definadas (4K)
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.bias = -0.0001; // Reducir artefactos en sombras
    scene.add(dirLight);

    // Luz de borde (Rim Light) ajustada
    const rimLight = new THREE.SpotLight(0xffffff, 1.5);
    rimLight.position.set(-5, 5, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // Configurar DRACOLoader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.4.3/"
    );

    // Cargar GLB con soporte Draco
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // Note: The path is relative to the root served by Vite.
    // Since we moved it to public/, it is served at root "/T01_V6.glb".
    loader.load(
      "/T01_V6.glb",
      (gltf) => {
        scene.add(gltf.scene);

        // Configurar sombras y calidad de texturas en el modelo
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Mejorar reflejos
            if (child.material) {
              child.material.envMapIntensity = 1.5; // Aumentar intensidad de reflejos
              child.material.needsUpdate = true;

              // Filtrado Anisotrópico para texturas nítidas en ángulos oblicuos
              if (child.material.map)
                child.material.map.anisotropy =
                  renderer.capabilities.getMaxAnisotropy();
              if (child.material.emissiveMap)
                child.material.emissiveMap.anisotropy =
                  renderer.capabilities.getMaxAnisotropy();
              if (child.material.roughnessMap)
                child.material.roughnessMap.anisotropy =
                  renderer.capabilities.getMaxAnisotropy();
              if (child.material.metalnessMap)
                child.material.metalnessMap.anisotropy =
                  renderer.capabilities.getMaxAnisotropy();
              if (child.material.normalMap)
                child.material.normalMap.anisotropy =
                  renderer.capabilities.getMaxAnisotropy();
            }
          }
        });

        // Auto-centrar y escalar modelo
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Resetear posición
        gltf.scene.position.x += gltf.scene.position.x - center.x;
        gltf.scene.position.y += gltf.scene.position.y - center.y;
        gltf.scene.position.z += gltf.scene.position.z - center.z;

        // Ajustar escala
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        gltf.scene.scale.multiplyScalar(scale);

        console.log("Modelo cargado correctamente");
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% cargado");
      },
      (error) => {
        console.error("Error cargando GLB:", error);
        showError("Error cargando el modelo: " + error.message);
      }
    );

    // Loop de animación
    function animate() {
      requestAnimationFrame(animate);
      controls.update(); // Necesario si enableDamping es true
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  } catch (e) {
    showError("Error inicializando Three.js: " + e.message);
  }
}
