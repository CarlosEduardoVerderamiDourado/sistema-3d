// PartsViewer3D.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSG } from "three-csg-ts";
import { MeshBVH } from "three-mesh-bvh";

// --- Utilitários ---
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const pcmToWav = (pcmData, sampleRate) => {
  const numChannels = 1, sampleBits = 16;
  const byteRate = sampleRate * numChannels * sampleBits / 8;
  const pcmInt16 = new Int16Array(pcmData.buffer);
  const dataSize = pcmInt16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset++, str.charCodeAt(i)); };

  writeString("RIFF"); view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");
  writeString("fmt "); view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, numChannels * sampleBits / 8, true); offset += 2;
  view.setUint16(offset, sampleBits, true); offset += 2;
  writeString("data"); view.setUint32(offset, dataSize, true); offset += 4;

  for (let i = 0; i < pcmInt16.length; i++) { view.setInt16(offset, pcmInt16[i], true); offset += 2; }
  return new Blob([buffer], { type: "audio/wav" });
};

// --- Cache de materiais ---
const materialCache = {};
const getMaterial = (color) => {
  const colorHex = typeof color === "string" ? new THREE.Color(color).getHex() : color;
  if (!materialCache[colorHex]) materialCache[colorHex] = new THREE.MeshPhongMaterial({ color: colorHex });
  return materialCache[colorHex];
};

// --- Geometria primitiva ---
const getPrimitiveMesh = (part) => {
  let geometry;
  switch (part.tipo) {
    case "cilindro": geometry = new THREE.CylinderGeometry((part.diametro || 1)/2, (part.diametro || 1)/2, part.altura || 1, 32); break;
    case "esfera": geometry = new THREE.SphereGeometry((part.diametro || 1)/2, 32, 32); break;
    case "cubo":
    default: geometry = new THREE.BoxGeometry(part.largura || 1, part.altura || 1, part.profundidade || 1); break;
  }
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, getMaterial(part.cor || "#007bff"));
  if (Array.isArray(part.posicao) && part.posicao.length === 3) mesh.position.set(...part.posicao);
  if (Array.isArray(part.rotacao) && part.rotacao.length === 3) mesh.rotation.set(...part.rotacao);
  return mesh;
};

// --- Mesh com suporte CSG ---
const createMesh = (part) => {
  const baseMesh = getPrimitiveMesh(part);
  if (!baseMesh) return null;

  let finalMesh = baseMesh;

  if (part.operacoes && Array.isArray(part.operacoes) && part.operacoes.length > 0) {
    let csg = CSG.fromMesh(baseMesh);

    part.operacoes.forEach(op => {
      const opMesh = getPrimitiveMesh(op);
      if (!opMesh) return;

      const opCSG = CSG.fromMesh(opMesh);
      if (op.operacao === "subtrair") csg = csg.subtract(opCSG);
      else if (op.operacao === "unir") csg = csg.union(opCSG);

      opMesh.geometry.dispose();
    });

    finalMesh = CSG.toMesh(csg, baseMesh.matrix, getMaterial(part.cor || "#007bff"));
    finalMesh.position.set(0, 0, 0);
  }

  return finalMesh;
};

// --- Setup da cena ---
const setupScene = (canvasRef, meshesRef, selectedPartsRef) => {
  if (!canvasRef.current) return;
  const canvas = canvasRef.current;

  if (!meshesRef.current.scene) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    scene.add(new THREE.GridHelper(20, 20, 0xaaaaaa, 0x555555));

    meshesRef.current = { scene, camera, renderer, controls, objects: [] };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  meshesRef.current.objects.forEach(mesh => {
    meshesRef.current.scene.remove(mesh);
    mesh.geometry.dispose();
  });
  meshesRef.current.objects = [];

  selectedPartsRef.current.forEach(part => {
    const mesh = createMesh(part);
    if (mesh) {
      meshesRef.current.scene.add(mesh);
      meshesRef.current.objects.push(mesh);
    }
  });

  const { objects, controls, camera } = meshesRef.current;
  if (objects.length > 0) {
    const box = new THREE.Box3().setFromObject(objects[0]);
    for (let i = 1; i < objects.length; i++) box.union(new THREE.Box3().setFromObject(objects[i]));
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    controls.target.copy(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;
    cameraZ = Math.max(cameraZ, 5);
    camera.position.copy(center).add(new THREE.Vector3(0, 0, cameraZ));
    controls.update();
    camera.updateProjectionMatrix();
  }
};

// --- Modal de upload ---
const UploadModal = ({ onClose, onFileBase64, setApiMessage }) => {
  const fileRef = useRef();
  const [processing,setProcessing] = useState(false);

  const handleChange = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.type!=="application/pdf"){ setApiMessage({type:"error",text:"Envie um PDF válido."}); return;}
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setProcessing(true);
      await onFileBase64(base64);
      setProcessing(false);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-6">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-900">Upload de PDF</h2>
        <input type="file" hidden ref={fileRef} accept="application/pdf" onChange={handleChange} />
        <button onClick={()=>fileRef.current.click()} className="w-full bg-blue-600 text-white py-2 rounded-lg mt-2">
          {processing?"Processando...":"Selecionar PDF"}
        </button>
        <button onClick={onClose} className="w-full bg-gray-300 text-gray-800 py-2 rounded-lg mt-3">Fechar</button>
      </div>
    </div>
  );
};

