import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

// Vite bundles leaflet's marker image imports as hashed URLs, but leaflet's
// own CSS/JS still points at the un-hashed default paths — without this fix
// the pin renders as a broken image icon. This is the standard workaround.
const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = defaultIcon

interface ListingMapProps {
  lat: number
  lng: number
  label: string
}

// Renders the seller's area on an actual interactive OpenStreetMap (pan/zoom
// both work out of the box) — same buyer experience as opening a listing on
// OLX and seeing roughly where it is. A translucent circle around the pin
// signals "this is the general area, not the exact address" so buyers don't
// mistake an area-level geocode for a doorstep pin.
export default function ListingMap({ lat, lng, label }: ListingMapProps) {
  const position: [number, number] = [lat, lng]
  return (
    <div className="overflow-hidden rounded-xl2 border border-line/10">
      <MapContainer
        center={position}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '260px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle center={position} radius={600} pathOptions={{ color: '#c96f4a', fillOpacity: 0.08 }} />
        <Marker position={position}>
          <Popup>{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
