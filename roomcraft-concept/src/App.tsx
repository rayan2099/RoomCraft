import { useState, useRef, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text, Group, Arrow } from 'react-konva';
import './App.css';

interface FurnitureItem { id: string; name: string; category: string; width: number; depth: number; height: number; unit: string; imageUrl: string; price?: number; }
interface PlacedFurniture { id: string; item: FurnitureItem; x: number; y: number; rotation: number; scale: number; }
interface Corner { x: number; y: number; }
type Unit = 'cm' | 'm' | 'inches' | 'feet';
type Step = 'upload' | 'floor' | 'furniture';

const FURNITURE_CATALOG: FurnitureItem[] = [
  { id: '1', name: 'Modern Sofa', category: 'sofa', width: 220, depth: 95, height: 70, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=150&fit=crop', price: 1200 },
  { id: '2', name: 'Accent Chair', category: 'chair', width: 80, depth: 75, height: 85, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=200&h=150&fit=crop', price: 450 },
  { id: '3', name: 'Dining Table', category: 'table', width: 180, depth: 90, height: 75, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=200&h=150&fit=crop', price: 800 },
  { id: '4', name: 'Coffee Table', category: 'table', width: 120, depth: 60, height: 45, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=200&h=150&fit=crop', price: 350 },
  { id: '5', name: 'Bookshelf', category: 'storage', width: 100, depth: 30, height: 200, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=200&h=150&fit=crop', price: 280 },
  { id: '6', name: 'Area Rug', category: 'rug', width: 200, depth: 150, height: 2, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=200&h=150&fit=crop', price: 200 },
  { id: '7', name: 'Floor Lamp', category: 'lighting', width: 40, depth: 40, height: 160, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200&h=150&fit=crop', price: 150 },
  { id: '8', name: 'Side Table', category: 'table', width: 50, depth: 50, height: 55, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=200&h=150&fit=crop', price: 180 },
  { id: '9', name: 'Ottoman', category: 'decor', width: 80, depth: 80, height: 45, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=200&h=150&fit=crop', price: 220 },
  { id: '10', name: 'TV Stand', category: 'storage', width: 160, depth: 40, height: 50, unit: 'cm', imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=200&h=150&fit=crop', price: 400 },
];

const convertToUnit = (value: number, fromUnit: Unit, toUnit: Unit): number => {
  const toCm = (v: number, u: Unit): number => { switch (u) { case 'cm': return v; case 'm': return v * 100; case 'inches': return v * 2.54; case 'feet': return v * 30.48; default: return v; } };
  const fromCm = (v: number, u: Unit): number => { switch (u) { case 'cm': return v; case 'm': return v / 100; case 'inches': return v / 2.54; case 'feet': return v / 30.48; default: return v; } };
  return fromCm(toCm(value, fromUnit), toUnit);
};

const formatDimension = (value: number, unit: Unit): string => `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;

function App() {
  const [step, setStep] = useState<Step>('upload');
  const [roomImage, setRoomImage] = useState<HTMLImageElement | null>(null);
  const canvasSize = { width: 800, height: 600 };
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [floorCorners, setFloorCorners] = useState<Corner[]>([{ x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 500 }, { x: 100, y: 500 }]);
  const [draggingCorner, setDraggingCorner] = useState<number | null>(null);
  const [roomDimensions, setRoomDimensions] = useState({ width: 4, depth: 3, height: 2.7 });
  const [roomUnit, setRoomUnit] = useState<Unit>('m');
  const [floorConfirmed, setFloorConfirmed] = useState(false);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurniture[]>([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [preferredUnit, setPreferredUnit] = useState<Unit>('cm');
  const [customItem, setCustomItem] = useState({ name: '', width: 100, depth: 60, height: 80, unit: 'cm' as Unit });
  const [customItemImage, setCustomItemImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => { setRoomImage(img); setStep('floor'); };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCornerDragMove = (e: any) => {
    if (draggingCorner !== null) {
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) { const newCorners = [...floorCorners]; newCorners[draggingCorner] = { x: pos.x, y: pos.y }; setFloorCorners(newCorners); }
    }
  };

  const floorPoints = useMemo(() => floorCorners.flatMap((c) => [c.x, c.y]), [floorCorners]);
  const floorCenter = useMemo(() => ({ x: floorCorners.reduce((s, c) => s + c.x, 0) / 4, y: floorCorners.reduce((s, c) => s + c.y, 0) / 4 }), [floorCorners]);

  const addFurniture = (item: FurnitureItem) => { setPlacedFurniture([...placedFurniture, { id: `placed-${Date.now()}`, item, x: floorCenter.x - 50, y: floorCenter.y - 50, rotation: 0, scale: 1 }]); setStep('furniture'); };
  const addCustomItem = () => {
    const customFurniture: FurnitureItem = { id: `custom-${Date.now()}`, name: customItem.name || 'Custom Item', category: 'custom', width: customItem.width, depth: customItem.depth, height: customItem.height, unit: customItem.unit, imageUrl: customItemImage || 'https://via.placeholder.com/200x150?text=Custom+Item' };
    setPlacedFurniture([...placedFurniture, { id: `placed-${Date.now()}`, item: customFurniture, x: floorCenter.x - 50, y: floorCenter.y - 50, rotation: 0, scale: 1 }]);
    setStep('furniture'); setCustomItem({ name: '', width: 100, depth: 60, height: 80, unit: 'cm' }); setCustomItemImage(null);
  };
  const rotateFurniture = (id: string, angle: number) => setPlacedFurniture(placedFurniture.map((f) => f.id === id ? { ...f, rotation: f.rotation + angle } : f));
  const deleteFurniture = (id: string) => { setPlacedFurniture(placedFurniture.filter((f) => f.id !== id)); setSelectedFurnitureId(null); };
  const scaleFurniture = (id: string, delta: number) => setPlacedFurniture(placedFurniture.map((f) => f.id === id ? { ...f, scale: Math.max(0.5, Math.min(2, f.scale + delta)) } : f));
  const getConvertedDims = (width: number, depth: number, height: number, fromUnit: Unit) => ({ width: convertToUnit(width, fromUnit, preferredUnit), depth: convertToUnit(depth, fromUnit, preferredUnit), height: convertToUnit(height, fromUnit, preferredUnit) });

  const renderRoomDimensionLabels = () => {
    if (!floorConfirmed) return null;
    const cw = convertToUnit(roomDimensions.width, roomUnit, preferredUnit), cd = convertToUnit(roomDimensions.depth, roomUnit, preferredUnit), ch = convertToUnit(roomDimensions.height, roomUnit, preferredUnit);
    const topMid = { x: (floorCorners[0].x + floorCorners[1].x) / 2, y: (floorCorners[0].y + floorCorners[1].y) / 2 }, rightMid = { x: (floorCorners[1].x + floorCorners[2].x) / 2, y: (floorCorners[1].y + floorCorners[2].y) / 2 };
    return (<><Text x={topMid.x} y={topMid.y - 25} text={`W: ${formatDimension(cw, preferredUnit)}`} fontSize={14} fontStyle="bold" fill="#FFD700" stroke="black" strokeWidth={2} align="center" offsetX={50} /><Text x={rightMid.x + 15} y={rightMid.y} text={`D: ${formatDimension(cd, preferredUnit)}`} fontSize={14} fontStyle="bold" fill="#FFD700" stroke="black" strokeWidth={2} align="left" /><Group x={floorCorners[1].x + 30} y={(floorCorners[1].y + floorCorners[2].y) / 2}><Line points={[0, -40, 0, 40]} stroke="#00AA00" strokeWidth={3} dash={[5, 5]} /><Arrow points={[0, -40, 0, -30]} stroke="#00AA00" fill="#00AA00" pointerLength={8} pointerWidth={8} /><Arrow points={[0, 40, 0, 30]} stroke="#00AA00" fill="#00AA00" pointerLength={8} pointerWidth={8} /><Text x={10} y={-10} text={`H: ${formatDimension(ch, preferredUnit)}`} fontSize={12} fontStyle="bold" fill="#00AA00" stroke="white" strokeWidth={2} /></Group></>);
  };

  return (
    <div className="app">
      <header className="header"><h1>RoomCraft Concept Test</h1><div className="step-indicator"><span className={`step ${step === 'upload' ? 'active' : ''}`}>1. Upload Photo</span><span className="separator">→</span><span className={`step ${step === 'floor' ? 'active' : ''}`}>2. Mark Floor</span><span className="separator">→</span><span className={`step ${step === 'furniture' ? 'active' : ''}`}>3. Add Furniture</span></div><div className="unit-selector"><label>Units:</label><select value={preferredUnit} onChange={(e) => setPreferredUnit(e.target.value as Unit)}><option value="cm">cm</option><option value="m">m</option><option value="inches">inches</option><option value="feet">feet</option></select></div></header>
      <div className="main-content">
        <div className="canvas-container" ref={containerRef}>
          {!roomImage && step === 'upload' && (<div className="upload-area"><h2>Upload Your Room Photo</h2><p>Take or upload a photo of your room to get started</p><input type="file" accept="image/*" onChange={handleImageUpload} id="room-upload" /><label htmlFor="room-upload" className="upload-button">Choose Photo</label><p className="hint">or drag and drop an image here</p></div>)}
          {roomImage && (<Stage ref={stageRef} width={canvasSize.width} height={canvasSize.height} onMouseMove={handleCornerDragMove} onMouseUp={() => setDraggingCorner(null)} onTouchEnd={() => setDraggingCorner(null)}><Layer><KonvaImage image={roomImage} width={canvasSize.width} height={canvasSize.height} />{(step === 'floor' || !floorConfirmed) && (<><Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="rgba(0, 0, 0, 0.3)" listening={false} /><Rect x={Math.min(...floorCorners.map(c => c.x))} y={Math.min(...floorCorners.map(c => c.y))} width={Math.max(...floorCorners.map(c => c.x)) - Math.min(...floorCorners.map(c => c.x))} height={Math.max(...floorCorners.map(c => c.y)) - Math.min(...floorCorners.map(c => c.y))} fill="rgba(255, 255, 255, 0.1)" listening={false} /><Line points={floorPoints} closed stroke="#FFD700" strokeWidth={3} dash={[10, 5]} fill="rgba(255, 215, 0, 0.1)" />{floorCorners.map((corner, index) => (<Circle key={index} x={corner.x} y={corner.y} radius={12} fill="#FFD700" stroke="#B8860B" strokeWidth={3} draggable onDragStart={() => setDraggingCorner(index)} onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'move'; }} onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = 'default'; }} />))}</>)}{renderRoomDimensionLabels()}{placedFurniture.map((furniture) => { const img = new Image(); img.src = furniture.item.imageUrl; const fw = furniture.item.width * furniture.scale * 0.5, fd = furniture.item.depth * furniture.scale * 0.5; const sel = selectedFurnitureId === furniture.id; const conv = getConvertedDims(furniture.item.width, furniture.item.depth, furniture.item.height, furniture.item.unit as Unit); return (<Group key={furniture.id} x={furniture.x} y={furniture.y} rotation={furniture.rotation} draggable onClick={() => setSelectedFurnitureId(furniture.id)}><KonvaImage image={img} x={-fw / 2} y={-fd / 2} width={fw} height={fd} opacity={0.9} /><Rect x={-fw / 2} y={-fd / 2} width={fw} height={fd} stroke="#0066CC" strokeWidth={2} dash={[8, 4]} fill="transparent" /><Text x={0} y={-fd / 2 - 20} text={`W: ${formatDimension(conv.width, preferredUnit)}`} fontSize={12} fontStyle="bold" fill="#0066CC" stroke="white" strokeWidth={2} align="center" offsetX={fw / 2} /><Text x={fw / 2 + 5} y={0} text={`D: ${formatDimension(conv.depth, preferredUnit)}`} fontSize={12} fontStyle="bold" fill="#0066CC" stroke="white" strokeWidth={2} /><Group x={fw / 2 + 20} y={0}><Line points={[0, -fd / 2, 0, fd / 2]} stroke="#00AA00" strokeWidth={2} dash={[5, 5]} /><Arrow points={[0, -fd / 2, 0, -fd / 2 + 10]} stroke="#00AA00" fill="#00AA00" pointerLength={6} pointerWidth={6} /><Arrow points={[0, fd / 2, 0, fd / 2 - 10]} stroke="#00AA00" fill="#00AA00" pointerLength={6} pointerWidth={6} /><Text x={8} y={-10} text={`H: ${formatDimension(conv.height, preferredUnit)}`} fontSize={11} fontStyle="bold" fill="#00AA00" stroke="white" strokeWidth={2} /></Group>{sel && (<Group><Circle x={-fw / 2 - 20} y={-fd / 2 - 20} radius={15} fill="#FF4444" stroke="white" strokeWidth={2} onClick={(e) => { e.cancelBubble = true; deleteFurniture(furniture.id); }} /><Text x={-fw / 2 - 20} y={-fd / 2 - 20} text="×" fontSize={20} fill="white" align="center" offsetY={10} offsetX={5} /><Circle x={fw / 2 + 20} y={-fd / 2 - 20} radius={15} fill="#4444FF" stroke="white" strokeWidth={2} onClick={(e) => { e.cancelBubble = true; rotateFurniture(furniture.id, -15); }} /><Text x={fw / 2 + 20} y={-fd / 2 - 20} text="↺" fontSize={16} fill="white" align="center" offsetY={10} offsetX={5} /><Circle x={fw / 2 + 45} y={-fd / 2 - 20} radius={15} fill="#4444FF" stroke="white" strokeWidth={2} onClick={(e) => { e.cancelBubble = true; rotateFurniture(furniture.id, 15); }} /><Text x={fw / 2 + 45} y={-fd / 2 - 20} text="↻" fontSize={16} fill="white" align="center" offsetY={10} offsetX={5} /><Circle x={-fw / 2 - 20} y={fd / 2 + 20} radius={15} fill="#44AA44" stroke="white" strokeWidth={2} onClick={(e) => { e.cancelBubble = true; scaleFurniture(furniture.id, -0.1); }} /><Text x={-fw / 2 - 20} y={fd / 2 + 20} text="-" fontSize={20} fill="white" align="center" offsetY={10} offsetX={5} /><Circle x={-fw / 2 + 5} y={fd / 2 + 20} radius={15} fill="#44AA44" stroke="white" strokeWidth={2} onClick={(e) => { e.cancelBubble = true; scaleFurniture(furniture.id, 0.1); }} /><Text x={-fw / 2 + 5} y={fd / 2 + 20} text="+" fontSize={20} fill="white" align="center" offsetY={10} offsetX={5} /></Group>)}</Group>); })}</Layer></Stage>)}
        </div>
        {roomImage && (<div className="right-panel">{step === 'floor' && !floorConfirmed && (<div className="panel floor-panel"><h2>Mark Your Floor Area</h2><p className="helper-text">Drag the corners to match the floor area in your room photo.</p><div className="dimension-inputs"><h3>Room Dimensions</h3><div className="input-group"><label>Width:</label><input type="number" value={roomDimensions.width} onChange={(e) => setRoomDimensions({ ...roomDimensions, width: parseFloat(e.target.value) || 0 })} step={0.1} /></div><div className="input-group"><label>Depth:</label><input type="number" value={roomDimensions.depth} onChange={(e) => setRoomDimensions({ ...roomDimensions, depth: parseFloat(e.target.value) || 0 })} step={0.1} /></div><div className="input-group"><label>Height (optional):</label><input type="number" value={roomDimensions.height} onChange={(e) => setRoomDimensions({ ...roomDimensions, height: parseFloat(e.target.value) || 0 })} step={0.1} /></div><div className="input-group"><label>Unit:</label><select value={roomUnit} onChange={(e) => setRoomUnit(e.target.value as Unit)}><option value="cm">cm</option><option value="m">m</option><option value="inches">inches</option><option value="feet">feet</option></select></div></div><div className="button-group"><button className="btn primary" onClick={() => setFloorConfirmed(true)}>Confirm Floor</button><button className="btn secondary" onClick={() => setFloorCorners([{ x: 100, y: 100 }, { x: canvasSize.width - 100, y: 100 }, { x: canvasSize.width - 100, y: canvasSize.height - 100 }, { x: 100, y: canvasSize.height - 100 }])}>Reset Frame</button><button className="btn skip" onClick={() => { setFloorConfirmed(true); setStep('furniture'); }}>Skip & Place Freely</button></div></div>)}{(step === 'furniture' || floorConfirmed) && (<div className="panel furniture-panel"><h2>Add Furniture</h2><div className="category-tabs">{['all', 'sofa', 'chair', 'table', 'storage', 'lighting', 'rug', 'decor'].map((cat) => (<button key={cat} className={`tab ${cat === 'all' ? 'active' : ''}`}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</button>))}</div><div className="furniture-catalog">{FURNITURE_CATALOG.map((item) => (<div key={item.id} className="furniture-card"><img src={item.imageUrl} alt={item.name} /><div className="furniture-info"><h4>{item.name}</h4><p className="dimensions">{item.width} × {item.depth} × {item.height} {item.unit}</p>{item.price && <p className="price">${item.price}</p>}<button className="btn add-btn" onClick={() => addFurniture(item)}>Add to Room</button></div></div>))}</div><div className="custom-item-form"><h3>Add Custom Item</h3><div className="input-group"><label>Item Name:</label><input type="text" value={customItem.name} onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })} placeholder="e.g., My Vintage Chair" /></div><div className="input-row"><div className="input-group"><label>Width:</label><input type="number" value={customItem.width} onChange={(e) => setCustomItem({ ...customItem, width: parseFloat(e.target.value) || 0 })} /></div><div className="input-group"><label>Depth:</label><input type="number" value={customItem.depth} onChange={(e) => setCustomItem({ ...customItem, depth: parseFloat(e.target.value) || 0 })} /></div><div className="input-group"><label>Height:</label><input type="number" value={customItem.height} onChange={(e) => setCustomItem({ ...customItem, height: parseFloat(e.target.value) || 0 })} /></div></div><div className="input-group"><label>Unit:</label><select value={customItem.unit} onChange={(e) => setCustomItem({ ...customItem, unit: e.target.value as Unit })}><option value="cm">cm</option><option value="m">m</option><option value="inches">inches</option><option value="feet">feet</option></select></div><div className="input-group"><label>Optional Image:</label><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { setCustomItemImage(ev.target?.result as string); }; reader.readAsDataURL(file); } }} /></div><button className="btn primary full-width" onClick={addCustomItem} disabled={!customItem.name}>Add Custom Item</button></div>{placedFurniture.length > 0 && (<div className="placed-items"><h3>Placed Items ({placedFurniture.length})</h3><ul>{placedFurniture.map((item) => (<li key={item.id} className={selectedFurnitureId === item.id ? 'selected' : ''} onClick={() => setSelectedFurnitureId(item.id)}><span>{item.item.name}</span><button className="btn-small delete" onClick={(e) => { e.stopPropagation(); deleteFurniture(item.id); }}>×</button></li>))}</ul></div>)}<div className="action-buttons">{!floorConfirmed && (<button className="btn secondary" onClick={() => { setFloorConfirmed(false); setStep('floor'); }}>Adjust Floor</button>)}<button className="btn danger" onClick={() => { setRoomImage(null); setFloorCorners([{ x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 500 }, { x: 100, y: 500 }]); setFloorConfirmed(false); setPlacedFurniture([]); setStep('upload'); }}>Start Over</button></div></div>)}</div>)}
      </div>
    </div>
  );
}

export default App;
