export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  photo_url: string;
  friend_code?: string;
  primary_zone_id?: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: 'perro' | 'gato' | 'otro';
  breed: string;
  color: string;
  traits: string;
  contact_info: string;
  photo_url?: string;
  is_lost: boolean;
}

export interface Alert {
  id: string;
  pet_id: string;
  owner_id: string;
  pet_name: string;
  pet_photo?: string;
  pet_breed?: string;
  pet_color?: string;
  pet_traits?: string;
  owner_contact: string;
  lat: number;
  lng: number;
  status: 'active' | 'resolved';
  created_at: string;
}

export interface Message {
  id: string;
  alert_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  image_url?: string;
  created_at: string;
}

export interface WalkingZone {
  id: string;
  name: string;
  creator_id: string;
  lat: number;
  lng: number;
  radius: number;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
}

export interface ZonePresence {
  zone_id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  pet_names: string[];
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}
