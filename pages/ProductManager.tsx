import React, { useEffect, useState } from 'react';
import { Edit, Package, Tag, Trash2, X } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useProducts } from '../src/hooks/useProducts';
import {
  createDiscount,
  deleteDiscount,
  Discount,
  Product,
  ProductCategory,
  ProductStatus,
  updateDiscount,
  getDiscounts,
} from '../src/services/productService';

const emptyProduct = {
  name: '',
  price: 0,
  stock: 0,
  category: 'Sách' as ProductCategory,
  status: 'Kích hoạt' as ProductStatus,
};

const emptyDiscount: Omit<Discount, 'id'> = {
  name: '',
  type: 'percent',
  value: 0,
  status: 'Kích hoạt',
};

export const ProductManager: React.FC = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct } = useProducts();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [discountFormData, setDiscountFormData] = useState<Omit<Discount, 'id'>>(emptyDiscount);

  const refreshDiscounts = async () => {
    try {
      setLoadingDiscounts(true);
      setDiscounts(await getDiscounts());
    } catch (err) {
      console.error('Error fetching discounts:', err);
      setDiscounts([]);
    } finally {
      setLoadingDiscounts(false);
    }
  };

  useEffect(() => {
    refreshDiscounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct?.id) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      setShowModal(false);
      setEditingProduct(null);
      setFormData(emptyProduct);
    } catch (err) {
      alert('Lỗi khi lưu sản phẩm');
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      status: product.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa sản phẩm này?')) return;
    try {
      await deleteProduct(id);
    } catch (err) {
      alert('Không thể xóa sản phẩm');
    }
  };

  const handleDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDiscount?.id) {
        await updateDiscount(editingDiscount.id, discountFormData);
      } else {
        await createDiscount(discountFormData);
      }
      await refreshDiscounts();
      setShowDiscountModal(false);
      setEditingDiscount(null);
      setDiscountFormData(emptyDiscount);
    } catch (err) {
      alert('Lỗi khi lưu ưu đãi');
    }
  };

  const openEditDiscountModal = (discount: Discount) => {
    setEditingDiscount(discount);
    setDiscountFormData({
      name: discount.name,
      type: discount.type,
      value: discount.value,
      status: discount.status,
    });
    setShowDiscountModal(true);
  };

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm('Xóa ưu đãi này?')) return;
    try {
      await deleteDiscount(id);
      await refreshDiscounts();
    } catch (err) {
      alert('Không thể xóa ưu đãi');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Kích hoạt':
        return 'bg-green-600';
      case 'Tạm khoá':
      case 'Tạm dừng':
        return 'bg-orange-500';
      case 'Ngừng bán':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatCurrency = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

  const formatDiscountValue = (discount: Discount) =>
    discount.type === 'percent' ? `${discount.value} %` : formatCurrency(discount.value);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Sản phẩm</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingDiscount(null);
              setDiscountFormData(emptyDiscount);
              setShowDiscountModal(true);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600"
          >
            <Tag size={16} /> Thêm ưu đãi
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData(emptyProduct);
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            <Package size={16} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Sản phẩm</div>
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Tên sản phẩm</th>
                <th className="px-4 py-3">Giá tiền</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Đang tải...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Chưa có sản phẩm nào</td></tr>
              ) : products.map((product, index) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-3">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`${getStatusColor(product.status)} text-white text-[10px] px-2 py-0.5 rounded-full font-bold`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEditModal(product)} className="text-gray-400 hover:text-indigo-600 p-1" aria-label="Sửa sản phẩm">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => product.id && handleDelete(product.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Xóa sản phẩm">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <div className="text-xs text-gray-500">Hiển thị {products.length} bản ghi</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Ưu đãi</div>
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Tên ưu đãi</th>
                <th className="px-4 py-3">Giá trị ưu đãi</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingDiscounts ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Đang tải...</td></tr>
              ) : discounts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Chưa có ưu đãi nào</td></tr>
              ) : discounts.map((discount, index) => (
                <tr key={discount.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{discount.name}</td>
                  <td className="px-4 py-3">{formatDiscountValue(discount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`${getStatusColor(discount.status)} text-white text-[10px] px-2 py-0.5 rounded-full font-bold`}>
                      {discount.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEditDiscountModal(discount)} className="text-gray-400 hover:text-indigo-600 p-1" aria-label="Sửa ưu đãi">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => discount.id && handleDeleteDiscount(discount.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Xóa ưu đãi">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <div className="text-xs text-gray-500">Hiển thị {discounts.length} bản ghi</div>
          </div>
        </div>
      </div>

      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">{editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Giá tiền *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Sách">Sách</option>
                      <option value="Học liệu">Học liệu</option>
                      <option value="Đồng phục">Đồng phục</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ProductStatus })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Kích hoạt">Kích hoạt</option>
                      <option value="Tạm khoá">Tạm khoá</option>
                      <option value="Ngừng bán">Ngừng bán</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    {editingProduct ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {showDiscountModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Tag className="text-orange-500" size={20} />
                  {editingDiscount ? 'Sửa ưu đãi' : 'Thêm ưu đãi'}
                </h3>
                <button onClick={() => setShowDiscountModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleDiscountSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên ưu đãi *</label>
                  <input
                    type="text"
                    required
                    value={discountFormData.name}
                    onChange={(e) => setDiscountFormData({ ...discountFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="VD: Giảm 10%, ưu đãi sinh nhật..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại ưu đãi</label>
                    <select
                      value={discountFormData.type}
                      onChange={(e) => setDiscountFormData({ ...discountFormData, type: e.target.value as Discount['type'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="percent">Phần trăm (%)</option>
                      <option value="fixed">Số tiền cố định (đ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giá trị {discountFormData.type === 'percent' ? '(%)' : '(đ)'} *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={discountFormData.type === 'percent' ? 100 : undefined}
                      value={discountFormData.value}
                      onChange={(e) => setDiscountFormData({ ...discountFormData, value: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                    value={discountFormData.status}
                    onChange={(e) => setDiscountFormData({ ...discountFormData, status: e.target.value as Discount['status'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Kích hoạt">Kích hoạt</option>
                    <option value="Tạm dừng">Tạm dừng</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setShowDiscountModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                    {editingDiscount ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
