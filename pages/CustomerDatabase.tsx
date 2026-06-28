/**
 * Customer Database Page
 * Kho dữ liệu khách hàng tiềm năng (Leads)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Phone, Mail, Calendar, Tag, X, Trash2, UserCheck, Filter, Edit2, Target, UserPlus, FileText, Settings, Palette } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useLeads } from '../src/hooks/useLeads';
import { useCampaigns } from '../src/hooks/useCampaigns';
import { useStaff } from '../src/hooks/useStaff';
import { Lead, LeadStatus, LeadSource } from '../src/services/leadService';
import { Campaign } from '../src/services/campaignService';
import { Staff } from '../types';
// Default status colors
const DEFAULT_STATUS_COLORS: Record<string, string> = {
  'Mới': 'bg-blue-100 text-blue-700',
  'Đang liên hệ': 'bg-yellow-100 text-yellow-700',
  'Quan tâm': 'bg-purple-100 text-purple-700',
  'Hẹn test': 'bg-orange-100 text-orange-700',
  'Đã test': 'bg-cyan-100 text-cyan-700',
  'Đăng ký': 'bg-green-100 text-green-700',
  'Từ chối': 'bg-red-100 text-red-700',
};

// Available colors for custom statuses
const AVAILABLE_COLORS = [
  { name: 'Xanh dương', value: 'bg-blue-100 text-blue-700' },
  { name: 'Vàng', value: 'bg-yellow-100 text-yellow-700' },
  { name: 'Tím', value: 'bg-purple-100 text-purple-700' },
  { name: 'Cam', value: 'bg-orange-100 text-orange-700' },
  { name: 'Xanh ngọc', value: 'bg-cyan-100 text-cyan-700' },
  { name: 'Xanh lá', value: 'bg-green-100 text-green-700' },
  { name: 'Đỏ', value: 'bg-red-100 text-red-700' },
  { name: 'Hồng', value: 'bg-pink-100 text-pink-700' },
  { name: 'Xám', value: 'bg-gray-100 text-gray-700' },
];

const SOURCE_OPTIONS: LeadSource[] = ['Facebook', 'Zalo', 'Website', 'Giới thiệu', 'Walk-in', 'Khác'];
const DEFAULT_STATUS_OPTIONS: string[] = ['Mới', 'Đang liên hệ', 'Quan tâm', 'Hẹn test', 'Đã test', 'Đăng ký', 'Từ chối'];

// Status config interface
interface StatusConfig {
  name: string;
  color: string;
}

export const CustomerDatabase: React.FC = () => {
  const navigate = useNavigate();
  const { leads, loading, error, createLead, updateLead, updateStatus, deleteLead } = useLeads();
  const { campaigns } = useCampaigns(false); // Only active campaigns
  const { staff } = useStaff();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Status configuration
  const [showStatusConfigModal, setShowStatusConfigModal] = useState(false);
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>([]);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(AVAILABLE_COLORS[0].value);

  // Load status config from Firestore
  useEffect(() => {
    const loadStatusConfig = async () => {
      try {
        const docRef = doc(null as any /* firebase removed */, 'settings', 'leadStatusConfig');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStatusConfigs(docSnap.data().statuses || []);
        } else {
          // Initialize with default statuses
          const defaultConfigs = DEFAULT_STATUS_OPTIONS.map(name => ({
            name,
            color: DEFAULT_STATUS_COLORS[name] || AVAILABLE_COLORS[0].value
          }));
          setStatusConfigs(defaultConfigs);
        }
      } catch (err) {
        console.error('Error loading status config:', err);
        // Fallback to defaults
        const defaultConfigs = DEFAULT_STATUS_OPTIONS.map(name => ({
          name,
          color: DEFAULT_STATUS_COLORS[name] || AVAILABLE_COLORS[0].value
        }));
        setStatusConfigs(defaultConfigs);
      }
    };
    loadStatusConfig();
  }, []);

  // Get status options from config
  const STATUS_OPTIONS = statusConfigs.map(s => s.name);
  const STATUS_COLORS: Record<string, string> = statusConfigs.reduce((acc, s) => {
    acc[s.name] = s.color;
    return acc;
  }, {} as Record<string, string>);

  // Save status config
  const saveStatusConfig = async (configs: StatusConfig[]) => {
    try {
      await setDoc(doc(null as any /* firebase removed */, 'settings', 'leadStatusConfig'), { statuses: configs });
      setStatusConfigs(configs);
    } catch (err) {
      console.error('Error saving status config:', err);
      alert('Không thể lưu cấu hình');
    }
  };

  // Add new status
  const handleAddStatus = async () => {
    if (!newStatusName.trim()) {
      alert('Vui lòng nhập tên trạng thái');
      return;
    }
    if (statusConfigs.some(s => s.name === newStatusName.trim())) {
      alert('Trạng thái này đã tồn tại');
      return;
    }
    const newConfigs = [...statusConfigs, { name: newStatusName.trim(), color: newStatusColor }];
    await saveStatusConfig(newConfigs);
    setNewStatusName('');
    setNewStatusColor(AVAILABLE_COLORS[0].value);
  };

  // Delete status
  const handleDeleteStatus = async (name: string) => {
    if (!confirm(`Xóa trạng thái "${name}"? Các lead có trạng thái này sẽ không bị ảnh hưởng.`)) return;
    const newConfigs = statusConfigs.filter(s => s.name !== name);
    await saveStatusConfig(newConfigs);
  };

  // Update status color
  const handleUpdateStatusColor = async (name: string, color: string) => {
    const newConfigs = statusConfigs.map(s => s.name === name ? { ...s, color } : s);
    await saveStatusConfig(newConfigs);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa khách hàng này?')) return;
    try {
      await deleteLead(id);
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    try {
      await updateStatus(id, status);
    } catch (err) {
      alert('Không thể cập nhật');
    }
  };

  // Convert lead to trial student
  const handleConvertToTrialStudent = (lead: Lead) => {
    // Navigate to Trial Students page with lead data pre-filled
    navigate('/customers/trial', { 
      state: { 
        prefillData: {
          fullName: lead.childName || lead.name,
          parentName: lead.name,
          phone: lead.phone,
          source: lead.source,
          note: lead.note
        }
      }
    });
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const searchedLeads = useMemo(() => {
    if (!normalizedSearchTerm) return leads;

    return leads.filter(l =>
      l.name.toLowerCase().includes(normalizedSearchTerm) ||
      l.phone.includes(normalizedSearchTerm) ||
      (l.childName && l.childName.toLowerCase().includes(normalizedSearchTerm))
    );
  }, [leads, normalizedSearchTerm]);

  const leadsForStatusCounts = useMemo(() => {
    if (!sourceFilter) return searchedLeads;
    return searchedLeads.filter(l => l.source === sourceFilter);
  }, [searchedLeads, sourceFilter]);

  const leadsForSourceCounts = useMemo(() => {
    if (!statusFilter) return searchedLeads;
    return searchedLeads.filter(l => l.status === statusFilter);
  }, [searchedLeads, statusFilter]);

  const filteredLeads = useMemo(() => {
    if (!statusFilter) return leadsForStatusCounts;
    return leadsForStatusCounts.filter(l => l.status === statusFilter);
  }, [leadsForStatusCounts, statusFilter]);

  const statusCounts = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = leadsForStatusCounts.filter(l => l.status === status).length;
      return acc;
    }, {} as Record<string, number>);
  }, [STATUS_OPTIONS, leadsForStatusCounts]);

  const sourceCounts = useMemo(() => {
    return SOURCE_OPTIONS.reduce((acc, source) => {
      acc[source] = leadsForSourceCounts.filter(l => l.source === source).length;
      return acc;
    }, {} as Record<string, number>);
  }, [leadsForSourceCounts]);

  const totalLeads = leads.length;
  const filteredTotalLeads = filteredLeads.length;
  const convertedFilteredLeads = filteredLeads.filter(l => l.status === 'Đăng ký').length;
  const conversionRate = filteredTotalLeads > 0 ? ((convertedFilteredLeads / filteredTotalLeads) * 100).toFixed(1) : '0';
  const hasActiveFilters = Boolean(normalizedSearchTerm || statusFilter || sourceFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Users className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Kho dữ liệu khách hàng</h2>
              <p className="text-sm text-gray-500">Quản lý khách hàng tiềm năng</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStatusConfigModal(true)}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
              title="Cấu hình trạng thái"
            >
              <Settings size={16} /> Cấu hình
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus size={16} /> Thêm khách hàng
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mt-4">
          {STATUS_OPTIONS.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={`p-2 rounded-lg text-center transition-all ${
                statusFilter === status ? 'ring-2 ring-indigo-500' : ''
              } ${STATUS_COLORS[status]}`}
            >
              <div className="text-xl font-bold">{statusCounts[status] || 0}</div>
              <div className="text-xs">{status}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, tên con..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả nguồn</option>
            {SOURCE_OPTIONS.map(s => (
              <option key={s} value={s}>{s} ({sourceCounts[s] || 0})</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setSourceFilter(''); }}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              <X size={14} /> Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-xl text-white flex justify-between items-center">
        <div>
          <span className="text-2xl font-bold">{filteredTotalLeads}</span>
          <span className="ml-2 text-indigo-100">
            {hasActiveFilters ? `khách hàng phù hợp / ${totalLeads} tổng` : 'khách hàng'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm text-indigo-100">Tỷ lệ chuyển đổi:</span>
          <span className="ml-2 text-2xl font-bold">{conversionRate}%</span>
        </div>
      </div>

      {/* Lead List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
              <tr>
                <th className="px-4 py-3">Phụ huynh</th>
                <th className="px-4 py-3">Con</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Chiến dịch</th>
                <th className="px-4 py-3">Người phụ trách</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Ghi chú</th>
                <th className="px-4 py-3 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-red-500">Lỗi: {error}</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <Users size={48} className="mx-auto mb-2 opacity-20" />
                    Chưa có khách hàng nào
                  </td>
                </tr>
              ) : filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <Phone size={12} /> {lead.phone}
                    </div>
                    {lead.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Mail size={12} /> {lead.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.childName ? (
                      <div>
                        <div className="font-medium">{lead.childName}</div>
                        {lead.childAge && <div className="text-xs text-gray-500">{lead.childAge} tuổi</div>}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      <Tag size={12} />
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(lead.campaignNames?.length || lead.campaignName) ? (
                      <div className="flex flex-wrap gap-1">
                        {(lead.campaignNames?.length ? lead.campaignNames : [lead.campaignName]).map((name, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                            <Target size={10} />
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.assignedToName || <span className="text-gray-400">Chưa phân công</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={lead.status}
                      onChange={(e) => lead.id && handleStatusChange(lead.id, e.target.value as LeadStatus)}
                      className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-500">
                    {lead.note || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleConvertToTrialStudent(lead)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Chuyển HV học thử"
                      >
                        <UserPlus size={15} />
                      </button>

                      <button
                        onClick={() => {
                          setEditingLead(lead);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Sửa"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => lead.id && handleDelete(lead.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <LeadModal
          campaigns={campaigns}
          staff={staff}
          statusOptions={STATUS_OPTIONS}
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            try {
              await createLead(data);
              setShowModal(false);
            } catch (err: any) {
              alert('Lỗi: ' + (err.message || 'Không thể lưu khách hàng'));
            }
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingLead && (
        <LeadModal
          lead={editingLead}
          campaigns={campaigns}
          staff={staff}
          statusOptions={STATUS_OPTIONS}
          onClose={() => {
            setShowEditModal(false);
            setEditingLead(null);
          }}
          onSubmit={async (data) => {
            if (editingLead.id) {
              try {
                await updateLead(editingLead.id, data);
                setShowEditModal(false);
                setEditingLead(null);
              } catch (err: any) {
                alert('Lỗi: ' + (err.message || 'Không thể cập nhật khách hàng'));
              }
            }
          }}
        />
      )}

      {/* Status Config Modal */}
      {showStatusConfigModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-slate-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Cấu hình trạng thái</h3>
                <p className="text-sm text-gray-500">Thêm, sửa, xóa trạng thái khách hàng</p>
              </div>
              <button onClick={() => setShowStatusConfigModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
              {/* Current statuses */}
              <div className="space-y-2">
                {statusConfigs.map((status, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded text-xs font-medium ${status.color}`}>
                        {status.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={status.color}
                        onChange={(e) => handleUpdateStatusColor(status.name, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        {AVAILABLE_COLORS.map(c => (
                          <option key={c.value} value={c.value}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDeleteStatus(status.name)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new status */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Thêm trạng thái mới</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStatusName}
                    onChange={(e) => setNewStatusName(e.target.value)}
                    placeholder="Tên trạng thái..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={newStatusColor}
                    onChange={(e) => setNewStatusColor(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {AVAILABLE_COLORS.map(c => (
                      <option key={c.value} value={c.value}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddStatus}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                  >
                    Thêm
                  </button>
                </div>
                {newStatusName && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Xem trước: </span>
                    <span className={`px-3 py-1 rounded text-xs font-medium ${newStatusColor}`}>
                      {newStatusName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowStatusConfigModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}    </div>
  );
};

// Lead Modal
interface LeadModalProps {
  lead?: Lead;
  campaigns: Campaign[];
  staff: Staff[];
  statusOptions: string[];
  onClose: () => void;
  onSubmit: (data: Omit<Lead, 'id'>) => Promise<void>;
}

const LeadModal: React.FC<LeadModalProps> = ({ lead, campaigns, staff, statusOptions, onClose, onSubmit }) => {
  const campaignNameById = useMemo(
    () => new Map(campaigns.filter((campaign) => campaign.id).map((campaign) => [campaign.id as string, campaign.name])),
    [campaigns]
  );
  const selectableCampaigns = useMemo(
    () => campaigns.filter((campaign) => Boolean(campaign.id)),
    [campaigns]
  );
  const initialCampaignIds = lead?.campaignIds?.length ? lead.campaignIds : (lead?.campaignId ? [lead.campaignId] : []);
  const initialCampaignNames = lead?.campaignNames?.length
    ? lead.campaignNames
    : lead?.campaignName
      ? [lead.campaignName]
      : initialCampaignIds.map((id) => campaignNameById.get(id)).filter((name): name is string => Boolean(name));

  const [formData, setFormData] = useState({
    name: lead?.name || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    childName: lead?.childName || '',
    childAge: lead?.childAge || '',
    source: lead?.source || 'Facebook' as LeadSource,
    status: lead?.status || 'Mới' as LeadStatus,
    note: lead?.note || '',
    // Support multiple campaigns
    campaignIds: initialCampaignIds,
    campaignNames: initialCampaignNames,
    assignedTo: lead?.assignedTo || '',
    assignedToName: lead?.assignedToName || '',
  });
  const [loading, setLoading] = useState(false);

  const toggleCampaign = (campaign: Campaign, checked: boolean) => {
    if (!campaign.id) return;

    setFormData((prev) => {
      const campaignIds = checked
        ? Array.from(new Set([...prev.campaignIds, campaign.id as string]))
        : prev.campaignIds.filter((id) => id !== campaign.id);
      const campaignNames = checked
        ? Array.from(new Set([...prev.campaignNames, campaign.name]))
        : prev.campaignNames.filter((name) => name !== campaign.name);

      return {
        ...prev,
        campaignIds,
        campaignNames,
      };
    });
  };

  const selectAllCampaigns = () => {
    setFormData((prev) => ({
      ...prev,
      campaignIds: selectableCampaigns.map((campaign) => campaign.id as string),
      campaignNames: selectableCampaigns.map((campaign) => campaign.name),
    }));
  };

  const clearCampaigns = () => {
    setFormData((prev) => ({
      ...prev,
      campaignIds: [],
      campaignNames: [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert('Vui lòng điền tên và số điện thoại');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        childAge: formData.childAge ? parseInt(formData.childAge.toString()) : undefined,
        campaignId: formData.campaignIds[0] || undefined,
        campaignName: formData.campaignNames[0] || undefined,
      });
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
            {lead ? 'Sửa khách hàng' : 'Thêm khách hàng'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên phụ huynh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="0901234567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên con</label>
              <input
                type="text"
                value={formData.childName}
                onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Bé An"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tuổi con</label>
              <input
                type="number"
                min={1}
                max={18}
                value={formData.childAge}
                onChange={(e) => setFormData({ ...formData, childAge: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nguồn</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {SOURCE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Campaign - Multiple Select */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                <Target size={14} className="text-orange-500" />
                Chiến dịch
              </label>
              {selectableCampaigns.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={selectAllCampaigns} className="text-indigo-600 hover:underline">
                    Chọn tất cả
                  </button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={clearCampaigns} className="text-gray-500 hover:underline">
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>
            <div className="border border-gray-300 rounded-lg p-2 max-h-44 overflow-y-auto space-y-1">
              {selectableCampaigns.length === 0 ? (
                <p className="text-sm text-gray-400">Chưa có chiến dịch khả dụng</p>
              ) : (
                selectableCampaigns.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={formData.campaignIds.includes(c.id || '')}
                      onChange={(e) => toggleCampaign(c, e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-sm flex-1">{c.name}</span>
                    <span className="text-[10px] text-gray-400">{c.status}</span>
                  </label>
                ))
              )}
            </div>
            {formData.campaignIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.campaignNames.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                    <Target size={10} />
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <UserCheck size={14} className="text-blue-500" />
              Người phụ trách
            </label>
            <select
              value={formData.assignedTo}
              onChange={(e) => {
                const selectedStaff = staff.find(s => s.id === e.target.value);
                setFormData({ 
                  ...formData, 
                  assignedTo: e.target.value,
                  assignedToName: selectedStaff?.name || ''
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Chọn người phụ trách --</option>
              {staff.filter(s => s.status === 'Active').map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
