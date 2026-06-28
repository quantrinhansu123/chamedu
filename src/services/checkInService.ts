/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface VerificationResult {
    success: boolean;
    method: CheckInVerificationMethod | null;
    matchedWifiId?: string;
    message: string;
}

export const useWifiConfig = async (..._args: any[]): Promise<any> => { notMigrated('useWifiConfig'); };
export const usePermissions = async (..._args: any[]): Promise<any> => { notMigrated('usePermissions'); };
export const getPublicIp = async (..._args: any[]): Promise<any> => { console.warn('[stub] getPublicIp'); return null; };
export const useState = async (..._args: any[]): Promise<any> => { notMigrated('useState'); };
export const useEffect = async (..._args: any[]): Promise<any> => { notMigrated('useEffect'); };
export const useCallback = async (..._args: any[]): Promise<any> => { notMigrated('useCallback'); };
export const getTodayCheckIn = async (..._args: any[]): Promise<any> => { console.warn('[stub] getTodayCheckIn'); return null; };
export const getCheckIns = async (..._args: any[]): Promise<any> => { console.warn('[stub] getCheckIns'); return null; };
export const checkIn = async (..._args: any[]): Promise<any> => { console.warn('[stub] checkIn'); return []; };
export const checkOut = async (..._args: any[]): Promise<any> => { console.warn('[stub] checkOut'); return []; };
export const verifyForCheckIn = async (..._args: any[]): Promise<any> => { console.warn('[stub] verifyForCheckIn'); return []; };
export const getMonthlyStats = async (..._args: any[]): Promise<any> => { console.warn('[stub] getMonthlyStats'); return null; };
