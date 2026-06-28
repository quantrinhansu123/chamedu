import { supabase } from '../config/supabase';

const CAMPAIGNS_SETTING_ID = 'campaigns';

export interface Campaign {
  id?: string;
  name: string;
  description?: string;
  campaignDetails?: CampaignDetail[];
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  targetCount: number;
  registeredCount: number;
  conversionRate?: number;
  scriptUrl?: string;
  assignedTo?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CampaignDetail {
  action: string;
  detail: string;
}

export type CampaignStatus = 'Đang mở' | 'Tạm dừng' | 'Kết thúc';

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeCampaign = (campaign: Campaign): Campaign => ({
  ...campaign,
  id: campaign.id || newId(),
  name: campaign.name || '',
  description: campaign.description || '',
  campaignDetails: Array.isArray(campaign.campaignDetails)
    ? campaign.campaignDetails.map((item) => ({
        action: item.action || '',
        detail: item.detail || '',
      }))
    : [],
  startDate: campaign.startDate || '',
  endDate: campaign.endDate || '',
  status: campaign.status || 'Đang mở',
  targetCount: Number(campaign.targetCount) || 0,
  registeredCount: Number(campaign.registeredCount) || 0,
  assignedTo: campaign.assignedTo || [],
});

const loadCampaigns = async (): Promise<Campaign[]> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', CAMPAIGNS_SETTING_ID)
    .maybeSingle();

  if (error) {
    console.error('Error loading campaigns:', error);
    throw new Error(error.message || 'Không thể tải chiến dịch');
  }

  const value = data?.value as { items?: unknown } | unknown[] | null;
  const items = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : [];

  return (items as Campaign[])
    .map(normalizeCampaign)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

const saveCampaigns = async (campaigns: Campaign[]): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({
    id: CAMPAIGNS_SETTING_ID,
    value: { items: campaigns },
  });

  if (error) {
    console.error('Error saving campaigns:', error);
    throw new Error(error.message || 'Không thể lưu chiến dịch');
  }
};

export const getCampaigns = async (includeEnded = false): Promise<Campaign[]> => {
  const campaigns = await loadCampaigns();
  return includeEnded
    ? campaigns
    : campaigns.filter((campaign) => campaign.status !== 'Kết thúc');
};

export const createCampaign = async (data: Omit<Campaign, 'id'>): Promise<string> => {
  const campaigns = await loadCampaigns();
  const now = new Date().toISOString();
  const campaign = normalizeCampaign({
    ...data,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  });

  await saveCampaigns([campaign, ...campaigns]);
  return campaign.id as string;
};

export const updateCampaign = async (id: string, data: Partial<Campaign>): Promise<void> => {
  const campaigns = await loadCampaigns();
  await saveCampaigns(
    campaigns.map((campaign) =>
      campaign.id === id
        ? normalizeCampaign({
            ...campaign,
            ...data,
            id,
            updatedAt: new Date().toISOString(),
          })
        : campaign
    )
  );
};

export const deleteCampaign = async (id: string): Promise<void> => {
  const campaigns = await loadCampaigns();
  await saveCampaigns(campaigns.filter((campaign) => campaign.id !== id));
};

export const incrementRegistered = async (id: string): Promise<void> => {
  const campaigns = await loadCampaigns();
  await saveCampaigns(
    campaigns.map((campaign) =>
      campaign.id === id
        ? {
            ...campaign,
            registeredCount: campaign.registeredCount + 1,
            updatedAt: new Date().toISOString(),
          }
        : campaign
    )
  );
};
