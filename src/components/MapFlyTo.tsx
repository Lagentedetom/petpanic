import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15);
  }, [center, map]);
  return null;
}
