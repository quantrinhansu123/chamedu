import { useCallback, useEffect, useMemo, useState } from 'react';
import * as productService from '../services/productService';
import { Product, ProductCategory, ProductStatus } from '../services/productService';

interface UseProductsProps {
  status?: ProductStatus;
  category?: ProductCategory;
}

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  createProduct: (data: Omit<Product, 'id'>) => Promise<string>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  updateStock: (id: string, quantity: number, type: 'add' | 'subtract') => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  refreshProducts: () => Promise<void>;
}

export const useProducts = (props?: UseProductsProps): UseProductsReturn => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);
      setAllProducts(await productService.getProducts());
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách sản phẩm');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    const timer = window.setInterval(() => fetchProducts({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [fetchProducts]);

  const products = useMemo(() => {
    let filtered = allProducts;
    if (props?.status) {
      filtered = filtered.filter((product) => product.status === props.status);
    }
    if (props?.category) {
      filtered = filtered.filter((product) => product.category === props.category);
    }
    return filtered;
  }, [allProducts, props?.status, props?.category]);

  const createProduct = async (data: Omit<Product, 'id'>): Promise<string> => {
    const id = await productService.createProduct(data);
    await fetchProducts({ silent: true });
    return id;
  };

  const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
    await productService.updateProduct(id, data);
    await fetchProducts({ silent: true });
  };

  const updateStock = async (id: string, quantity: number, type: 'add' | 'subtract'): Promise<void> => {
    await productService.updateStock(id, quantity, type);
    await fetchProducts({ silent: true });
  };

  const deleteProduct = async (id: string): Promise<void> => {
    await productService.deleteProduct(id);
    await fetchProducts({ silent: true });
  };

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    refreshProducts: () => fetchProducts({ silent: true }),
  };
};
