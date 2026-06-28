import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
/**
 * Staff Reward & Penalty Page
 * - Thưởng gia hạn cho GVCN/TG
 * - Phạt đi muộn theo wifi checkin
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Gift, AlertTriangle, Settings, Plus, Trash2, X, DollarSign, Clock, User, Calendar, FileText, ChevronDown } from 'lucide-react';
import { useStaff } from '../src/hooks/useStaff';
import { formatCurrency } from '../src/utils/currencyUtils';
import { ModalPortal } from '@/components/modal-portal';

interface RewardPenaltyConfig {
  id?: string;
  type: 'renewal_bonus' | 'late_penalty';
  name: string;
  // For renewal bonus
  bonusType?: 'fixed' | 'percentage';
  bonusAmount?: number; // VND or %
  applyTo?: 'gvcn' | 'assistant' | 'both';
  // For late penalty
  penaltyPerMinute?: number; // VND per minute
  graceMinutes?: number; // Free minutes before penalty
  maxPenalty?: number; // Max penalty per day
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RewardPenaltyRecord {
  id?: string;
  staffId: string;
  staffName: string;
  type: 'reward' | 'penalty';
  category: 'renewal_bonus' | 'late_penalty' | 'other';
  amount: number;
  reason: string;
  relatedId?: string; // contractId or attendanceId
  relatedInfo?: string; // student name or date
  month: number;
  year: number;
  createdAt: string;
  createdBy: string;
  status: 'pending' | 'approved' | 'paid';
}

export const StaffRewardPenalty: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'records' | 'config'>('records');
  const [records, setRecords] = useState<RewardPenaltyRecord[]>([]);
  const [configs, setConfigs] = useState<RewardPenaltyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'reward' | 'penalty'>('all');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  
  const { staff } = useStaff();

  // Form states
  const [newRecord, setNewRecord] = useState<Partial<RewardPenaltyRecord>>({
    type: 'reward',
    category: 'other',
    amount: 0,
    reason: '',
    staffId: '',
    staffName: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: 'pending'
  });

  const [newConfig, setNewConfig] = useState<Partial<RewardPenaltyConfig>>({
    type: 'renewal_bonus',
    name: '',
    bonusType: 'fixed',
    bonusAmount: 100000,
    applyTo: 'both',
    penaltyPerMinute: 5000,
    graceMinutes: 5,
    maxPenalty: 200000,
    active: true
  });

  // Fetch records - simplified query without compound index requirement
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(null as any /* firebase removed */, 'staffRewardPenalty'), (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RewardPenaltyRecord[];
      // Filter by month/year in client
      const filtered = allData
        .filter(r => r.month === filterMonth && r.year === filterYear)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(filtered);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching records:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterMonth, filterYear]);

  // Fetch configs
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(null as any /* firebase removed */, 'rewardPenaltyConfig'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RewardPenaltyConfig[];
      setConfigs(data);
    });
    return () => unsubscribe();
  }, []);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (filterType === 'all') return records;
    return records.filter(r => r.type === filterType);
  }, [records, filterType]);

  // Summary
  const summary = useMemo(() => {
    const totalReward = records.filter(r => r.type === 'reward').reduce((sum, r) => sum + r.amount, 0);
    const totalPenalty = records.filter(r => r.type === 'penalty').reduce((sum, r) => sum + r.amount, 0);
    return { totalReward, totalPenalty, net: totalReward - totalPenalty };
  }, [records]);

  // Add record
  const handleAddRecord = async () => {
    if (!newRecord.staffId || !newRecord.amount || !newRecord.reason) {
      alert('Vui lòng điền đầy đủ thông tin (nhân viên, số tiền, lý do)');
      return;
    }

    try {
      const recordData = {
        staffId: newRecord.staffId,
        staffName: newRecord.staffName,
        type: newRecord.type,
        category: newRecord.category,
        amount: Number(newRecord.amount),
        reason: newRecord.reason,
        month: newRecord.month || new Date().getMonth() + 1,
        year: newRecord.year || new Date().getFullYear(),
        status: newRecord.status || 'pending',
        createdAt: new Date().toISOString(),
        createdBy: 'Admin'
      };
      
      await addDoc(collection(null as any /* firebase removed */, 'staffRewardPenalty'), recordData);
      setShowAddModal(false);
      setNewRecord({
        type: 'reward',
        category: 'other',
        amount: 0,
        reason: '',
        staffId: '',
        staffName: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        status: 'pending'
      });
      alert('Đã thêm thành công!');
    } catch (err: any) {
      console.error('Error adding record:', err);
      alert('Có lỗi xảy ra: ' + (err.message || 'Unknown error'));
    }
  };

  // Save config
  const handleSaveConfig = async () => {
    if (!newConfig.name) {
      alert('Vui lòng nhập tên cấu hình');
      return;
    }

    try {
      const configData = {
        type: newConfig.type,
        name: newConfig.name,
        active: newConfig.active ?? true,
        ...(newConfig.type === 'renewal_bonus' && {
          bonusType: newConfig.bonusType || 'fixed',
          bonusAmount: newConfig.bonusAmount || 0,
          applyTo: newConfig.applyTo || 'both'
        }),
        ...(newConfig.type === 'late_penalty' && {
          penaltyPerMinute: newConfig.penaltyPerMinute || 0,
          graceMinutes: newConfig.graceMinutes || 0,
          maxPenalty: newConfig.maxPenalty || 0
        })
      };

      if (newConfig.id) {
        await updateDoc(doc(null as any /* firebase removed */, 'rewardPenaltyConfig', newConfig.id), {
          ...configData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(null as any /* firebase removed */, 'rewardPenaltyConfig'), {
          ...configData,
          createdAt: new Date().toISOString()
        });
      }
      
      // Reset form
      setNewConfig({
        type: 'renewal_bonus',
        name: '',
        bonusType: 'fixed',
        bonusAmount: 100000,
        applyTo: 'both',
        penaltyPerMinute: 5000,
        graceMinutes: 5,
        maxPenalty: 200000,
        active: true
      });
      setShowConfigModal(false);
      alert('Đã lưu cấu hình!');
    } catch (err: any) {
      console.error('Error saving config:', err);
      alert('Có lỗi xảy ra: ' + (err.message || 'Unknown error'));
    }
  };

  // Delete record
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    try {
      await deleteDoc(doc(null as any /* firebase removed */, 'staffRewardPenalty', id));
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  // Delete config
  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa cấu hình này?')) return;
    try {
      await deleteDoc(doc(null as any /* firebase removed */, 'rewardPenaltyConfig', id));
    } catch (err) {
      console.error('Error deleting config:', err);
    }
  };

  // Update record status
  const handleUpdateStatus = async (id: string, newStatus: 'pending' | 'approved' | 'paid') => {
    try {
      await updateDoc(doc(null as any /* firebase removed */, 'staffRewardPenalty', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Lỗi cập nhật: ' + (err.message || 'Unknown'));
    }
  };

  const renewalConfig = configs.find(c => c.type === 'renewal_bonus' && c.active);
  const lateConfig = configs.find(c => c.type === 'late_penalty' && c.active);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Thưởng / Phạt Nhân Sự</h2>
            <p className="text-sm text-gray-500 mt-1">Quản lý thưởng gia hạn, phạt đi muộn</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Settings size={18} />
              Cấu hình
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus size={18} />
              Thêm mới
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <Gift className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm text-green-600">Tổng thưởng</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(summary.totalReward)}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm text-red-600">Tổng phạt</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(summary.totalPenalty)}</p>
            </div>
          </div>
        </div>
        <div className={`${summary.net >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'} p-4 rounded-xl border`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${summary.net >= 0 ? 'bg-blue-500' : 'bg-orange-500'} rounded-lg flex items-center justify-center`}>
              <DollarSign className="text-white" size={20} />
            </div>
            <div>
              <p className={`text-sm ${summary.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Tổng cộng</p>
              <p className={`text-xl font-bold ${summary.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Configs Info */}
      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
        <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <Settings size={16} /> Cấu hình đang áp dụng
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-amber-700">
              <strong>Thưởng gia hạn:</strong>{' '}
              {renewalConfig ? (
                <>
                  {renewalConfig.bonusType === 'fixed' 
                    ? formatCurrency(renewalConfig.bonusAmount || 0)
                    : `${renewalConfig.bonusAmount}%`
                  }
                  {' '}cho {renewalConfig.applyTo === 'both' ? 'GVCN & TG' : renewalConfig.applyTo === 'gvcn' ? 'GVCN' : 'Trợ giảng'}
                </>
              ) : (
                <span className="text-gray-500">Chưa cấu hình</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-amber-700">
              <strong>Phạt đi muộn:</strong>{' '}
              {lateConfig ? (
                <>
                  {formatCurrency(lateConfig.penaltyPerMinute || 0)}/phút (sau {lateConfig.graceMinutes} phút), tối đa {formatCurrency(lateConfig.maxPenalty || 0)}
                </>
              ) : (
                <span className="text-gray-500">Chưa cấu hình</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {(['all', 'reward', 'penalty'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === type
                  ? type === 'reward' ? 'bg-green-100 text-green-700' 
                    : type === 'penalty' ? 'bg-red-100 text-red-700'
                    : 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type === 'reward' ? 'Thưởng' : 'Phạt'}
            </button>
          ))}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Nhân viên</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Loại</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Lý do</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Số tiền</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Trạng thái</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Ngày tạo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Chưa có dữ liệu thưởng/phạt trong tháng này
                </td>
              </tr>
            ) : (
              filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{record.staffName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      record.type === 'reward' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {record.type === 'reward' ? 'Thưởng' : 'Phạt'}
                    </span>
                    <span className="ml-2 text-gray-500 text-xs">
                      {record.category === 'renewal_bonus' ? '(Gia hạn)' 
                        : record.category === 'late_penalty' ? '(Đi muộn)' 
                        : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={record.reason}>
                    {record.reason}
                    {record.relatedInfo && (
                      <span className="block text-xs text-gray-400">{record.relatedInfo}</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${
                    record.type === 'reward' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {record.type === 'reward' ? '+' : '-'}{formatCurrency(record.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={record.status}
                      onChange={(e) => record.id && handleUpdateStatus(record.id, e.target.value as any)}
                      className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${
                        record.status === 'paid' ? 'bg-green-100 text-green-700'
                          : record.status === 'approved' ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <option value="pending">Chờ duyệt</option>
                      <option value="approved">Đã duyệt</option>
                      <option value="paid">Đã trả</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {record.createdAt ? new Date(record.createdAt).toLocaleDateString('vi-VN') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => record.id && handleDeleteRecord(record.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Thêm Thưởng/Phạt</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewRecord({ ...newRecord, type: 'reward' })}
                    className={`flex-1 py-2 rounded-lg font-medium ${
                      newRecord.type === 'reward' 
                        ? 'bg-green-100 text-green-700 border-2 border-green-500' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Thưởng
                  </button>
                  <button
                    onClick={() => setNewRecord({ ...newRecord, type: 'penalty' })}
                    className={`flex-1 py-2 rounded-lg font-medium ${
                      newRecord.type === 'penalty' 
                        ? 'bg-red-100 text-red-700 border-2 border-red-500' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Phạt
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhân viên</label>
                <select
                  value={newRecord.staffId}
                  onChange={(e) => {
                    const s = staff.find(st => st.id === e.target.value);
                    setNewRecord({ ...newRecord, staffId: e.target.value, staffName: s?.name || '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phân loại</label>
                <select
                  value={newRecord.category}
                  onChange={(e) => setNewRecord({ ...newRecord, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="renewal_bonus">Thưởng gia hạn</option>
                  <option value="late_penalty">Phạt đi muộn</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  value={newRecord.amount}
                  onChange={(e) => setNewRecord({ ...newRecord, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="100000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do</label>
                <textarea
                  value={newRecord.reason}
                  onChange={(e) => setNewRecord({ ...newRecord, reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Nhập lý do..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddRecord}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Cấu hình Thưởng/Phạt</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-5 space-y-6">
              {/* Existing Configs */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Cấu hình hiện tại</h4>
                {configs.length === 0 ? (
                  <p className="text-gray-400 text-sm">Chưa có cấu hình nào</p>
                ) : (
                  <div className="space-y-2">
                    {configs.map(config => (
                      <div key={config.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-800">{config.name}</p>
                          <p className="text-xs text-gray-500">
                            {config.type === 'renewal_bonus' 
                              ? `Thưởng: ${config.bonusType === 'fixed' ? formatCurrency(config.bonusAmount || 0) : `${config.bonusAmount}%`}`
                              : `Phạt: ${formatCurrency(config.penaltyPerMinute || 0)}/phút`
                            }
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${config.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {config.active ? 'Đang dùng' : 'Tắt'}
                          </span>
                          <button
                            onClick={() => config.id && handleDeleteConfig(config.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr />

              {/* Add New Config */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Thêm cấu hình mới</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại cấu hình</label>
                    <select
                      value={newConfig.type}
                      onChange={(e) => setNewConfig({ ...newConfig, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="renewal_bonus">Thưởng gia hạn</option>
                      <option value="late_penalty">Phạt đi muộn</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên cấu hình</label>
                    <input
                      type="text"
                      value={newConfig.name}
                      onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="VD: Thưởng gia hạn 2025"
                    />
                  </div>

                  {newConfig.type === 'renewal_bonus' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu thưởng</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewConfig({ ...newConfig, bonusType: 'fixed' })}
                            className={`flex-1 py-2 rounded-lg text-sm ${newConfig.bonusType === 'fixed' ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-gray-100'}`}
                          >
                            Số tiền cố định
                          </button>
                          <button
                            onClick={() => setNewConfig({ ...newConfig, bonusType: 'percentage' })}
                            className={`flex-1 py-2 rounded-lg text-sm ${newConfig.bonusType === 'percentage' ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-gray-100'}`}
                          >
                            % giá trị HĐ
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {newConfig.bonusType === 'fixed' ? 'Số tiền (VNĐ)' : 'Phần trăm (%)'}
                        </label>
                        <input
                          type="number"
                          value={newConfig.bonusAmount}
                          onChange={(e) => setNewConfig({ ...newConfig, bonusAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Áp dụng cho</label>
                        <select
                          value={newConfig.applyTo}
                          onChange={(e) => setNewConfig({ ...newConfig, applyTo: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="both">Cả GVCN và Trợ giảng</option>
                          <option value="gvcn">Chỉ GVCN (Việt Nam)</option>
                          <option value="assistant">Chỉ Trợ giảng</option>
                        </select>
                      </div>
                    </>
                  )}

                  {newConfig.type === 'late_penalty' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền phạt mỗi phút (VNĐ)</label>
                        <input
                          type="number"
                          value={newConfig.penaltyPerMinute}
                          onChange={(e) => setNewConfig({ ...newConfig, penaltyPerMinute: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="5000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số phút được miễn (Grace period)</label>
                        <input
                          type="number"
                          value={newConfig.graceMinutes}
                          onChange={(e) => setNewConfig({ ...newConfig, graceMinutes: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="5"
                        />
                        <p className="text-xs text-gray-500 mt-1">Muộn trong khoảng này sẽ không bị phạt</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mức phạt tối đa/ngày (VNĐ)</label>
                        <input
                          type="number"
                          value={newConfig.maxPenalty}
                          onChange={(e) => setNewConfig({ ...newConfig, maxPenalty: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="200000"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="configActive"
                      checked={newConfig.active}
                      onChange={(e) => setNewConfig({ ...newConfig, active: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="configActive" className="text-sm text-gray-700">Kích hoạt ngay</label>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
