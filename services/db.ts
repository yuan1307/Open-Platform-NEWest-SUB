
import { createClient } from '@supabase/supabase-js';
import { User } from '../types';

// =========================================================
// 🔴 ACTION REQUIRED: PASTE YOUR SUPABASE KEYS BELOW
// =========================================================

// 1. Your Project URL (from Settings -> API)
const SUPABASE_URL = 'https://jdazeunvibvywkzyfvpn.supabase.co';

// 2. Your ANON PUBLIC KEY (from Settings -> API -> Project API keys -> anon/public)
// ⚠️ It usually starts with "eyJh...". Do NOT use the service_role key.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYXpldW52aWJ2eXdrenlmdnBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODg1NzIsImV4cCI6MjA4MDE2NDU3Mn0.VgfNpbaFifERUmlXzICkaf9tgo0WmQBiB-oYFzRPVWg'; 

// =========================================================

let supabase: any = null;

// Initialization Logic
const isConfigured = 
    SUPABASE_URL && 
    SUPABASE_URL.startsWith('http') && 
    SUPABASE_KEY && 
    SUPABASE_KEY.length > 20 &&
    !SUPABASE_KEY.includes('PASTE_YOUR');

if (isConfigured) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });
        console.log("🚀 Supabase Client Initialized");
    } catch (e) {
        console.error("❌ Failed to initialize Supabase:", e);
    }
} else {
    console.warn("⚠️ Supabase Credentials missing or invalid. App is running in OFFLINE mode (LocalStorage only).");
}

const parseVal = (val: any) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return val; }
};

export const db = {
    // Check connection status
    checkConnection: async (): Promise<boolean> => {
        if (!supabase) return false;
        try {
            const { error } = await supabase.from('key_value_store').select('key').limit(1);
            if (error) {
                console.error("Supabase Connection Error:", error.message);
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    getItem: async <T>(key: string): Promise<T | null> => {
        // Try Cloud First
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('key_value_store')
                    .select('value')
                    .eq('key', key)
                    .single();
                
                if (!error && data) {
                    return data.value as T;
                }
                if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found", which is fine
                    console.warn(`Cloud fetch error for ${key}:`, error.message);
                }
            } catch (e) {
                console.warn(`Offline mode: Failed to fetch ${key} from cloud.`);
            }
        }
        
        // Fallback to Local if Cloud fails or is missing
        const local = localStorage.getItem(key);
        return local ? parseVal(local) : null;
    },

    setItem: async (key: string, value: any): Promise<void> => {
        // Always save to LocalStorage (Cache/Offline)
        localStorage.setItem(key, JSON.stringify(value));

        // Sync to Cloud
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('key_value_store')
                    .upsert({ key, value });
                
                if (error) {
                    console.error(`Failed to sync ${key} to cloud:`, error.message);
                    // We don't alert here to avoid spamming the user on every save
                }
            } catch (e) {
                console.warn(`Offline mode: Failed to sync ${key} to cloud.`);
            }
        }
    },

    // NEW: Secure Access Methods (Bypass LocalStorage)
    getSecureItem: async <T>(key: string): Promise<T | null> => {
        if (!supabase) return null; // Secure items ONLY live in cloud
        try {
            const { data, error } = await supabase
                .from('key_value_store')
                .select('value')
                .eq('key', key)
                .single();
            
            if (!error && data) {
                return data.value as T;
            }
            return null;
        } catch (e) {
            console.error("Secure fetch failed", e);
            return null;
        }
    },

    setSecureItem: async (key: string, value: any): Promise<void> => {
        if (!supabase) {
            console.warn("Cannot save secure item: Supabase not connected.");
            return;
        }
        try {
            const { error } = await supabase
                .from('key_value_store')
                .upsert({ key, value });
            
            if (error) console.error("Secure save failed", error);
        } catch (e) {
            console.error("Secure save exception", e);
        }
    },

    removeItem: async (key: string): Promise<void> => {
        localStorage.removeItem(key);
        if (supabase) {
            try {
                await supabase.from('key_value_store').delete().eq('key', key);
            } catch (e) {
                console.warn(`Offline mode: Failed to delete ${key} from cloud.`);
            }
        }
    },

    scan: async <T>(prefix: string): Promise<{ key: string, value: T }[]> => {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('key_value_store')
                    .select('key, value')
                    .like('key', `${prefix}%`);
                
                if (!error && data) {
                    return data.map((row: any) => ({ key: row.key, value: row.value as T }));
                }
            } catch (e) {
                console.warn(`Offline mode: Failed to scan ${prefix} from cloud.`);
            }
        }
        
        // Local Fallback
        const results: { key: string, value: T }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                const val = localStorage.getItem(key);
                if (val) results.push({ key, value: parseVal(val) });
            }
        }
        return results;
    },

    exportAll: async (): Promise<Record<string, any>> => {
        if (supabase) {
            try {
                const { data } = await supabase.from('key_value_store').select('*');
                const exportData: Record<string, any> = {};
                data?.forEach((row: any) => {
                    exportData[row.key] = row.value;
                });
                return exportData;
            } catch (e) {
                console.error("Export failed:", e);
                // Fallback to local export logic if needed, but exportAll implies cloud sync usually
            }
        }
        // Fallback local export
        const exportData: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('basis_')) {
                exportData[key] = parseVal(localStorage.getItem(key));
            }
        }
        return exportData;
    },

    importAll: async (data: Record<string, any>): Promise<void> => {
        for (const [key, val] of Object.entries(data)) {
            await db.setItem(key, typeof val === 'string' ? JSON.parse(val) : val);
        }
    },

    // REFACTORED: Instead of pushing Local -> Cloud (Risk of overwrite),
    // this function now pulls Cloud -> Local to ensure the client has the latest truth.
    // Writes are already handled by setItem immediately.
    pullCloudData: async (): Promise<number> => {
        if (!supabase) throw new Error("Cloud not connected. Check API Keys.");
        
        console.log("🔄 Starting Pull Cloud -> Local...");
        try {
            const { data, error } = await supabase
                .from('key_value_store')
                .select('key, value')
                .like('key', 'basis_%'); // Only pull app-related keys
                
            if (error) {
                console.error("Failed to pull data:", error);
                throw error;
            }

            let count = 0;
            if (data) {
                data.forEach((row: any) => {
                    // Supabase returns the value as an object (if JSONB). LocalStorage needs string.
                    localStorage.setItem(row.key, JSON.stringify(row.value));
                    count++;
                });
            }
            console.log(`✅ Pull Complete. Updated ${count} items.`);
            return count;
        } catch (e) {
            console.error("Critical Pull Error:", e);
            throw e;
        }
    }
};