// --- App principal ---
const App = () => {
  const [selectedParts,setSelectedParts] = useState([{
    tipo:"cubo",largura:3,altura:2,profundidade:3,cor:"#00aaff",posicao:[0,0,0],
    operacoes:[{ tipo:"cilindro",diametro:0.5,altura:4,cor:"#ffffff",posicao:[0,0,0],rotacao:[Math.PI/2,0,0],operacao:"subtrair" }]
  }]);
  const [apiMessage,setApiMessage] = useState({type:"",text:""});
  const [showUpload,setShowUpload] = useState(false);
  const [ttsUrl,setTtsUrl] = useState(null);

  const canvasRef = useRef(null);
  const meshesRef = useRef({});
  const selectedPartsRef = useRef(selectedParts);
  selectedPartsRef.current = selectedParts;

  useEffect(()=>{ setupScene(canvasRef,meshesRef,selectedPartsRef); },[selectedParts]);
  useEffect(()=>{
    const handleResize = ()=>{
      const { renderer,camera,controls } = meshesRef.current;
      if(!renderer || !camera) return;
      camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRef.current.clientWidth,canvasRef.current.clientHeight);
      controls.update();
    };
    window.addEventListener("resize",handleResize);
    return ()=>window.removeEventListener("resize",handleResize);
  },[]);

  // --- Função Gemini PDF --- (CORRIGIDO)
  const processPdfGemini = useCallback(async (base64)=>{
    setApiMessage({type:"info",text:"Processando PDF no Gemini..."});

    const API_KEY = "AIzaSyAGaL_uDBqapnY4mQLykvACzSzEDebL080"; // coloque sua chave real aqui

    const apiUrl = 
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const optimizedPrompt = `
      Você é um especialista em extração de dados CAD/Mecânicos.
      Analise o diagrama do Torno Mecânico no PDF e gere as principais peças
      (Base, Cabeçote Fixo, Contra-cabeçote, Carro)
      em formato JSON estrito para montagem 3D.
      Apenas retorne um único array JSON.
    `;

    const payload = {
      contents:[
        {
          role:"user",
          parts:[
            {text:optimizedPrompt},
            {inlineData:{mimeType:"application/pdf",data:base64}}
          ]
        }
      ],
      generationConfig:{ responseMimeType:"application/json" }
    };

    try {
      const res = await fetch(apiUrl,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });

      if(!res.ok){
        const errorData = await res.json();
        throw new Error(
          `API Gemini retornou status ${res.status}: ${errorData.error?.message}`
        );
      }

      const data = await res.json();
      const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      let parts = [];
      try {
        parts = JSON.parse(jsonText);
        if(!Array.isArray(parts)) throw new Error("Resposta não é um array");
      } catch(e){
        setApiMessage({type:"error",text:`Gemini retornou JSON inválido: ${e.message}`});
        return;
      }

      setSelectedParts(parts);
      setApiMessage({type:"success",text:`Montagem com ${parts.length} peça(s) carregada(s)!`});

    } catch(error){
      setApiMessage({type:"error",text:`Erro de API ou Rede: ${error.message}`});
    }
  },[]);

  // --- Função TTS --- (CORRIGIDO)
  const speak = useCallback(async ()=>{
    if(ttsUrl) URL.revokeObjectURL(ttsUrl);

    const API_KEY = "AIzaSyAGaL_uDBqapnY4mQLykvACzSzEDebL080";

    const apiUrl = 
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`;

    const payload = {
      contents:[{ parts:[{ text:"Peças carregadas e montadas com sucesso!" }] }],
      generationConfig:{
        responseModalities:["AUDIO"],
        speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:"Puck" } } }
      }
    };

    try{
      const res = await fetch(apiUrl,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });

      if(!res.ok){
        const errorData = await res.json();
        throw new Error(
          `API TTS retornou status ${res.status}: ${errorData.error?.message}`
        );
      }

      const json = await res.json();
      const audioData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if(audioData){
        const pcmBuffer = base64ToArrayBuffer(audioData);
        const pcm16 = new Int16Array(pcmBuffer);
        const wavBlob = pcmToWav(pcm16, 16000);
        setTtsUrl(URL.createObjectURL(wavBlob));
      } else {
        setApiMessage({type:"error",text:"TTS falhou: sem áudio retornado."});
      }

    } catch(error){
      setApiMessage({type:"error",text:`Erro ao reproduzir áudio: ${error.message}`});
    }
  },[ttsUrl]);

  return (
    <div className="p-4 text-white bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Visualizador 3D de Maquinário + PDF Gemini</h1>

      <div className="flex gap-4 mb-4">
        <button className="bg-blue-600 px-4 py-2 rounded-lg" onClick={()=>setShowUpload(true)}>Enviar PDF</button>
        <button className="bg-green-600 px-4 py-2 rounded-lg" onClick={speak}>Reproduzir TTS</button>
      </div>

      {apiMessage.text && (
        <p className={`p-2 rounded ${apiMessage.type==="error"?"bg-red-600":"bg-blue-600"}`}>
          {apiMessage.text}
        </p>
      )}

      <canvas ref={canvasRef} className="w-full h-[800px] rounded-lg border border-gray-500 mt-4" />

      {ttsUrl && <audio controls src={ttsUrl} className="mt-4 w-full"></audio>}

      {showUpload && (
        <UploadModal 
          onClose={()=>setShowUpload(false)} 
          onFileBase64={processPdfGemini} 
          setApiMessage={setApiMessage} 
        />
      )}
    </div>
  );
};

export default App;
