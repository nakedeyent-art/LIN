"use client";
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap} from 'leaflet';
export function RouteMap({stops}:{stops:{name:string;latitude:number;longitude:number}[]}) {
 const [enabled,setEnabled]=useState(false),[error,setError]=useState(''),container=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!enabled||!container.current||!stops.length)return;let cancelled=false,map:LeafletMap|undefined;
  import('leaflet').then(L=>{if(cancelled||!container.current)return;map=L.map(container.current,{scrollWheelZoom:false});
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
   const positions=stops.map(s=>[s.latitude,s.longitude] as [number,number]);L.polyline(positions,{color:'#486b87',weight:3}).addTo(map);
   stops.forEach((s,i)=>{const label=document.createElement('span');label.textContent=`${i+1}. ${s.name}`;L.circleMarker([s.latitude,s.longitude],{radius:7,color:'#182f43',fillColor:'#e4edf5',fillOpacity:1}).bindTooltip(label).addTo(map!);});
   map.fitBounds(positions,{padding:[30,30],maxZoom:13});
  }).catch(()=>setError('The map could not be loaded. The stop list remains available.'));
  return()=>{cancelled=true;map?.remove();};
 },[enabled,stops]);
 if(!stops.length)return <p className="muted">Add venue coordinates to connected events to display the route on a map.</p>;
 return <section className="work-panel"><h2>Route map</h2><p className="muted">Stops are joined in itinerary order. Lines show the geographic sequence, not road directions or travel-time estimates.</p>{!enabled?<><p className="muted">Loading the map requests map-area tiles from OpenStreetMap. Athlete names and itinerary details are not sent.</p><button className="btn ghost" onClick={()=>setEnabled(true)}>Load map</button></>:<div ref={container} style={{height:380,width:'100%'}} aria-label="Route stops map"/>}{error&&<p role="alert" className="error">{error}</p>}</section>;
}
