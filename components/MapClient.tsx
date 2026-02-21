'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

export interface MapVenue {
    id: string;
    name: string;
    address: string;
    phone: string;
    website: string;
    googleMapsUrl: string;
    lat: number;
    lng: number;
    source: string;
    businessStatus: string;
    courtCount: number;
    labolaUrl: string;
    eventCount: number;
}

interface MapClientProps {
    venues: MapVenue[];
    filter: 'all' | 'labola' | 'external';
    selectedVenue: string | null;
    onSelectVenue: (id: string | null) => void;
}

// Custom marker icons
function createIcon(color: string, size: number = 28): L.DivIcon {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width: ${size}px; height: ${size}px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; color: white; font-weight: bold;
        ">⚽</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
}

const LABOLA_ICON = createIcon('#3b82f6');       // Blue
const EXTERNAL_ICON = createIcon('#10b981');     // Green
const SELECTED_ICON = createIcon('#f59e0b', 36); // Amber, larger

export default function MapClient({ venues, filter, selectedVenue, onSelectVenue }: MapClientProps) {
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.LayerGroup | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter venues
    const filtered = useMemo(() => {
        if (filter === 'labola') return venues.filter(v => v.source === 'labola');
        if (filter === 'external') return venues.filter(v => v.source !== 'labola');
        return venues;
    }, [venues, filter]);

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [35.6762, 139.7503],
            zoom: 11,
            zoomControl: true,
            attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        // @ts-ignore - plugin extending L
        markersRef.current = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
        }).addTo(map);

        return () => {
            map.remove();
            mapRef.current = null;
            markersRef.current = null;
        };
    }, []);

    // Update markers when data/filter changes
    useEffect(() => {
        if (!mapRef.current || !markersRef.current) return;

        markersRef.current.clearLayers();

        for (const venue of filtered) {
            const isSelected = venue.id === selectedVenue;
            const icon = isSelected
                ? SELECTED_ICON
                : venue.source === 'labola' ? LABOLA_ICON : EXTERNAL_ICON;

            const marker = L.marker([venue.lat, venue.lng], { icon })
                .addTo(markersRef.current!);

            // Build popup content
            const sourceLabel = venue.source === 'labola'
                ? '<span style="background:#3b82f6;color:white;padding:2px 6px;border-radius:4px;font-size:11px;">LaBOLA</span>'
                : '<span style="background:#10b981;color:white;padding:2px 6px;border-radius:4px;font-size:11px;">Google</span>';

            const eventInfo = venue.eventCount > 0
                ? `<div style="margin-top:4px;font-size:12px;color:#6b7280;">📅 이벤트 ${venue.eventCount}건</div>`
                : '';

            const courtInfo = venue.courtCount > 0
                ? `<div style="font-size:12px;color:#6b7280;">🏟️ 코트 ${venue.courtCount}면</div>`
                : '';

            const links: string[] = [];
            if (venue.website) links.push(`<a href="${venue.website}" target="_blank" rel="noopener" style="color:#3b82f6;font-size:12px;">🌐 웹사이트</a>`);
            if (venue.googleMapsUrl) links.push(`<a href="${venue.googleMapsUrl}" target="_blank" rel="noopener" style="color:#3b82f6;font-size:12px;">📍 Google Maps</a>`);
            if (venue.labolaUrl) links.push(`<a href="${venue.labolaUrl}" target="_blank" rel="noopener" style="color:#3b82f6;font-size:12px;">⚽ LaBOLA</a>`);

            const popupContent = `
                <div style="min-width:220px;max-width:280px;font-family:system-ui,-apple-system,sans-serif;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <strong style="font-size:14px;color:#1f2937;">${venue.name}</strong>
                        ${sourceLabel}
                    </div>
                    <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">📍 ${venue.address}</div>
                    ${venue.phone ? `<div style="font-size:12px;color:#6b7280;">📞 ${venue.phone}</div>` : ''}
                    ${courtInfo}
                    ${eventInfo}
                    ${links.length > 0 ? `<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">${links.join('')}</div>` : ''}
                </div>
            `;

            marker.bindPopup(popupContent, { maxWidth: 300 });

            marker.on('click', () => {
                onSelectVenue(venue.id);
            });
        }
    }, [filtered, selectedVenue, onSelectVenue]);

    // Pan to selected venue
    useEffect(() => {
        if (!mapRef.current || !selectedVenue) return;
        const venue = venues.find(v => v.id === selectedVenue);
        if (venue) {
            mapRef.current.setView([venue.lat, venue.lng], 15, { animate: true });
        }
    }, [selectedVenue, venues]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', borderRadius: '12px' }}
        />
    );
}
