/**
 * Center Settings Page
 * Thiết lập trung tâm/chi nhánh
 */

import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, X, MapPin, Phone, Mail, Save } from 'lucide-react';
import * as centerService from '../src/services/centerService';
import { Center, CenterSettings as Settings } from '../src/services/centerService';
import { ModalPortal } from '@/components/modal-portal';

export const CenterSettings: React.FC = () => {
  const [centers, setCenters] = useState<Center[]>([]);
  const [settings, setSettings] = useState<Settings>({
    companyName: '',
    taxCode: '',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [centersData, settingsData] = await Promise.all([
        centerService.getCenters(),
        centerService.getSettings(),
      ]);
      setCenters(centersData);
      if (settingsData) {
        setSettings(settingsData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await centerService.saveSettings(settings);
      alert('Đã lưu cài đặt');
    } catch (err) {
      alert('Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (!confirm('Xóa trung tâm này?')) return;
    try {
      await centerService.deleteCenter(id);
      await fetchData();
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="bg-purple-100 p-2 rounded-lg">
          <Building2 className="text-purple-600" size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Thiết lập trung tâm</h2>
          <p className="text-sm text-gray-500">Quản lý thông tin công ty và chi nhánh</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          Đang tải...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
              <h3 className="font-bold text-gray-800">Thông tin công ty</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên công ty</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Công ty TNHH ABC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
                <input
                  type="text"
                  value={settings.taxCode || ''}
                  onChange={(e) => setSettings({ ...settings, taxCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiền tệ</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="VND">VND - Việt Nam Đồng</option>
                    <option value="USD">USD - US Dollar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Múi giờ</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Asia/Ho_Chi_Minh">GMT+7 (Việt Nam)</option>
                    <option value="Asia/Bangkok">GMT+7 (Bangkok)</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>

          {/* Centers List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Danh sách trung tâm</h3>
              <button
                onClick={() => { setEditingCenter(null); setShowModal(true); }}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
              >
                <Plus size={16} /> Thêm
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {centers.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Building2 size={48} className="mx-auto mb-2 opacity-20" />
                  Chưa có trung tâm nào
                </div>
              ) : centers.map((center) => (
                <div key={center.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {center.name}
                        {center.isMain && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            Chính
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          center.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {center.status === 'Active' ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} /> {center.address}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1"><Phone size={12} /> {center.phone}</span>
                        {center.email && <span className="flex items-center gap-1"><Mail size={12} /> {center.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingCenter(center); setShowModal(true); }}
                        className="p-1 text-gray-400 hover:text-purple-600"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => center.id && handleDeleteCenter(center.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Center Modal */}
      {showModal && (
        <CenterModal
          center={editingCenter}
          onClose={() => { setShowModal(false); setEditingCenter(null); }}
          onSubmit={async (data) => {
            try {
              if (editingCenter?.id) {
                await centerService.updateCenter(editingCenter.id, data);
              } else {
                await centerService.createCenter(data as Omit<Center, 'id'>);
              }
              await fetchData();
              setShowModal(false);
              setEditingCenter(null);
            } catch (err: any) {
              alert(err?.message || 'Không thể lưu trung tâm');
              throw err;
            }
          }}
        />
      )}
    </div>
  );
};

// Center Modal
interface CenterModalProps {
  center?: Center | null;
  onClose: () => void;
  onSubmit: (data: Partial<Center>) => Promise<void>;
}

const CenterModal: React.FC<CenterModalProps> = ({ center, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: center?.name || '',
    code: center?.code || '',
    address: center?.address || '',
    phone: center?.phone || '',
    email: center?.email || '',
    manager: center?.manager || '',
    signatureUrl: center?.signatureUrl || '',
    workingHours: center?.workingHours || '8:00 - 21:00',
    isMain: center?.isMain || false,
    status: center?.status || 'Active' as 'Active' | 'Inactive',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.phone) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">
            {center ? 'Sửa trung tâm' : 'Thêm trung tâm'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên trung tâm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="CS01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SĐT <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Địa chỉ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Người đại diện <span className="text-xs text-gray-400">(Ký HĐ)</span>
              </label>
              <input
                type="text"
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="VD: Nguyễn Văn A - Giám đốc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL chữ ký <span className="text-xs text-gray-400">(Hiển thị trên HĐ)</span>
              </label>
              <input
                type="text"
                value={formData.signatureUrl}
                onChange={(e) => setFormData({ ...formData, signatureUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="/signature-party-a.png hoặc URL đầy đủ"
              />
              {formData.signatureUrl && (
                <div className="mt-2 p-2 bg-gray-50 rounded border">
                  <p className="text-xs text-gray-500 mb-1">Xem trước:</p>
                  <img
                    src={formData.signatureUrl.startsWith('/') ? formData.signatureUrl : formData.signatureUrl}
                    alt="Chữ ký"
                    className="h-10 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ làm việc</label>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="Active">Hoạt động</option>
                <option value="Inactive">Tạm dừng</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isMain}
                  onChange={(e) => setFormData({ ...formData, isMain: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Đây là trung tâm chính</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
