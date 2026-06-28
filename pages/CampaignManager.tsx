/**
 * Campaign Manager Page
 * Quản lý chiến dịch Sale/Marketing
 */

import React, { useState, useMemo } from 'react';
import { Target, Plus, Calendar, Users, TrendingUp, Edit, Trash2, X, ExternalLink, Pause, Play } from 'lucide-react';
import { useCampaigns } from '../src/hooks/useCampaigns';
import { useLeads } from '../src/hooks/useLeads';
import { Campaign, CampaignStatus } from '../src/services/campaignService';
import { ModalPortal } from '@/components/modal-portal';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  'Đang mở': 'bg-green-100 text-green-700',
  'Tạm dừng': 'bg-yellow-100 text-yellow-700',
  'Kết thúc': 'bg-gray-100 text-gray-700',
};

export const CampaignManager: React.FC = () => {
  const [showEnded, setShowEnded] = useState(false);
  const { campaigns, loading, error, createCampaign, updateCampaign, deleteCampaign } = useCampaigns(showEnded);
  const { leads } = useLeads();
  
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Calculate campaign stats from leads
  const campaignLeadStats = useMemo(() => {
    const stats: Record<string, { targetCount: number; registeredCount: number }> = {};
    
    leads.forEach(lead => {
      // Support multiple campaigns (campaignIds array)
      const leadCampaignIds = lead.campaignIds?.length ? lead.campaignIds : 
        (lead.campaignId ? [lead.campaignId] : []);
      
      leadCampaignIds.forEach(campaignId => {
        if (!stats[campaignId]) {
          stats[campaignId] = { targetCount: 0, registeredCount: 0 };
        }
        stats[campaignId].targetCount++;
        if (lead.status === 'Đăng ký') {
          stats[campaignId].registeredCount++;
        }
      });
    });
    
    return stats;
  }, [leads]);

  // Get stats for a specific campaign
  const getCampaignStats = (campaignId: string) => {
    return campaignLeadStats[campaignId] || { targetCount: 0, registeredCount: 0 };
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa chiến dịch này?')) return;
    try {
      await deleteCampaign(id);
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  const handleStatusToggle = async (campaign: Campaign) => {
    if (!campaign.id) return;
    const newStatus: CampaignStatus = campaign.status === 'Đang mở' ? 'Tạm dừng' : 'Đang mở';
    try {
      await updateCampaign(campaign.id, { status: newStatus });
    } catch (err) {
      alert('Không thể cập nhật');
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm('Kết thúc chiến dịch này?')) return;
    try {
      await updateCampaign(id, { status: 'Kết thúc' });
    } catch (err) {
      alert('Không thể cập nhật');
    }
  };

  // Stats - calculated from leads
  const activeCampaigns = campaigns.filter(c => c.status === 'Đang mở');
  const totalTarget = campaigns.reduce((sum, c) => {
    const stats = getCampaignStats(c.id || '');
    return sum + stats.targetCount;
  }, 0);
  const totalRegistered = campaigns.reduce((sum, c) => {
    const stats = getCampaignStats(c.id || '');
    return sum + stats.registeredCount;
  }, 0);
  const avgConversion = totalTarget > 0 ? ((totalRegistered / totalTarget) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Target className="text-orange-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Chiến dịch Sale/Marketing</h2>
              <p className="text-sm text-gray-500">Quản lý và theo dõi hiệu quả chiến dịch</p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showEnded}
                onChange={(e) => setShowEnded(e.target.checked)}
                className="rounded border-gray-300"
              />
              Hiện đã kết thúc
            </label>
            <button
              onClick={() => { setEditingCampaign(null); setShowModal(true); }}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium"
            >
              <Plus size={16} /> Tạo chiến dịch
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Target size={20} />}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          label="Chiến dịch đang mở"
          value={activeCampaigns.length.toString()}
        />
        <SummaryCard
          icon={<Users size={20} />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          label="Tổng KH tiếp cận"
          value={totalTarget.toString()}
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          label="Đã đăng ký"
          value={totalRegistered.toString()}
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          label="Tỷ lệ chuyển đổi TB"
          value={`${avgConversion}%`}
        />
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-orange-50 text-xs uppercase font-semibold text-gray-600">
              <tr>
                <th className="px-4 py-3">Tên chiến dịch</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-center">Số KH</th>
                <th className="px-4 py-3 text-center">Đã ĐK</th>
                <th className="px-4 py-3 text-center">Tỷ lệ</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-500">Lỗi: {error}</td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Target size={48} className="mx-auto mb-2 opacity-20" />
                    Chưa có chiến dịch nào
                  </td>
                </tr>
              ) : campaigns.map((campaign) => {
                const leadStats = getCampaignStats(campaign.id || '');
                const conversionRate = leadStats.targetCount > 0 
                  ? (leadStats.registeredCount / leadStats.targetCount) * 100 
                  : 0;
                return (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    {campaign.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">{campaign.description}</div>
                    )}
                    {campaign.campaignDetails && campaign.campaignDetails.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {campaign.campaignDetails.slice(0, 2).map((item, index) => (
                          <div key={`${item.action}-${index}`} className="text-xs text-gray-600">
                            <span className="font-semibold text-orange-700">{item.action || 'Hành động'}:</span>{' '}
                            <span>{item.detail || '-'}</span>
                          </div>
                        ))}
                        {campaign.campaignDetails.length > 2 && (
                          <div className="text-xs text-gray-400">+{campaign.campaignDetails.length - 2} chi tiết khác</div>
                        )}
                      </div>
                    )}
                    {campaign.scriptUrl && (
                      <a
                        href={campaign.scriptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink size={12} /> Kịch bản
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar size={12} />
                      {campaign.startDate} - {campaign.endDate}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{leadStats.targetCount}</td>
                  <td className="px-4 py-3 text-center font-bold text-green-600">{leadStats.registeredCount}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                          style={{ width: `${Math.min(100, conversionRate)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{conversionRate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[campaign.status]}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {campaign.status !== 'Kết thúc' && (
                        <>
                          <button
                            onClick={() => handleStatusToggle(campaign)}
                            className="p-1 text-gray-400 hover:text-yellow-600"
                            title={campaign.status === 'Đang mở' ? 'Tạm dừng' : 'Mở lại'}
                          >
                            {campaign.status === 'Đang mở' ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button
                            onClick={() => { setEditingCampaign(campaign); setShowModal(true); }}
                            className="p-1 text-gray-400 hover:text-indigo-600"
                          >
                            <Edit size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => campaign.id && handleDelete(campaign.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <CampaignModal
          campaign={editingCampaign}
          onClose={() => { setShowModal(false); setEditingCampaign(null); }}
          onSubmit={async (data) => {
            if (editingCampaign?.id) {
              await updateCampaign(editingCampaign.id, data);
            } else {
              await createCampaign(data as Omit<Campaign, 'id'>);
            }
            setShowModal(false);
            setEditingCampaign(null);
          }}
        />
      )}
    </div>
  );
};

// Summary Card
interface SummaryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, iconBg, iconColor, label, value }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <div className="flex items-center gap-3">
      <div className={`${iconBg} p-2 rounded-lg ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

// Campaign Modal
interface CampaignModalProps {
  campaign?: Campaign | null;
  onClose: () => void;
  onSubmit: (data: Partial<Campaign>) => Promise<void>;
}

const CampaignModal: React.FC<CampaignModalProps> = ({ campaign, onClose, onSubmit }) => {
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    name: campaign?.name || '',
    description: campaign?.description || '',
    campaignDetails: campaign?.campaignDetails?.length
      ? campaign.campaignDetails
      : [{ action: '', detail: '' }],
    startDate: campaign?.startDate || today,
    endDate: campaign?.endDate || '',
    targetCount: campaign?.targetCount || 0,
    registeredCount: campaign?.registeredCount || 0,
    scriptUrl: campaign?.scriptUrl || '',
    status: campaign?.status || 'Đang mở' as CampaignStatus,
  });
  const [loading, setLoading] = useState(false);

  const updateCampaignDetail = (index: number, field: 'action' | 'detail', value: string) => {
    setFormData((prev) => ({
      ...prev,
      campaignDetails: prev.campaignDetails.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addCampaignDetail = () => {
    setFormData((prev) => ({
      ...prev,
      campaignDetails: [...prev.campaignDetails, { action: '', detail: '' }],
    }));
  };

  const removeCampaignDetail = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      campaignDetails:
        prev.campaignDetails.length === 1
          ? [{ action: '', detail: '' }]
          : prev.campaignDetails.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate || !formData.endDate) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        campaignDetails: formData.campaignDetails
          .map((item) => ({
            action: item.action.trim(),
            detail: item.detail.trim(),
          }))
          .filter((item) => item.action || item.detail),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">
            {campaign ? 'Sửa chiến dịch' : 'Tạo chiến dịch mới'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên chiến dịch <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Chiến dịch tháng 12"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium text-gray-700">Chi tiết chiến dịch</label>
              <button
                type="button"
                onClick={addCampaignDetail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100"
              >
                <Plus size={14} /> Thêm dòng
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left w-1/3">Hành động</th>
                    <th className="px-3 py-2 text-left">Chi tiết</th>
                    <th className="px-2 py-2 w-10" aria-label="Xóa dòng"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formData.campaignDetails.map((item, index) => (
                    <tr key={index}>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          value={item.action}
                          onChange={(e) => updateCampaignDetail(index, 'action', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="VD: Gọi điện"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <textarea
                          value={item.detail}
                          onChange={(e) => updateCampaignDetail(index, 'detail', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="Nội dung, kịch bản, ghi chú triển khai..."
                        />
                      </td>
                      <td className="p-2 align-top">
                        <button
                          type="button"
                          onClick={() => removeCampaignDetail(index)}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="Xóa dòng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày kết thúc <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Info about leads stats */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-700">
              <strong>Lưu ý:</strong> Số KH mục tiêu và Đã đăng ký được tính tự động từ <strong>Kho dữ liệu khách hàng</strong>.
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Vào Kinh doanh → Kho dữ liệu KH → Gán chiến dịch cho từng khách hàng để thống kê.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link kịch bản</label>
            <input
              type="url"
              value={formData.scriptUrl}
              onChange={(e) => setFormData({ ...formData, scriptUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="https://docs.google.com/..."
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
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
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
