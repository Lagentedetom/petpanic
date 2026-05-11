export type SubscriptionTier = 'free' | 'social';
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'expired';
export type SubscriptionInterval = 'month' | 'year';

export interface UserProfile {
  id: string;
  // email + first_name + last_name are only present when reading own row
  // (RLS allows full self-read). For OTHER users we read via public_profiles
  // which exposes only the four fields below — so these are optional.
  email?: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  photo_url: string;
  friend_code?: string;
  primary_zone_id?: string;
  subscription_tier?: SubscriptionTier;
  subscription_status?: SubscriptionStatus;
  subscription_interval?: SubscriptionInterval | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
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
  resolved_at?: string;
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
