import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { calculateDistance } from '../utils';
import type { Pet, Alert, WalkingZone, ZonePresence, UserProfile, Friendship } from '../types';

interface AppContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  location: { lat: number; lng: number } | null;
  pets: Pet[];
  activeAlerts: Alert[];
  nearbyAlerts: Alert[];
  walkingZones: WalkingZone[];
  currentZoneId: string | null;
  friendships: Friendship[];
  friendProfiles: Record<string, UserProfile>;
  primaryZonePresence: ZonePresence[];
  notification: Alert | null;
  setNotification: React.Dispatch<React.SetStateAction<Alert | null>>;
  triggerPanic: (pet: Pet) => Promise<void>;
  resolveAlert: (alert: Alert) => Promise<void>;
  joinZone: (zone: WalkingZone) => Promise<void>;
  createWalkingZone: (name: string, radius: number) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [walkingZones, setWalkingZones] = useState<WalkingZone[]>([]);
  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [primaryZonePresence, setPrimaryZonePresence] = useState<ZonePresence[]>([]);
  const [notification, setNotification] = useState<Alert | null>(null);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
  useEffect(() => {
    if (!user) return;

    const updateLoc = (pos: GeolocationPosition) => {
      const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(newLoc);
      supabase.from('profiles').update({
        last_location: `POINT(${newLoc.lng} ${newLoc.lat})`,
        last_location_at: new Date().toISOString(),
      }).eq('id', user.id).then();
    };

    navigator.geolocation.getCurrentPosition(updateLoc, console.error, { enableHighAccuracy: true, timeout: 10000 });
    const watchId = navigator.geolocation.watchPosition(updateLoc, console.error, { enableHighAccuracy: true, timeout: 10000 });
    return () => navigator.geolocation.clearWatch(watchId);
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
  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      const { data } = await supabase.from('alerts').select('*').eq('status', 'active').order('created_at', { ascending: false });
      setActiveAlerts((data ?? []) as Alert[]);
    };
    fetchAlerts();

    const channel = supabase
      .channel('active-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' },
        () => { fetchAlerts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Walking zones listener ──
  useEffect(() => {
    if (!user) return;

    const fetchZones = async () => {
      const { data: zones } = await supabase.from('walking_zones').select('*');
      if (!zones) { setWalkingZones([]); return; }

      // Get member counts and membership status
      const { data: members } = await supabase.from('zone_members').select('zone_id, user_id');
      const enriched = zones.map(z => ({
        ...z,
        member_count: members?.filter(m => m.zone_id === z.id).length ?? 0,
        is_member: members?.some(m => m.zone_id === z.id && m.user_id === user.id) ?? false,
      }));
      setWalkingZones(enriched as WalkingZone[]);
    };
    fetchZones();

    const channel = supabase
      .channel('walking-zones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walking_zones' }, () => fetchZones())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zone_members' }, () => fetchZones())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Friendships listener ──
  useEffect(() => {
    if (!user) return;

    const fetchFriendships = async () => {
      const { data } = await supabase.from('friendships').select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const fs = (data ?? []) as Friendship[];
      setFriendships(fs);

      // Fetch friend profiles
      const friendIds = fs.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
      const newIds = friendIds.filter(id => !friendProfiles[id]);
      if (newIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', newIds);
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

  // ── Geofencing / presence update ──
  useEffect(() => {
    if (!user || !location || walkingZones.length === 0) return;

    const findCurrentZone = () => {
      for (const zone of walkingZones) {
        const dist = calculateDistance(location.lat, location.lng, zone.lat, zone.lng) * 1000;
        if (dist <= zone.radius) return zone.id;
      }
      return null;
    };

    const newZoneId = findCurrentZone();
    if (newZoneId !== currentZoneId) {
      if (currentZoneId) {
        supabase.from('zone_presence').delete()
          .eq('zone_id', currentZoneId).eq('user_id', user.id).then();
      }
      if (newZoneId) {
        supabase.from('zone_presence').upsert({
          zone_id: newZoneId,
          user_id: user.id,
          user_name: userProfile?.display_name || 'Usuario',
          user_photo: userProfile?.photo_url || '',
          pet_names: pets.map(p => p.name),
          updated_at: new Date().toISOString(),
        }).then();
      }
      setCurrentZoneId(newZoneId);
    } else if (newZoneId) {
      supabase.from('zone_presence').update({ updated_at: new Date().toISOString() })
        .eq('zone_id', newZoneId).eq('user_id', user.id).then();
    }

    return () => {
      if (currentZoneId && user) {
        supabase.from('zone_presence').delete()
          .eq('zone_id', currentZoneId).eq('user_id', user.id).then();
      }
    };
  }, [location, walkingZones, user, pets, currentZoneId]);

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
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(currentLocation);
      } catch {
        alert("Necesitamos tu ubicación para activar la alerta.");
        return;
      }
    }

    if (!pet.contact_info) {
      alert("Por favor, edita el perfil de tu mascota para añadir datos de contacto antes de activar la alerta.");
      return;
    }

    await supabase.from('alerts').insert({
      pet_id: pet.id,
      owner_id: user.id,
      pet_name: pet.name,
      pet_photo: pet.photo_url || '',
      pet_breed: pet.breed || '',
      pet_color: pet.color || '',
      pet_traits: pet.traits || '',
      owner_contact: pet.contact_info,
      location: `POINT(${currentLocation.lng} ${currentLocation.lat})`,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      status: 'active',
    });

    await supabase.from('pets').update({ is_lost: true }).eq('id', pet.id);
    alert("¡Alerta activada! Los usuarios cercanos han sido notificados.");
  };

  const resolveAlert = async (a: Alert) => {
    await supabase.from('alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', a.id);
    await supabase.from('pets').update({ is_lost: false }).eq('id', a.pet_id);
  };

  const createWalkingZoneFn = async (name: string, radius: number) => {
    if (!user || !location) return;
    const { data } = await supabase.from('walking_zones').insert({
      name,
      creator_id: user.id,
      location: `POINT(${location.lng} ${location.lat})`,
      lat: location.lat,
      lng: location.lng,
      radius,
    }).select().single();

    if (data) {
      await supabase.from('zone_members').insert({ zone_id: data.id, user_id: user.id });
    }
  };

  const joinZoneFn = async (zone: WalkingZone) => {
    if (!user) return;
    await supabase.from('zone_members').insert({ zone_id: zone.id, user_id: user.id });
  };

  const searchUsersFn = async (code: string): Promise<UserProfile[]> => {
    const { data } = await supabase.from('profiles').select('*')
      .eq('friend_code', code.trim().toUpperCase()).limit(1);
    return ((data ?? []) as UserProfile[]).filter(u => u.id !== user?.id);
  };

  const sendFriendRequestFn = async (targetUser: UserProfile) => {
    if (!user) return;
    await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: targetUser.id,
      status: 'pending',
    });
  };

  const acceptFriendRequestFn = async (f: Friendship) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', f.id);
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
      user, userProfile, loading, location, pets, activeAlerts, nearbyAlerts,
      walkingZones, currentZoneId, friendships, friendProfiles,
      primaryZonePresence, notification, setNotification,
      triggerPanic, resolveAlert,
      joinZone: joinZoneFn,
      createWalkingZone: createWalkingZoneFn,
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
