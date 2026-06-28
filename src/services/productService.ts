import { supabase } from '../config/supabase';

const PRODUCTS_SETTING_ID = 'products';
const DISCOUNTS_SETTING_ID = 'discounts';

export interface Product {
  id?: string;
  name: string;
  code?: string;
  category: ProductCategory;
  price: number;
  stock: number;
  branchStock?: Record<string, number>;
  minStock?: number;
  description?: string;
  status: ProductStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Discount {
  id?: string;
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  status: DiscountStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductStatus = 'Kích hoạt' | 'Tạm khoá' | 'Ngừng bán';
export type ProductCategory = 'Sách' | 'Học liệu' | 'Đồng phục' | 'Khác';
export type DiscountStatus = 'Kích hoạt' | 'Tạm dừng';

type ProductSettings = {
  items?: Product[];
};

type DiscountSettings = {
  items?: Discount[];
};

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeProduct = (product: Product): Product => ({
  ...product,
  id: product.id || newId(),
  name: product.name || '',
  category: product.category || 'Khác',
  price: Number(product.price) || 0,
  stock: Number(product.stock) || 0,
  status: product.status || 'Kích hoạt',
});

const normalizeDiscount = (discount: Discount): Discount => ({
  ...discount,
  id: discount.id || newId(),
  name: discount.name || '',
  type: discount.type || 'percent',
  value: Number(discount.value) || 0,
  status: discount.status || 'Kích hoạt',
});

const getSettingItems = async <T,>(settingId: string): Promise<T[]> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', settingId)
    .maybeSingle();

  if (error) {
    console.error(`Error loading ${settingId}:`, error);
    throw new Error(error.message || `Không thể tải ${settingId}`);
  }

  const value = data?.value as { items?: unknown } | unknown[] | null;
  if (Array.isArray(value)) return value as T[];
  return Array.isArray(value?.items) ? (value.items as T[]) : [];
};

const saveSettingItems = async <T,>(settingId: string, items: T[]): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({
    id: settingId,
    value: { items },
  });

  if (error) {
    console.error(`Error saving ${settingId}:`, error);
    throw new Error(error.message || `Không thể lưu ${settingId}`);
  }
};

export const getProducts = async (): Promise<Product[]> => {
  const items = await getSettingItems<ProductSettings['items'][number]>(PRODUCTS_SETTING_ID);
  return items.map(normalizeProduct).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

export const createProduct = async (data: Omit<Product, 'id'>): Promise<string> => {
  const products = await getProducts();
  const now = new Date().toISOString();
  const product = normalizeProduct({
    ...data,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  });

  await saveSettingItems(PRODUCTS_SETTING_ID, [product, ...products]);
  return product.id as string;
};

export const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
  const products = await getProducts();
  await saveSettingItems(
    PRODUCTS_SETTING_ID,
    products.map((product) =>
      product.id === id
        ? normalizeProduct({ ...product, ...data, id, updatedAt: new Date().toISOString() })
        : product
    )
  );
};

export const updateStock = async (
  id: string,
  quantity: number,
  type: 'add' | 'subtract'
): Promise<void> => {
  const products = await getProducts();
  await saveSettingItems(
    PRODUCTS_SETTING_ID,
    products.map((product) => {
      if (product.id !== id) return product;
      const nextStock =
        type === 'add'
          ? (Number(product.stock) || 0) + quantity
          : Math.max(0, (Number(product.stock) || 0) - quantity);
      return normalizeProduct({ ...product, stock: nextStock, updatedAt: new Date().toISOString() });
    })
  );
};

export const deleteProduct = async (id: string): Promise<void> => {
  const products = await getProducts();
  await saveSettingItems(
    PRODUCTS_SETTING_ID,
    products.filter((product) => product.id !== id)
  );
};

export const subscribeToProducts = (
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  let active = true;

  const load = async () => {
    try {
      const products = await getProducts();
      if (active) onData(products);
    } catch (error: any) {
      if (active) onError?.(error);
    }
  };

  load();
  const timer = window.setInterval(load, 15000);
  return () => {
    active = false;
    window.clearInterval(timer);
  };
};

export const getDiscounts = async (): Promise<Discount[]> => {
  const items = await getSettingItems<DiscountSettings['items'][number]>(DISCOUNTS_SETTING_ID);
  return items.map(normalizeDiscount).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

export const createDiscount = async (data: Omit<Discount, 'id'>): Promise<string> => {
  const discounts = await getDiscounts();
  const now = new Date().toISOString();
  const discount = normalizeDiscount({
    ...data,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  });

  await saveSettingItems(DISCOUNTS_SETTING_ID, [discount, ...discounts]);
  return discount.id as string;
};

export const updateDiscount = async (id: string, data: Partial<Discount>): Promise<void> => {
  const discounts = await getDiscounts();
  await saveSettingItems(
    DISCOUNTS_SETTING_ID,
    discounts.map((discount) =>
      discount.id === id
        ? normalizeDiscount({ ...discount, ...data, id, updatedAt: new Date().toISOString() })
        : discount
    )
  );
};

export const deleteDiscount = async (id: string): Promise<void> => {
  const discounts = await getDiscounts();
  await saveSettingItems(
    DISCOUNTS_SETTING_ID,
    discounts.filter((discount) => discount.id !== id)
  );
};
