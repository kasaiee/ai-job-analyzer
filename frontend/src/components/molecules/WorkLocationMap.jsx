import React, {useRef, useState} from 'react';
import worldMap from '@svg-maps/world';
import {Minus, Plus, RotateCcw} from 'lucide-react';
import {clampMapZoom, getMapViewBox, projectCoordinates, resolveWorkLocation, zoomMapAtPoint} from '../../utils/workLocation';

const WorkLocationMap = ({meta, schedule}) => {
  const location = resolveWorkLocation(meta, schedule);
  const offices = location.offices.map(office => ({...office, point: projectCoordinates(office)}));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredOffice, setHoveredOffice] = useState(null);
  const dragRef = useRef(null);
  const viewBox = getMapViewBox(offices, zoom, pan);
  const locationDescription = office => office.locationBasis === 'timezone'
    ? 'Employer/team timezone reference'
    : office.locationBasis === 'country' ? 'Job posting country'
    : office.isApproximate ? 'Mentioned employer office' : 'Detected work location';
  const tooltipDetails = office => office.locationBasis === 'country' ? null : locationDescription(office);
  const timezoneCaption = schedule?.company_timezone ? ` Employer timezone: ${schedule.company_timezone}.` : '';
  const changeZoom = amount => {
    setZoom(value => clampMapZoom(value + amount));
    setPan({x: 0, y: 0});
  };
  const startPanning = event => {
    if (zoom <= 1 || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {x: event.clientX, y: event.clientY};
    setIsPanning(true);
  };
  const panMap = event => {
    if (!dragRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = 1010 / zoom;
    const height = 666 / zoom;
    const deltaX = ((event.clientX - dragRef.current.x) / bounds.width) * width;
    const deltaY = ((event.clientY - dragRef.current.y) / bounds.height) * height;
    dragRef.current = {x: event.clientX, y: event.clientY};
    setPan(current => ({x: current.x - deltaX, y: current.y - deltaY}));
  };
  const stopPanning = event => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setIsPanning(false);
  };
  const zoomWithWheel = event => {
    if (!event.shiftKey || event.deltaY === 0) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointer = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
    const next = zoomMapAtPoint(offices, zoom, pan, pointer, event.deltaY);
    setZoom(next.zoom);
    setPan(next.pan);
  };
  const resetMap = () => { setZoom(1); setPan({x: 0, y: 0}); };

  return <div className="work-location-map">
    <div className="world-map-canvas">
      <div className="world-map-controls" aria-label="Map zoom controls">
        <button type="button" onClick={()=>changeZoom(.5)} disabled={zoom>=4} aria-label="Zoom in"><Plus size={16}/></button>
        <span aria-live="polite">{Math.round(zoom*100)}%</span>
        <button type="button" onClick={()=>changeZoom(-.5)} disabled={zoom<=1} aria-label="Zoom out"><Minus size={16}/></button>
        <button type="button" onClick={resetMap} disabled={zoom===1&&pan.x===0&&pan.y===0} aria-label="Reset map"><RotateCcw size={15}/></button>
      </div>
      <svg className={`${zoom>1?'pannable':''}${isPanning?' panning':''}`} viewBox={viewBox} role="img" aria-label={offices.length ? `World map showing employer or team locations for ${location.label}. Hold Shift and scroll to zoom, then drag to pan.` : 'World map; employer or team location unavailable'} onWheel={zoomWithWheel} onPointerDown={startPanning} onPointerMove={panMap} onPointerUp={stopPanning} onPointerCancel={stopPanning}>
        <title>{offices.length ? `Employer or team locations: ${offices.map(office => office.label).join(', ')}` : 'Employer or team location unavailable'}</title>
        <rect className="world-map-ocean" width="1010" height="666" rx="16"/>
        <g className="world-map-land">{worldMap.locations.map(country => <path aria-label={country.name} d={country.path} id={`map-country-${country.id}`} key={country.id}/>)}</g>
      {offices.map(office => <g className={`world-map-marker ${office.isApproximate ? 'approximate' : 'confirmed'}`} transform={`translate(${office.point.x} ${office.point.y})`} key={`${office.label}-${office.latitude}-${office.longitude}`} role="button" tabIndex="0" aria-label={`${office.label}, ${locationDescription(office)}`} onMouseEnter={()=>setHoveredOffice(office)} onMouseLeave={()=>setHoveredOffice(null)} onFocus={()=>setHoveredOffice(office)} onBlur={()=>setHoveredOffice(null)}>
        <g className="world-map-marker-scale" transform={`scale(${1/zoom})`}>
          {!office.isApproximate && <circle className="world-map-pulse" r="12"/>}
          <circle className="world-map-marker-dot" r="5"/>
        </g>
        </g>)}
        {hoveredOffice&&<g className="world-map-tooltip" transform={`translate(${hoveredOffice.point.x} ${hoveredOffice.point.y})`} pointerEvents="none">
          <g transform={`scale(${1/zoom})`}>
            <rect x="-85" y={tooltipDetails(hoveredOffice)?'-78':'-61'} width="170" height={tooltipDetails(hoveredOffice)?'50':'33'} rx="8"/>
            <text className="world-map-tooltip-title" textAnchor="middle" y={tooltipDetails(hoveredOffice)?'-58':'-40'}>{hoveredOffice.label}</text>
            {tooltipDetails(hoveredOffice)&&<text textAnchor="middle" y="-41">{tooltipDetails(hoveredOffice)}</text>}
          </g>
        </g>}
      </svg>
    </div>
    <div className="work-location-caption"><strong>Employer/team location: {location.label}</strong><span>{offices.length ? `${offices.map(office => `${office.label} (${locationDescription(office).toLowerCase()})`).join(' · ')}.${timezoneCaption} This map does not show the candidate's home location. Hollow markers are approximate; filled markers are confirmed.` : 'Employer/team coordinates are unavailable for this analysis. Sync to update them.'}</span></div>
    <small className="world-map-attribution">Map data © MapSVG, licensed under CC BY 4.0.</small>
  </div>;
};

export default WorkLocationMap;
