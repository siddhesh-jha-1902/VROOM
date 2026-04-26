import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useTheme } from '../contexts/ThemeContext';

const libraries = ['places'];
const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 28.6139, lng: 77.2090 }; // Default to New Delhi

export default function Map({ pickupLocation, dropLocation, driverLocation, onRouteCalculated, onMapClick }) {
  const { theme } = useTheme();
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  useEffect(() => { onRouteCalculatedRef.current = onRouteCalculated; }, [onRouteCalculated]);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [directions, setDirections] = useState(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (!isLoaded || !pickupLocation || !dropLocation) {
      if (!dropLocation) setDirections(null);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: pickupLocation,
        destination: dropLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          if (onRouteCalculatedRef.current) {
            const distanceMeters = result.routes[0].legs[0].distance.value;
            onRouteCalculatedRef.current(distanceMeters);
          }
        }
      }
    );
  }, [isLoaded, pickupLocation, dropLocation]);

  const onLoad = useCallback(function callback(map) {
    setMap(map);
  }, []);

  useEffect(() => {
    if (map && pickupLocation) {
      map.panTo(pickupLocation);
      map.setZoom(15);
    }
  }, [map, pickupLocation]);

  const onUnmount = useCallback(function callback(map) {
    setMap(null);
  }, []);

  if (loadError) return <div className="absolute inset-0 bg-red-900/20 text-red-500 flex items-center justify-center">Error loading Google Maps</div>;
  if (!isLoaded) return <div className="absolute inset-0 bg-background flex items-center justify-center animate-pulse">Initializing Map Engine...</div>;

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={pickupLocation || defaultCenter}
      zoom={14}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={(e) => {
        if(onMapClick) onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }}
      options={{
        disableDefaultUI: true,
        styles: theme === 'dark' ? darkMapStyle : lightMapStyle
      }}
    >
      {directions && (
        <DirectionsRenderer 
          directions={directions} 
          options={{
            polylineOptions: {
              strokeColor: '#3b82f6', // Blueprint line
              strokeWeight: 5,
            }
          }} 
        />
      )}
      {!directions && pickupLocation && <Marker position={pickupLocation} />}
      {!directions && driverLocation && <Marker position={driverLocation} icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} />}
    </GoogleMap>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
];
