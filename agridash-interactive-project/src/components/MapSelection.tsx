import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ZoomControl, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, Navigation, MapPin, Loader2 } from 'lucide-react';
// @ts-ignore
import 'leaflet/dist/leaflet.css';

// 修复 Leaflet 默认标记图标不显示的问题
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// 地图平滑移动组件
const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 12, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
};

// 监听地图点击事件的组件
const MapClickListener = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export default function MapSelection({ onFarmSelect }: { onFarmSelect: (farm: any) => void }) {
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState(25);
  const [center, setCenter] = useState<[number, number]>([41.8780, -93.0977]); // 默认 Iowa 中心
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // 处理文本搜索 (使用 Nominatim 免费 API)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setCenter([lat, lon]);
        setSearched(true);
        fetchFarms(lat, lon, radius);
      } else {
        setError('Location not found.');
        setLoading(false);
      }
    } catch (err) {
      setError('Search failed.');
      setLoading(false);
    }
  };

  // 请求 USDA 官方农田数据
  const fetchFarms = async (lat: number, lng: number, r: number) => {
    setLoading(true);
    try {
      const degLat = r / 111.0;
      const degLng = r / (111.0 * Math.cos(lat * Math.PI / 180));
      
      const xmin = lng - degLng;
      const ymin = lat - degLat;
      const xmax = lng + degLng;
      const ymax = lat + degLat;

      // USDA Crop Sequence Boundaries 2024
      const url = `https://services3.arcgis.com/g6eV2CrSSwCZj8Mc/arcgis/rest/services/NASS_Crop_Sequence_Boundaries_2024/FeatureServer/0/query?where=1%3D1&geometry=${xmin},${ymin},${xmax},${ymax}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson&resultRecordCount=1000`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.features) {
        setGeoData(data);
      } else {
        setError('No farm data returned from USDA API.');
      }
    } catch (err) {
      setError('Failed to fetch farm data.');
    } finally {
      setLoading(false);
    }
  };

  // 真实的 GPS 定位
  const handleLocate = () => {
    if ('geolocation' in navigator) {
      setLoading(true);
      setError('');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCenter([lat, lon]);
          setSearched(true);
          fetchFarms(lat, lon, radius);
        }, 
        (err) => {
          if (err.code === 1) {
            setError('Permission denied. Please allow location in browser settings.');
          } else {
            setError('Could not get your physical location.');
          }
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setError('Geolocation not supported by your browser.');
    }
  };

  // 处理鼠标点击地图的任何位置
  const handleMapClick = (lat: number, lng: number) => {
    setCenter([lat, lng]);
    setSearched(true);
    fetchFarms(lat, lng, radius);
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties || {};
    const acres = props.Acres || props.ACRES || props.Shape__Area || 0;
    const hectares = acres ? (acres * 0.404686).toFixed(2) : 'N/A';
    
    const popupContent = document.createElement('div');
    popupContent.className = 'p-3 min-w-[220px] font-sans';
    
    let html = `<h3 class="font-bold text-green-700 border-b pb-2 mb-3 text-sm flex items-center gap-1">🌿 USDA Farm Boundary (2024)</h3>`;
    html += `<ul class="text-xs space-y-1.5 mb-4 text-gray-700">`;
    let count = 0;
    Object.keys(props).forEach(k => {
      if(props[k] !== null && typeof props[k] !== 'object' && count < 6 && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length') {
        html += `<li class="flex justify-between"><span class="font-semibold text-gray-500">${k}:</span> <span>${props[k]}</span></li>`;
        count++;
      }
    });
    html += `<li class="flex justify-between pt-1 border-t mt-1"><span class="font-semibold text-gray-500">Calculated Area:</span> <span class="font-bold text-green-600">${hectares} ha</span></li>`;
    html += `</ul>`;
    
    
const btn = document.createElement('button');

btn.className =
  'w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl transition-colors shadow-md';

btn.innerText = 'Select this Farm';

btn.onclick = () => {
  const bounds = (layer as L.Polygon).getBounds();
  const center = bounds.getCenter();

  onFarmSelect({
    ...feature,
    location: {
      lat: center.lat,
      lon: center.lng,
    },
  });
};

popupContent.innerHTML = html;
popupContent.appendChild(btn);

layer.bindPopup(popupContent);

  };

  return (
    <div className="relative w-full h-screen bg-gray-100 flex flex-col overflow-hidden font-sans">
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[1000] w-[90%] max-w-3xl">
         <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 flex flex-col gap-4 border border-gray-100">
            
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="text-green-700 font-extrabold text-lg px-2 flex items-center gap-2 min-w-max">
                <MapPin className="text-green-600" />
                Select Farm Location
              </div>
              
              <div className="flex-1 w-full bg-gray-50/80 rounded-xl px-4 py-2.5 flex items-center border border-gray-200 focus-within:ring-2 focus-within:ring-green-500/30 transition-shadow">
                <Search className="w-5 h-5 text-gray-400 mr-2" />
                <form onSubmit={handleSearch} className="flex-1 flex">
                  <input 
                    type="text" 
                    placeholder="Search locations or click anywhere on the map..." 
                    className="bg-transparent border-none outline-none w-full text-sm text-gray-700 placeholder-gray-400 font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="submit" className="hidden">Search</button>
                </form>
              </div>
              
              <button 
                onClick={handleLocate}
                className="bg-green-100 text-green-700 p-3 rounded-xl hover:bg-green-200 transition-colors shadow-sm flex-shrink-0 flex items-center gap-2 text-sm font-bold cursor-pointer"
                title="Use Device GPS"
              >
                <Navigation className="w-4 h-4" />
                <span className="hidden md:inline">Auto Locate</span>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between px-2 text-sm gap-3">
               <div className="flex items-center gap-2">
                 <span className="text-gray-500 font-medium mr-2">Search Radius:</span>
                 {[10, 25, 50].map(r => (
                   <button 
                     key={r}
                     onClick={() => { setRadius(r); if(searched) fetchFarms(center[0], center[1], r); }}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer ${radius === r ? 'bg-green-600 text-white scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                   >
                     {r} km
                   </button>
                 ))}
               </div>
               
               <div className="flex items-center">
                 {loading && <div className="flex items-center text-green-600 text-xs font-bold gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Fetching USDA Data...</div>}
                 {error && <div className="text-red-500 text-xs font-bold bg-red-50 px-3 py-1 rounded-full">{error}</div>}
                 {geoData && !loading && !error && (
                   <div className="text-green-700 bg-green-50 px-4 py-1.5 rounded-full text-xs font-bold border border-green-100 shadow-sm flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     {geoData.features?.length || 0} Farms Found in radius
                   </div>
                 )}
               </div>
            </div>
            
         </div>
      </div>

      {/* 这里的光标被设置为 crosshair (十字瞄准线)，提示用户可以点击 */}
      <MapContainer center={center} zoom={7} className="w-full h-full z-0 cursor-crosshair" zoomControl={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />
        <MapUpdater center={center} />
        <MapClickListener onMapClick={handleMapClick} />
        
        {searched && <Marker position={center} icon={markerIcon} />}

        {geoData && (
          <GeoJSON 
            key={JSON.stringify(center) + radius}
            data={geoData} 
            style={{
              color: '#9333ea',
              weight: 2,
              fillColor: '#a855f7',
              fillOpacity: 0.4
            }}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}