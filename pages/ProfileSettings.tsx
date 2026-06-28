/**
 * ProfileSettings Page
 * Displays and allows editing of user profile information
 */

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Building2, Briefcase, Save, Camera } from 'lucide-react';
import { useAuth } from '../src/hooks/useAuth';
export const ProfileSettings: React.FC = () => {
  const { user, staffData, loading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
  });

  useEffect(() => {
    if (staffData) {
      setFormData({
        name: staffData.name || '',
        phone: staffData.phone || '',
        address: staffData.address || '',
        email: staffData.email || user?.email || '',
      });
    }
  }, [staffData, user]);

  const handleSave = async () => {
    if (!staffData?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(null as any /* firebase removed */, 'staff', staffData.id), {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        updatedAt: new Date().toISOString(),
      });

      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi cập nhật thông tin.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Thông tin cá nhân</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý thông tin tài khoản của bạn</p>
        </div>

        {/* Avatar Section */}
        <div className="p-6 border-b border-gray-200 flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
              {staffData?.avatar ? (
                <img src={staffData.avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-indigo-600">
                  {formData.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <button className="absolute bottom-0 right-0 p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50">
              <Camera className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div>
            <p className="font-medium text-gray-900">{formData.name || 'Chưa cập nhật'}</p>
            <p className="text-sm text-gray-500">{staffData?.position || 'Nhân viên'}</p>
            {staffData?.branch && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                <Building2 className="w-3 h-3" />
                {staffData.branch}
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Họ và tên
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nhập họ và tên"
            />
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-1" />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi</p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-4 h-4 inline mr-1" />
              Số điện thoại
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nhập số điện thoại"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Địa chỉ
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nhập địa chỉ"
            />
          </div>

          {/* Position (readonly) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Briefcase className="w-4 h-4 inline mr-1" />
              Chức vụ
            </label>
            <input
              type="text"
              value={staffData?.position || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
