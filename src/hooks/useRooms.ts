/** Stub — rooms chưa có bảng Supabase */
import { useState, useEffect } from 'react';

export const useRooms = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => setLoading(false), []);
  return {
    rooms,
    loading,
    createRoom: async () => {
      throw new Error('Phòng học chưa migrate sang Supabase');
    },
    updateRoom: async () => {
      throw new Error('Phòng học chưa migrate sang Supabase');
    },
    deleteRoom: async () => {
      throw new Error('Phòng học chưa migrate sang Supabase');
    },
    refresh: async () => setRooms([]),
  };
};
