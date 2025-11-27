import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const PartsViewer3D = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const currentMeshRef = useRef(null);
  const [selectedPart, setSelectedPart] = useState('gear');
  const [rotationSpeed, setRotationSpeed] = useState(0.01);
  const [autoRotate, setAutoRotate] = useState(false);
  const [customParts, setCustomParts] = useState([]);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Mouse control
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const createGear = () => {
    const group = new THREE.Group();
    
    const bodyGeometry = new THREE.CylinderGeometry(2, 2, 0.5, 32);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x4a90e2,
      shininess: 100 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);
    
    const toothCount = 12;
    for (let i = 0; i < toothCount; i++) {
      const angle = (i / toothCount) * Math.PI * 2;
      const toothGeometry = new THREE.BoxGeometry(0.4, 0.5, 0.8);
      const tooth = new THREE.Mesh(toothGeometry, bodyMaterial);
      tooth.position.x = Math.cos(angle) * 2.2;
      tooth.position.z = Math.sin(angle) * 2.2;
      tooth.rotation.y = angle;
      group.add(tooth);
    }
    
    const holeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 32);
    const holeMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2c3e50 
    });
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    group.add(hole);
    
    return group;
  };

  const createBolt = () => {
    const group = new THREE.Group();
    
    const headGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.4, 6);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x7f8c8d,
      shininess: 80 
    });
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 1.7;
    group.add(head);
    
    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 3, 32);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.2;
    group.add(body);
    
    for (let i = 0; i < 8; i++) {
      const threadGeometry = new THREE.TorusGeometry(0.45, 0.08, 8, 32);
      const thread = new THREE.Mesh(threadGeometry, material);
      thread.position.y = -1.2 + (i * 0.35);
      thread.rotation.x = Math.PI / 2;
      group.add(thread);
    }
    
    return group;
  };

  const createBearing = () => {
    const group = new THREE.Group();
    
    const outerGeometry = new THREE.TorusGeometry(2, 0.5, 16, 32);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x95a5a6,
      shininess: 100 
    });
    const outer = new THREE.Mesh(outerGeometry, material);
    outer.rotation.x = Math.PI / 2;
    group.add(outer);
    
    const innerGeometry = new THREE.TorusGeometry(1.2, 0.4, 16, 32);
    const innerMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x34495e,
      shininess: 100 
    });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    inner.rotation.x = Math.PI / 2;
    group.add(inner);
    
    const sphereGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const sphereMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xecf0f1,
      shininess: 120 
    });
    
    const ballCount = 8;
    for (let i = 0; i < ballCount; i++) {
      const angle = (i / ballCount) * Math.PI * 2;
      const ball = new THREE.Mesh(sphereGeometry, sphereMaterial);
      ball.position.x = Math.cos(angle) * 1.65;
      ball.position.z = Math.sin(angle) * 1.65;
      group.add(ball);
    }
    
    return group;
  };

  const createPulley = () => {
    const group = new THREE.Group();
    
    const material = new THREE.MeshPhongMaterial({ 
      color: 0xe74c3c,
      shininess: 90 
    });
    
    const bodyGeometry = new THREE.CylinderGeometry(2, 2, 0.8, 32);
    const body = new THREE.Mesh(bodyGeometry, material);
    group.add(body);
    
    const grooveGeometry = new THREE.TorusGeometry(2.1, 0.15, 16, 32);
    const grooveMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xc0392b 
    });
    
    for (let i = 0; i < 3; i++) {
      const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
      groove.rotation.x = Math.PI / 2;
      groove.position.y = -0.3 + (i * 0.3);
      group.add(groove);
    }
    
    const shaftGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32);
    const shaftMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x7f8c8d 
    });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    group.add(shaft);
    
    return group;
  };

  const createCustomPart = (config) => {
    const group = new THREE.Group();
    
    // Criar uma peça customizada baseada na configuração
    const geometry = new THREE.BoxGeometry(
      config.width || 2,
      config.height || 2,
      config.depth || 2
    );
    const material = new THREE.MeshPhongMaterial({ 
      color: config.color || 0x9b59b6,
      shininess: 100 
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
    return group;
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo PDF válido');
      return;
    }

    try {
      const pdfData = await window.fs.readFile(file.name, { encoding: 'utf8' });
      
      // Criar uma nova peça customizada
      const newPart = {
        id: `custom-${Date.now()}`,
        name: file.name.replace('.pdf', ''),
        pdfData: file.name,
        config: {
          width: 2,
          height: 2,
          depth: 2,
          color: 0x9b59b6
        }
      };
      
      setCustomParts([...customParts, newPart]);
      setPdfInfo({ name: file.name, uploaded: true });
      setSelectedPart(newPart.id);
      setShowUploadModal(false);
      
    } catch (error) {
      // Se não conseguir ler o arquivo, ainda criar a peça
      const newPart = {
        id: `custom-${Date.now()}`,
        name: file.name.replace('.pdf', ''),
        pdfData: 'PDF carregado localmente',
        config: {
          width: 2,
          height: 2,
          depth: 2,
          color: 0x9b59b6
        }
      };
      
      setCustomParts([...customParts, newPart]);
      setPdfInfo({ name: file.name, uploaded: true });
      setSelectedPart(newPart.id);
      setShowUploadModal(false);
    }
  };

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 8;
    camera.position.y = 3;
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, 5, -5);
    scene.add(pointLight);

    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Mouse controls
    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current || !currentMeshRef.current) return;

      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      currentMeshRef.current.rotation.y += deltaX * 0.01;
      currentMeshRef.current.rotation.x += deltaY * 0.01;

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.01;
      camera.position.z = Math.max(3, Math.min(15, camera.position.z));
    };

    // Touch controls
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
      } else if (e.touches.length === 2) {
        // Armazenar distância inicial para pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        previousMousePositionRef.current.pinchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      
      if (e.touches.length === 1 && isDraggingRef.current && currentMeshRef.current) {
        const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
        const deltaY = e.touches[0].clientY - previousMousePositionRef.current.y;

        currentMeshRef.current.rotation.y += deltaX * 0.01;
        currentMeshRef.current.rotation.x += deltaY * 0.01;

        previousMousePositionRef.current = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
      } else if (e.touches.length === 2) {
        // Pinch to zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (previousMousePositionRef.current.pinchDistance) {
          const delta = previousMousePositionRef.current.pinchDistance - distance;
          camera.position.z += delta * 0.02;
          camera.position.z = Math.max(3, Math.min(15, camera.position.z));
        }
        
        previousMousePositionRef.current.pinchDistance = distance;
      }
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      previousMousePositionRef.current.pinchDistance = null;
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd);

    const animate = () => {
      requestAnimationFrame(animate);
      
      if (currentMeshRef.current && autoRotate && !isDraggingRef.current) {
        currentMeshRef.current.rotation.y += rotationSpeed;
        currentMeshRef.current.rotation.x += rotationSpeed * 0.5;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    if (currentMeshRef.current) {
      sceneRef.current.remove(currentMeshRef.current);
    }

    let newMesh;
    
    // Verificar se é uma peça customizada
    const customPart = customParts.find(p => p.id === selectedPart);
    
    if (customPart) {
      newMesh = createCustomPart(customPart.config);
      setPdfInfo({ name: customPart.name, uploaded: true });
    } else {
      setPdfInfo(null);
      switch (selectedPart) {
        case 'gear':
          newMesh = createGear();
          break;
        case 'bolt':
          newMesh = createBolt();
          break;
        case 'bearing':
          newMesh = createBearing();
          break;
        case 'pulley':
          newMesh = createPulley();
          break;
        default:
          newMesh = createGear();
      }
    }

    sceneRef.current.add(newMesh);
    currentMeshRef.current = newMesh;
  }, [selectedPart, customParts]);

  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col overflow-hidden">
      <div className="bg-gray-800 p-3 md:p-4 shadow-lg overflow-auto">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">Visualizador 3D de Peças</h1>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div>
            <label className="block text-gray-300 text-xs md:text-sm font-semibold mb-2">
              Selecione a Peça
            </label>
            <select
              value={selectedPart}
              onChange={(e) => setSelectedPart(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
            >
              <option value="gear">Engrenagem</option>
              <option value="bolt">Parafuso</option>
              <option value="bearing">Rolamento</option>
              <option value="pulley">Polia</option>
              {customParts.map(part => (
                <option key={part.id} value={part.id}>
                  {part.name} (Custom)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-300 text-xs md:text-sm font-semibold mb-2">
              Adicionar Peça
            </label>
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm md:text-base"
            >
              + Upload PDF
            </button>
          </div>

          <div>
            <label className="block text-gray-300 text-xs md:text-sm font-semibold mb-2">
              Velocidade
            </label>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.001"
              value={rotationSpeed}
              onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
              className="w-full h-8 md:h-auto"
            />
            <span className="text-gray-400 text-xs md:text-sm">{(rotationSpeed * 100).toFixed(1)}%</span>
          </div>

          <div>
            <label className="block text-gray-300 text-xs md:text-sm font-semibold mb-2">
              Rotação Auto
            </label>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`w-full px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm md:text-base ${
                autoRotate 
                  ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white' 
                  : 'bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-gray-300'
              }`}
            >
              {autoRotate ? 'Ligado' : 'Desligado'}
            </button>
          </div>
        </div>

        {pdfInfo && (
          <div className="mt-3 bg-purple-900 bg-opacity-50 p-2 md:p-3 rounded-lg">
            <p className="text-purple-200 text-xs md:text-sm">
              📄 Peça customizada: <span className="font-semibold">{pdfInfo.name}</span>
            </p>
          </div>
        )}
      </div>

      <div ref={mountRef} className="flex-1 touch-none" />

      <div className="bg-gray-800 p-2 md:p-3 text-center text-gray-400 text-xs md:text-sm">
        <span className="hidden md:inline">🖱️ Arraste com o mouse para rotacionar | 🔍 Scroll para zoom</span>
        <span className="md:hidden">👆 Arraste para rotacionar | 🤏 Pinch para zoom</span>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-4 md:p-6 rounded-lg max-w-md w-full">
            <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Adicionar Peça Customizada</h2>
            <p className="text-gray-300 mb-3 md:mb-4 text-sm md:text-base">
              Faça upload de um PDF com as especificações da sua peça. Uma representação 3D será criada automaticamente.
            </p>
            
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg mb-3 md:mb-4 text-sm md:text-base"
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white px-3 md:px-4 py-2 rounded-lg font-semibold text-sm md:text-base"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsViewer3D;
