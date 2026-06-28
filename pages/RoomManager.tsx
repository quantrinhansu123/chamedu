import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';

import React, { useState, useMemo, useEffect } from 'react';
import { Home, Plus, Edit, Trash2, X } from 'lucide-react';
import { useRooms } from '../src/hooks/useRooms';
import { Room } from '../types';
import { ModalPortal } from '@/components/modal-portal';
import { getCenters } from '../src/services/centerService';

export const RoomManager: React.FC = () => {
  const { rooms: rawRooms, loading, createRoom, updateRoom, deleteRoom } = useRooms();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Đào tạo',
    branch: '',
    status: 'Hoạt động',
    notes: '',
  });

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const data = await getCenters();
        const centers = data
          .filter((c) => c.status === 'Active')
          .map((c) => ({ id: c.id!, name: c.name }));
        setCenterList(centers);
        if (centers.length > 0 && !formData.branch) {
          setFormData((prev) => ({ ...prev, branch: centers[0].name }));
        }
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // Sort rooms by name
  const rooms = useMemo(() => {
    return [...rawRooms].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [rawRooms]);

  // Open create modal
  const handleOpenCreate = () => {
    setEditingRoom(null);
    setFormData({
      name: '',
      type: 'Đào tạo',
      branch: centerList.length > 0 ? centerList[0].name : '',
      status: 'Hoạt động',
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name || '',
      type: room.type || 'Đào tạo',
      branch: room.branch || (centerList.length > 0 ? centerList[0].name : ''),
      status: room.status || 'Hoạt động',
      notes: room.notes || '',
    });
    setIsModalOpen(true);
  };

  // Create or Update room
  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Vui lòng nhập tên phòng học!');
      return;
    }

    try {
      if (editingRoom?.id) {
        await updateRoom(editingRoom.id, {
          name: formData.name,
          type: formData.type,
          branch: formData.branch,
          status: formData.status,
          notes: formData.notes,
          updatedAt: new Date().toISOString(),
        });
        alert('Đã cập nhật phòng học!');
      } else {
        await createRoom({
          name: formData.name,
          type: formData.type,
          branch: formData.branch,
          status: formData.status,
          notes: formData.notes,
          createdAt: new Date().toISOString(),
        });
        alert('Đã thêm phòng học mới!');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving room:', err);
      alert('Có lỗi xảy ra!');
    }
  };

  // Delete room
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa phòng "${name}"?`)) return;
    
    try {
      await deleteRoom(id);
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">Phòng học</h2>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Thêm phòng học
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="px-6 py-4 w-16">STT</th>
              <th className="px-6 py-4">Tên phòng học</th>
              <th className="px-6 py-4">Loại phòng học</th>
              <th className="px-6 py-4">Cơ sở</th>
              <th className="px-6 py-4">Ghi chú</th>
              <th className="px-6 py-4 text-center">Trạng thái</th>
              <th className="px-6 py-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rooms.length > 0 ? (
              rooms.map((room, index) => (
                <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{room.name}</td>
                  <td className="px-6 py-4">{room.type}</td>
                  <td className="px-6 py-4">{room.branch}</td>
                  <td className="px-6 py-4 text-gray-400 italic">{room.notes || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      room.status === 'Hoạt động' ? 'bg-green-700 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenEdit(room)}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(room.id, room.name)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  Chưa có phòng học nào. Nhấn "Thêm phòng học" để tạo mới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rooms.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <div className="text-xs text-gray-500">Hiển thị 1 đến {rooms.length} của {rooms.length} bản ghi</div>
          </div>
        )}
      </div>

      {/* Modal Thêm/Sửa phòng học */}
      {isModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingRoom ? 'Sửa phòng học' : 'Thêm phòng học'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở</label>
                  <select 
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {centerList.length === 0 && <option value="">-- Chưa có cơ sở --</option>}
                    {centerList.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Hoạt động">Hoạt động</option>
                    <option value="Bảo trì">Bảo trì</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng học *</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="VD: P.101, Phòng anh Công..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại phòng học</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Đào tạo">Đào tạo</option>
                    <option value="Văn phòng">Văn phòng</option>
                    <option value="Hội trường">Hội trường</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-20 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Ghi chú thêm..."
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                HUỶ BỎ
              </button>
              <button 
                onClick={handleSubmit}
                className="px-4 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-800"
              >
                XÁC NHẬN
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
