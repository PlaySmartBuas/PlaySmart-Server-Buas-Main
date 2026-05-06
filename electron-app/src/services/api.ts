import axios, { type AxiosInstance } from 'axios';
import type { AuthResponse, LoginCredentials, SignUpData, User } from '../types';
import { getAuthToken } from '../utils/auth';

// const API_BASE_URL = 'http://localhost:8000/api';
// ========================================
// API Configuration - Read from Environment
// ========================================
const BASE_URL = import.meta.env.VITE_API_URL || 'http://10.4.28.2:8000';
const API_BASE_URL = `${BASE_URL}/api`;

console.log('🔗 API Service Configuration');
console.log('Base URL:', BASE_URL);
console.log('Full API URL:', API_BASE_URL);
console.log('Environment:', import.meta.env.MODE);

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Toolkit Configuration Types
export interface ToolkitConfig {
  id: number;
  user_id: number;
  toolkit_path: string | null;
  obs_path: string | null;
  tobii_path: string | null;
  data_directory: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ToolkitConfigUpdate {
  toolkit_path?: string | null;
  obs_path?: string | null;
  tobii_path?: string | null;
  data_directory?: string | null;
}

// Valorant API Types
export interface ValorantAccountData {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: string;
  title: string;
  platforms: string[];
  updated_at: string;
}

export interface ValorantAccountResponse {
  success: boolean;
  data: ValorantAccountData;
  status: number;
}


// Add these types after ValorantAccountData interface

export interface ValorantMatchMetadata {
  map: string;
  game_version: string;
  game_length: number;
  game_start: number;
  game_start_patched: string;
  rounds_played: number;
  mode: string;
  mode_id: string;
  queue: string;
  season_id: string;
  platform: string;
  matchid: string;
  region: string;
  cluster: string;
}

export interface ValorantPlayerStats {
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  bodyshots: number;
  headshots: number;
  legshots: number;
}

export interface ValorantPlayer {
  ability_casts: {};
  puuid: string;
  name: string;
  tag: string;
  team: string;
  level: number;
  character: string;
  currenttier: number;
  currenttier_patched: string;
  player_card: string;
  stats: ValorantPlayerStats;
  damage_made: number;
  damage_received: number;
}

export interface ValorantTeam {
  has_won: boolean;
  rounds_won: number;
  rounds_lost: number;
}

export interface ValorantMatch {
  metadata: ValorantMatchMetadata;
  players: {
    all_players: ValorantPlayer[];
    red: ValorantPlayer[];
    blue: ValorantPlayer[];
  };
  teams: {
    red: ValorantTeam;
    blue: ValorantTeam;
  };
}

export interface ValorantMatchHistoryResponse {
  success: boolean;
  data: ValorantMatch[];
  status: number;
}

export type GameMode = 
  | "competitive" 
  | "unrated" 
  | "deathmatch" 
  | "spikerush" 
  | "swiftplay"
  | "escalation"
  | "teamdeathmatch"
  | "custom"
  | "newmap"
  | "replication"
  | "snowballfight";

export type ValorantRegion = "eu" | "na" | "ap" | "kr" | "latam" | "br";


// Add this interface for detailed match data (same structure as ValorantMatch but for single match)
export interface ValorantMatchDetails {
  metadata: ValorantMatchMetadata;
  players: {
    all_players: ValorantPlayer[];
    red: ValorantPlayer[];
    blue: ValorantPlayer[];
  };
  teams: {
    red: ValorantTeam;
    blue: ValorantTeam;
  };
  rounds: any[]; // Full round-by-round data
  kills: any[]; // All kill events
  observers?: any[];
  coaches?: any[];
}

export interface ValorantMatchDetailsResponse {
  success: boolean;
  data: ValorantMatchDetails;
  status: number;
}

// Auth API
export const authAPI = {
  signup: async (data: SignUpData): Promise<User> => {
    const response = await api.post<User>('/auth/signup', data);
    return response.data;
  },
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },
};

