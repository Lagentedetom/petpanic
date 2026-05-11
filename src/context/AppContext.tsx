import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { calculateDistance, safeUuid, isUuid } from '../utils';
import { getCurrentNativeLocation, hapticImpact, hapticSuccess, isNative, requestGeolocationPermission } from '../lib/native';
import type { Pet, Alert, WalkingZone, ZonePresence, UserProfile, Friendship } from '../types';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  /** True once the initial fetchZones has completed (used by ZoneDetailsPage to differentiate "loading" from "not found"). */
  zonesLoaded: boolean;
  location: { lat: number; lng: number } | null;
  pets: Pet[];
  activeAlerts: Alert[];
  resolvedAlerts: Alert[];
  nearbyAlerts: Alert[];
  walkingZones: WalkingZone[];
  currentZoneId: string | null;
  friendships: Friendship[];
  friendProfiles: Record<string, UserProfile>;
  primaryZonePresence: ZonePresence[];
  notification: Alert | null;
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  setNotification: React.Dispatch<React.SetStateAction<Alert | null>>;
  triggerPanic: (pet: Pet) => Promise<void>;
  resolveAlert: (alert: Alert) => Promise<void>;
  joinZone: (zone: WalkingZone) => Promise<void>;
  createWalkingZone: (name: string, radius: number) => Promise<void>;
  refreshZones: () => Promise<void>;
  searchUsers: (code: string) => Promise<UserProfile[]>;
  sendFriendRequest: (targetUser: UserProfile) => Promise<void>;
  acceptFriendRequest: (friendship: Friendship) => Promise<void>;
  declineFriendRequest: (friendship: Friendship) => Promise<void>;
  togglePrimaryZone: (zoneId: string) => Promise<void>;
  updateProfile: (data: { first_name?: string; last_name?: string; display_name?: string }) => Promise<void>;
  registerPet: (petData: Partial<Pet>, editingPetId: string | null) => Promise<void>;
  logOut: () => Promise<void>;
  setLocation: React.Dispatch<React.SetStateAction<{ lat: number; lng: number } | null>>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // ME-07 fix: `loading` is now derived from two underlying flags so that we
  // keep the spinner up until the user profile has actually loaded (or a
  // 1.5 s grace period elapses). Previously `loading` flipped to false the
  // moment the auth session resolved, so for ~200 ms a paid user could see
  // "Necesitas PetPanic Social..." locks because useSubscription returned
  // DEFAULT_STATE while userProfile was still null.
  const [authResolved, setAuthResolved] = useState(false);
  const [profileGraceOver, setProfileGraceOver] = useState(false);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<Alert[]>([]);
  const [walkingZones, setWalkingZones] = useState<WalkingZone[]>([]);
  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [primaryZonePresence, setPrimaryZonePresence] = useState<ZonePresence[]>([]);
  const [notification, setNotification] = useState<Alert | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = safeUuid();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthResolved(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setUserProfile(null);
        setProfileGraceOver(false);
        setZonesLoaded(false);
      }
      setAuthResolved(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Profile grace period: if the user is set but their profile hasn't loaded
  // yet, give it 1.5 s before flipping `loading` to false. This window is
  // long enough for a typical Supabase profile fetch but short enough that
  // a network failure doesn't block the app forever.
  useEffect(() => {
    if (!user) { setProfileGraceOver(false); return; }
    if (userProfile) { setProfileGraceOver(true); return; }
    const timeout = setTimeout(() => setProfileGraceOver(true), 1500);
    return () => clearTimeout(timeout);
  }, [user?.id, userProfile?.id]);

  const loading = !authResolved || (!!user && !userProfile && !profileGraceOver);

  // ── Profile listener ──
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setUserProfile(data as UserProfile);
    };
    fetchProfile();

    const channel = supabase
      .channel('my-profile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => { if (payload.new) setUserProfile(payload.new as UserProfile); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Location tracking ──
  // HI-05 fix: tracks an `aborted` flag so any in-flight retry (the
  // network-based getCurrentPosition fallback inside handleLocationError)
  // cannot call setLocation after unmount. Without this, logging out while
  // a retry is pending caused setState-after-unmount + closure leak holding
  // the user profile (and crash under StrictMode dev double-mount).
  useEffect(() => {
    if (!user) return;

    let aborted = false;
    let lastDbLat = 0;
    let lastDbLng = 0;
    let lastDbTime = 0;

    // On native, kick off the OS-level location permission request before
    // we try watchPosition. The web fallback below will still work either
    // way — on iOS/Android, if the user denies the native prompt, the
    // WebView's navigator.geolocation will also fail (same permission).
    if (isNative()) {
      void requestGeolocationPermission();
    }

    const updateLoc = (pos: GeolocationPosition) => {
      if (aborted) return;
      const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(newLoc);

      // Debounce DB updates: only if moved >50m or >60s elapsed
      const now = Date.now();
      const dist = lastDbLat ? calculateDistance(newLoc.lat, newLoc.lng, lastDbLat, lastDbLng) * 1000 : Infinity;
      if (dist < 50 && now - lastDbTime < 60000) return;

      lastDbLat = newLoc.lat;
      lastDbLng = newLoc.lng;
      lastDbTime = now;

      // Round to ~100m precision for privacy before storing in DB
      const blurredLat = Math.round(newLoc.lat * 1000) / 1000;
      const blurredLng = Math.round(newLoc.lng * 1000) / 1000;
      supabase.from('profiles').update({
        last_location: `POINT(${blurredLng} ${blurredLat})`,
        last_location_at: new Date().toISOString(),
      }).eq('id', user.id).then();
    };

    const handleLocationError = (error: GeolocationPositionError) => {
      if (aborted) return;
      console.warn('Geolocation error:', error.code, error.message);
      // On mobile, high accuracy (GPS) can fail or timeout — retry with network-based location
      if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(updateLoc, () => {}, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      }
    };

    navigator.geolocation.getCurrentPosition(updateLoc, handleLocationError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    const watchId = navigator.geolocation.watchPosition(updateLoc, handleLocationError, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    return () => {
      aborted = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  // ── Pets listener ──
  useEffect(() => {
    if (!user) return;

    const fetchPets = async () => {
      const { data } = await supabase.from('pets').select('*').eq('owner_id', user.id);
      setPets((data ?? []) as Pet[]);
    };
    fetchPets();

    const channel = supabase
      .channel('my-pets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets', filter: `owner_id=eq.${user.id}` },
        () => { fetchPets(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Active alerts listener ──
  // Active alerts are fetched via the `nearby_alerts(lat, lng, radius_km)`
  // PostGIS RPC instead of `from('alerts').select('*')`. This:
  //   - sends only alerts within 5 km of the user (was: every active alert in the DB)
  //   - keeps server-side responsibility for proximity filtering (privacy + perf)
  //   - matches what the `alerts_select` RLS policy is designed to allow
  // Resolved alerts (history) stay as a direct table query because they're
  // already scoped to `owner_id = me` by RLS.
  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    const loc = locationRef.current;
    if (loc) {
      const { data, error } = await supabase.rpc('nearby_alerts', {
        user_lat: loc.lat,
        user_lng: loc.lng,
        radius_km: 5,
      });
      if (!error) setActiveAlerts((data ?? []) as Alert[]);
    } else {
      // No GPS yet — empty list rather than downloading every alert.
      setActiveAlerts([]);
    }
    const { data: resolved } = await supabase.from('alerts').select('*')
      .eq('status', 'resolved')
      .eq('owner_id', user.id)
      .order('resolved_at', { ascending: false })
      .limit(20);
    setResolvedAlerts((resolved ?? []) as Alert[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAlerts();

    const channel = supabase
      .channel('active-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' },
        () => { fetchAlerts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAlerts]);

  // Refetch when location becomes available or moves significantly (~1 km
  // granularity via the rounding trick). Without this, the initial fetch on
  // mount has no location and would never get refreshed when GPS arrives.
  const locKey = location ? `${Math.round(location.lat * 100)},${Math.round(location.lng * 100)}` : null;
  useEffect(() => {
    if (!user || !locKey) return;
    fetchAlerts();
  }, [user, locKey, fetchAlerts]);

  // ── Walking zones ──
  // Hoisted so create/join actions can force an immediate refresh instead of
  // waiting for the Realtime subscription round-trip (which can be lossy on
  // flaky networks and creates a race with optimistic UI like setCurrentZoneId).
  const fetchZones = useCallback(async () => {
    if (!user) return;
    const { data: zones } = await supabase.from('walking_zones').select('*');
    if (!zones) { setWalkingZones([]); setZonesLoaded(true); return; }

    // Get member counts and membership status
    const { data: members } = await supabase.from('zone_members').select('zone_id, user_id');
    const enriched = zones.map(z => ({
      ...z,
      member_count: members?.filter(m => m.zone_id === z.id).length ?? 0,
      is_member: members?.some(m => m.zone_id === z.id && m.user_id === user.id) ?? false,
    }));

    // Filter: show only zones within 2.5km of user, or zones where user is a member
    const loc = locationRef.current;
    const filtered = enriched.filter(z => {
      if (z.is_member) return true;
      if (!loc) return false;
      return calculateDistance(loc.lat, loc.lng, z.lat, z.lng) <= 2.5;
    });
    setWalkingZones(filtered as WalkingZone[]);
    // ME-05 fix: signal that the initial enrichment completed so UI can
    // distinguish "still loading" from "really not a member of this zone".
    setZonesLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchZones();

    const channel = supabase
      .channel('walking-zones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walking_zones' }, () => fetchZones())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zone_members' }, () => fetchZones())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchZones]);

  // ── Friendships listener ──
  useEffect(() => {
    if (!user) return;

    const fetchFriendships = async () => {
      // ME-08 fix: defensive check that user.id is a valid UUID before
      // interpolating into the PostgREST .or(...) filter. user.id comes
      // from a Supabase JWT (always trusted) so this guard is never
      // triggered in practice — but the pattern of building filter strings
      // from variables would be a real injection risk if anyone ever wires
      // a free-form input here. Fail closed if the format is wrong.
      if (!isUuid(user.id)) {
        console.error('fetchFriendships: user.id is not a valid UUID');
        setFriendships([]);
        return;
      }
      const { data } = await supabase.from('friendships').select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const fs = (data ?? []) as Friendship[];
      setFriendships(fs);

      // Fetch friend profiles via public_profiles view.
      // The `profiles` table is now self+friends-only, but for PENDING
      // requesters there's no friendship row yet, so a direct read would
      // fail RLS. The public_profiles view exposes the minimal identity
      // fields (id, display_name, photo_url, friend_code) we need to render
      // the friend list / pending-request UI without leaking PII.
      const friendIds = fs.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const newIds = friendIds.filter(id => !friendProfiles[id]);
      if (newIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, display_name, photo_url, friend_code')
          .in('id', newIds);
        if (profiles) {
          const map: Record<string, UserProfile> = {};
          profiles.forEach(p => { map[p.id] = p as UserProfile; });
          setFriendProfiles(prev => ({ ...prev, ...map }));
        }
      }
    };
    fetchFriendships();

    const channel = supabase
      .channel('friendships')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => fetchFriendships())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Zone presence (primary zone + friends count) ──
  useEffect(() => {
    if (!user) return;

    const fetchPresence = async () => {
      if (userProfile?.primary_zone_id) {
        const { data } = await supabase.from('zone_presence').select('*')
          .eq('zone_id', userProfile.primary_zone_id);
        setPrimaryZonePresence((data ?? []) as ZonePresence[]);
      } else {
        setPrimaryZonePresence([]);
      }
    };
    fetchPresence();

    const channel = supabase
      .channel('zone-presence-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zone_presence' }, () => fetchPresence())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userProfile?.primary_zone_id]);

  // ── Geofencing: detect which zone the user is currently inside ──
  // HI-04 fix: previously a single effect mixed (1) zone detection,
  // (2) presence upsert, (3) heartbeat update, AND ran on every GPS ping
  // because `location` was in deps. Each ping triggered cleanup → DELETE
  // on `zone_presence` → flicker for friends watching, plus a real race
  // window if the immediate UPSERT failed. Split into 3 effects, each
  // with one job; the DELETE only fires on actual zone change/unmount.

  // Effect 1: cheap detection. Runs on every GPS ping but only sets state
  // when the detected zone identity actually changes.
  useEffect(() => {
    if (!user || !location || walkingZones.length === 0) {
      return;
    }
    let detected: string | null = null;
    for (const zone of walkingZones) {
      const dist = calculateDistance(location.lat, location.lng, zone.lat, zone.lng) * 1000;
      if (dist <= zone.radius) { detected = zone.id; break; }
    }
    setCurrentZoneId(prev => (prev === detected ? prev : detected));
  }, [location, walkingZones, user]);

  // Effect 2: write presence on zone-entry, delete on zone-exit/unmount.
  // Deps are ONLY [user, currentZoneId] — not location, not pets, not profile.
  // Initial values (display_name/photo/pet_names) are captured at upsert
  // time; subsequent profile/pet changes are synced by Effect 3 below.
  useEffect(() => {
    if (!user || !currentZoneId) return;

    supabase.from('zone_presence').upsert(
      {
        zone_id: currentZoneId,
        user_id: user.id,
        user_name: userProfile?.display_name || 'Usuario',
        user_photo: userProfile?.photo_url || '',
        pet_names: pets.map(p => p.name),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'zone_id,user_id' }
    ).then();

    return () => {
      supabase.from('zone_presence').delete()
        .eq('zone_id', currentZoneId)
        .eq('user_id', user.id)
        .then();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentZoneId]);

  // Effect 3: keep presence row in sync when profile/pets change without
  // touching the zone identity. Pure UPDATE, no delete in cleanup.
  // petNamesKey is a stable string so we don't re-fire on every pets array
  // reference change from Supabase realtime/refetch.
  const petNamesKey = pets.map(p => p.name).sort().join('|');
  useEffect(() => {
    if (!user || !currentZoneId) return;
    supabase.from('zone_presence').update({
      user_name: userProfile?.display_name || 'Usuario',
      user_photo: userProfile?.photo_url || '',
      pet_names: pets.map(p => p.name),
    }).eq('zone_id', currentZoneId).eq('user_id', user.id).then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentZoneId, userProfile?.display_name, userProfile?.photo_url, petNamesKey]);

  // Effect 4: heartbeat updated_at every 30 s while in a zone, so other
  // members see "still here" without depending on GPS event frequency.
  useEffect(() => {
    if (!user || !currentZoneId) return;
    const interval = setInterval(() => {
      supabase.from('zone_presence').update({ updated_at: new Date().toISOString() })
        .eq('zone_id', currentZoneId)
        .eq('user_id', user.id)
        .then();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, currentZoneId]);

  // ── Notification for new nearby alerts ──
  useEffect(() => {
    if (!user || !location || activeAlerts.length === 0) return;
    const latestAlert = activeAlerts[0];
    if (latestAlert.owner_id !== user.id) {
      const dist = calculateDistance(location.lat, location.lng, latestAlert.lat, latestAlert.lng);
      const isRecent = (Date.now() - new Date(latestAlert.created_at).getTime()) < 30000;
      if (dist <= 2 && isRecent) {
        setNotification(latestAlert);
        const timer = setTimeout(() => setNotification(null), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [activeAlerts, user?.id, location?.lat, location?.lng]);

  // ── Nearby alerts (derived) ──
  const nearbyAlerts = activeAlerts.filter(alert => {
    if (!location) return false;
    return calculateDistance(location.lat, location.lng, alert.lat, alert.lng) <= 2;
  });

  // ── Actions ──

  const triggerPanic = async (pet: Pet) => {
    if (!user) return;
    let currentLocation = location;

    if (!currentLocation) {
      // Capacitor native first if available — much more reliable on mobile
      // than the WebView's navigator.geolocation, especially with the app
      // backgrounded recently.
      const native = await getCurrentNativeLocation();
      if (native) {
        currentLocation = { lat: native.lat, lng: native.lng };
        setLocation(currentLocation);
      } else {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
          });
          currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(currentLocation);
        } catch {
          showToast("Necesitamos tu ubicación para activar la alerta.", "error");
          return;
        }
      }
    }

    if (!pet.contact_info) {
      showToast("Añade datos de contacto a tu mascota antes de activar la alerta.", "error");
      return;
    }

    // Heavy haptic — gives the user a "panic activated" tactile signal so
    // they're confident the system fired even before the network round-trip.
    void hapticImpact('heavy');

    // HI-06 fix: blur the panic-trigger location to ~100 m precision before
    // writing it to the public `alerts` row. Matches the privacy policy
    // statement on PrivacyPage (locations are never stored at sub-100m
    // precision). Rescuers still get a useful neighborhood-level pin.
    const blurredLat = Math.round(currentLocation.lat * 1000) / 1000;
    const blurredLng = Math.round(currentLocation.lng * 1000) / 1000;

    try {
      const { error } = await supabase.from('alerts').insert({
        pet_id: pet.id,
        owner_id: user.id,
        pet_name: pet.name,
        pet_photo: pet.photo_url || '',
        pet_breed: pet.breed || '',
        pet_color: pet.color || '',
        pet_traits: pet.traits || '',
        owner_contact: pet.contact_info,
        location: `POINT(${blurredLng} ${blurredLat})`,
        lat: blurredLat,
        lng: blurredLng,
        status: 'active',
      });
      if (error) throw error;
      await supabase.from('pets').update({ is_lost: true }).eq('id', pet.id);
      showToast("¡Alerta activada! Los usuarios cercanos han sido notificados.", "success");
    } catch (err) {
      console.error("Panic error:", err);
      showToast("Error al activar la alerta. Inténtalo de nuevo.", "error");
    }
  };

  const resolveAlert = async (a: Alert) => {
    try {
      await supabase.from('alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', a.id);
      await supabase.from('pets').update({ is_lost: false }).eq('id', a.pet_id);
      showToast("¡Mascota encontrada! Alerta resuelta.", "success");
    } catch (err) {
      console.error("Resolve error:", err);
      showToast("Error al resolver la alerta.", "error");
    }
  };

  const createWalkingZoneFn = async (name: string, radius: number) => {
    if (!user || !location) return;
    const { data, error } = await supabase.from('walking_zones').insert({
      name,
      creator_id: user.id,
      location: `POINT(${location.lng} ${location.lat})`,
      lat: location.lat,
      lng: location.lng,
      radius,
    }).select().single();

    if (error) {
      const msg = error.message || '';
      if (msg.includes('zone_overlap')) {
        showToast('Ya existe una zona de paseo a menos de 200 m. Únete a ella en lugar de crear una nueva.', 'error');
      } else if (msg.includes('zone_limit_reached')) {
        showToast('Has alcanzado el límite de zonas que puedes crear con tu plan.', 'error');
      } else if (error.code === '42501' || msg.toLowerCase().includes('row-level security')) {
        showToast('Necesitas PetPanic Social para crear zonas de paseo.', 'error');
      } else {
        showToast('No se pudo crear la zona. Inténtalo de nuevo.', 'error');
        console.error('createWalkingZone error:', error);
      }
      return;
    }

    if (data) {
      await supabase.from('zone_members').insert({ zone_id: data.id, user_id: user.id });
      // Immediately register the creator's presence in the new zone so they see
      // themselves without waiting for the geofencing effect to fire.
      // onConflict needed because zone_presence has a composite PK (zone_id, user_id).
      await supabase
        .from('zone_presence')
        .upsert(
          {
            zone_id: data.id,
            user_id: user.id,
            user_name: userProfile?.display_name || 'Usuario',
            user_photo: userProfile?.photo_url || '',
            pet_names: pets.map(p => p.name),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'zone_id,user_id' }
        );
      setCurrentZoneId(data.id);
      // Force immediate local refresh so the new zone shows up without waiting
      // for the Realtime broadcast (which could be delayed or dropped).
      await fetchZones();
      showToast(`Zona "${name}" creada. Ya eres fundador/a.`, 'success');
    }
  };

  const joinZoneFn = async (zone: WalkingZone) => {
    if (!user) return;
    const { error } = await supabase.from('zone_members').insert({ zone_id: zone.id, user_id: user.id });
    if (error) {
      const msg = error.message || '';
      if (error.code === '42501' || msg.toLowerCase().includes('row-level security')) {
        showToast('Necesitas PetPanic Social para unirte a una zona de paseo.', 'error');
      } else {
        showToast('No se pudo unirte a la zona. Inténtalo de nuevo.', 'error');
        console.error('joinZone error:', error);
      }
      return;
    }
    // Immediate local refresh so "Unirse" → "Miembro" badge flips without
    // depending on the Realtime round-trip.
    await fetchZones();
  };

  const searchUsersFn = async (code: string): Promise<UserProfile[]> => {
    // Reads from `public_profiles` view (id, display_name, photo_url, friend_code)
    // because the underlying `profiles` table is now self+friends-only RLS.
    // The view exposes exactly the four fields the friend-search UI needs.
    const { data } = await supabase
      .from('public_profiles')
      .select('id, display_name, photo_url, friend_code')
      .eq('friend_code', code.trim().toUpperCase())
      .limit(1);
    return ((data ?? []) as UserProfile[]).filter(u => u.id !== user?.id);
  };

  const sendFriendRequestFn = async (targetUser: UserProfile) => {
    if (!user) return;
    if (!targetUser.friend_code) {
      showToast('No se puede enviar la solicitud: falta el código de amigo.', 'error');
      return;
    }
    // Direct INSERT on `friendships` is REVOKEd from authenticated.
    // All friend-request creation now flows through the SECURITY DEFINER RPC,
    // which validates the friend code, gates on is_social_active(), blocks
    // duplicates in either direction, and writes the row server-side.
    const { error } = await supabase.rpc('send_friend_request', {
      p_friend_code: targetUser.friend_code,
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('invalid_friend_code')) {
        showToast('Código de amigo no válido.', 'error');
      } else if (msg.includes('friendship_exists')) {
        showToast('Ya hay una solicitud entre vosotros.', 'error');
      } else if (msg.includes('social_required')) {
        showToast('Necesitas PetPanic Social para enviar solicitudes.', 'error');
      } else {
        showToast('No se pudo enviar la solicitud. Inténtalo de nuevo.', 'error');
        console.error('sendFriendRequest error:', error);
      }
    }
  };

  const acceptFriendRequestFn = async (f: Friendship) => {
    void hapticImpact('light'); // small confirmation tap on native
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', f.id);
    void hapticSuccess(); // success notification haptic after the action lands
  };

  const declineFriendRequestFn = async (f: Friendship) => {
    await supabase.from('friendships').delete().eq('id', f.id);
  };

  const togglePrimaryZoneFn = async (zoneId: string) => {
    if (!user) return;
    const newId = userProfile?.primary_zone_id === zoneId ? null : zoneId;
    await supabase.from('profiles').update({ primary_zone_id: newId }).eq('id', user.id);
  };

  const updateProfileFn = async (data: { first_name?: string; last_name?: string; display_name?: string }) => {
    if (!user) return;
    await supabase.from('profiles').update(data).eq('id', user.id);
    if (data.display_name) {
      await supabase.auth.updateUser({ data: { display_name: data.display_name } });
    }
  };

  const registerPetFn = async (petData: Partial<Pet>, editingPetId: string | null) => {
    if (!user) return;
    const row = {
      owner_id: user.id,
      name: petData.name!,
      species: petData.species || 'perro',
      breed: petData.breed || '',
      color: petData.color || '',
      traits: petData.traits || '',
      contact_info: petData.contact_info || '',
      photo_url: petData.photo_url || '',
      is_lost: petData.is_lost || false,
    };

    if (editingPetId) {
      await supabase.from('pets').update(row).eq('id', editingPetId);
    } else {
      await supabase.from('pets').insert(row);
    }
  };

  const logOutFn = async () => { await supabase.auth.signOut(); };

  return (
    <AppContext.Provider value={{
      user, userProfile, loading, zonesLoaded, location, pets, activeAlerts, resolvedAlerts, nearbyAlerts,
      walkingZones, currentZoneId, friendships, friendProfiles,
      primaryZonePresence, notification, toasts, showToast, setNotification,
      triggerPanic, resolveAlert,
      joinZone: joinZoneFn,
      createWalkingZone: createWalkingZoneFn,
      refreshZones: fetchZones,
      searchUsers: searchUsersFn,
      sendFriendRequest: sendFriendRequestFn,
      acceptFriendRequest: acceptFriendRequestFn,
      declineFriendRequest: declineFriendRequestFn,
      togglePrimaryZone: togglePrimaryZoneFn,
      updateProfile: updateProfileFn,
      registerPet: registerPetFn,
      logOut: logOutFn,
      setLocation,
    }}>
      {children}
    </AppContext.Provider>
  );
}