// Toolkit API
export const toolkitAPI = {
  getConfig: async (): Promise<ToolkitConfig> => {
    const response = await api.get<ToolkitConfig>('/toolkit/config');
    return response.data;
  },
  saveConfig: async (config: ToolkitConfigUpdate): Promise<ToolkitConfig> => {
    const response = await api.post<ToolkitConfig>('/toolkit/config', config);
    return response.data;
  },
};

// Coach API
export const coachAPI = {
  getConfig: async () => {
    const response = await fetch(`${BASE_URL}/api/coach/config`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch config');
    return response.json();
  },
  saveConfig: async (config: { data_directory?: string }) => {
    const response = await fetch(`${BASE_URL}/api/coach/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to save config');
    return response.json();
  }
};

// Valorant API
// Valorant API
export const valorantAPI = {
  /**
   * Get Valorant account info by Riot ID (format: name#tag)
   */
  getAccountInfo: async (
    riotId: string, 
    force: boolean = false
  ): Promise<ValorantAccountResponse> => {
    try {
      if (!riotId.includes('#')) {
        throw new Error('Invalid Riot ID format. Use name#tag (e.g., skywalker17#17605)');
      }

      const [name, tag] = riotId.split('#');
      
      if (!name || !tag) {
        throw new Error('Invalid Riot ID format. Both name and tag are required');
      }

      const response = await api.get<ValorantAccountResponse>(
        `/valorant/account/${name}/${tag}`,
        {
          params: { force }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || 'Failed to fetch account info');
      }
      throw error;
    }
  },

  /**
   * Get Valorant account info by separate name and tag
   */
  getAccountByParts: async (
    name: string,
    tag: string,
    force: boolean = false
  ): Promise<ValorantAccountResponse> => {
    try {
      const response = await api.get<ValorantAccountResponse>(
        `/valorant/account/${name}/${tag}`,
        {
          params: { force }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || 'Failed to fetch account info');
      }
      throw error;
    }
  },
  getMatchDetails: async (matchId: string): Promise<ValorantMatchDetailsResponse> => {
    try {
      const response = await api.get<ValorantMatchDetailsResponse>(
        `/valorant/match/${matchId}`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || 'Failed to fetch match details');
      }
      throw error;
    }
  },

  /**
   * Get match history by Riot ID
   */
  getMatchHistory: async (
    riotId: string,
    region: ValorantRegion = 'eu',
    mode?: GameMode,
    size: number = 5
  ): Promise<ValorantMatchHistoryResponse> => {
    try {
      if (!riotId.includes('#')) {
        throw new Error('Invalid Riot ID format. Use name#tag');
      }

      const [name, tag] = riotId.split('#');
      
      if (!name || !tag) {
        throw new Error('Invalid Riot ID format. Both name and tag are required');
      }

      const response = await api.get<ValorantMatchHistoryResponse>(
        `/valorant/matches/${region}/${name}/${tag}`,
        {
          params: { 
            mode,
            size: Math.min(size, 10) // API max is 10
          }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || 'Failed to fetch match history');
      }
      throw error;



    
    }
  },
};

export const valorantStorage = {
  storePuuid: (puuid: string): void => {
    sessionStorage.setItem('valorant_puuid', puuid);
  },

  getPuuid: (): string | null => {
    return sessionStorage.getItem('valorant_puuid');
  },

  storeAccountData: (accountData: ValorantAccountData): void => {
    sessionStorage.setItem('valorant_account', JSON.stringify(accountData));
  },

  getAccountData: (): ValorantAccountData | null => {
    const data = sessionStorage.getItem('valorant_account');
    return data ? JSON.parse(data) : null;
  },

  clearValorantData: (): void => {
    sessionStorage.removeItem('valorant_puuid');
    sessionStorage.removeItem('valorant_account');
    sessionStorage.removeItem('current_valorant_riot_id');
  }
};

export {BASE_URL as API_BASE_URL};
export default api;