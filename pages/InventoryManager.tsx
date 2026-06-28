import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, Timestamp, db } from '@/src/utils/legacyFirestoreStub';
import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, ArrowLeftRight, X, AlertTriangle, Building2, Minus, History } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useProducts } from '../src/hooks/useProducts';
import { useAuth } from '../src/hooks/useAuth';
import { InventoryTransfer } from '../types';
import { Product } from '../src/services/productService';
import { getCenters } from '../src/services/centerService';
export const InventoryManager: React.FC = () => {
  const { products, loading, updateStock, updateProduct } = useProducts();
  const { staffData } = useAuth();
  
  // Centers state
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);
  
  // State
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addBranch, setAddBranch] = useState('');
  const [stockMode, setStockMode] = useState<'add' | 'subtract'>('add');
  
  // Transfer state
  const [transferFromBranch, setTransferFromBranch] = useState('');
  const [transferToBranch, setTransferToBranch] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferNote, setTransferNote] = useState('');
  
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const data = await getCenters();
        const centers = data
          .filter((c) => c.status === 'Active')
          .map((c) => ({ id: c.name, name: c.name }));
        setCenterList(centers);
        if (centers.length > 0) {
          setAddBranch(centers[0].id);
          setTransferFromBranch(centers[0].id);
          if (centers.length > 1) {
            setTransferToBranch(centers[1].id);
          }
        }
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);
  
  // Build BRANCHES array dynamically
  const BRANCHES = useMemo(() => {
    return [
      { id: 'all', name: 'Tất cả cơ sở' },
      ...centerList
    ];
  }, [centerList]);
  
  // Transfer history
  const [transferHistory, setTransferHistory] = useState<InventoryTransfer[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Get branch stock for a product
  const getBranchStock = (product: Product, branchId: string): number => {
    if (branchId === 'all') {
      // Sum all branches
      if (product.branchStock) {
        return (Object.values(product.branchStock) as number[]).reduce((sum, qty) => sum + qty, 0);
      }
      return product.stock || 0;
    }
    return product.branchStock?.[branchId] || 0;
  };

  // Filtered products based on branch
  const filteredProducts = useMemo(() => {
    return products.map(p => ({
      ...p,
      displayStock: getBranchStock(p, selectedBranch)
    }));
  }, [products, selectedBranch]);

  // Handle add/subtract stock
  const handleUpdateStock = async () => {
    if (!selectedProduct?.id || addQuantity <= 0) return;
    
    try {
      const currentBranchStock: Record<string, number> = selectedProduct.branchStock || {};
      const currentQty = currentBranchStock[addBranch] || 0;
      
      const newQty = stockMode === 'add' 
        ? currentQty + addQuantity 
        : Math.max(0, currentQty - addQuantity);
      
      const newBranchStock = {
        ...currentBranchStock,
        [addBranch]: newQty
      };
      
      // Calculate total stock
      const totalStock = Object.values(newBranchStock as Record<string, number>).reduce((sum: number, qty: number) => sum + qty, 0);
      
      await updateProduct(selectedProduct.id, {
        branchStock: newBranchStock,
        stock: totalStock
      });
      
      setShowAddStockModal(false);
      setSelectedProduct(null);
      setAddQuantity(1);
    } catch (err) {
      alert('Không thể cập nhật tồn kho');
    }
  };

  // Handle transfer between branches
  const handleTransfer = async () => {
    if (!selectedProduct?.id || transferQuantity <= 0) return;
    if (transferFromBranch === transferToBranch) {
      alert('Cơ sở xuất và nhập phải khác nhau');
      return;
    }

    const currentBranchStock = selectedProduct.branchStock || {};
    const fromQty = currentBranchStock[transferFromBranch] || 0;

    if (transferQuantity > fromQty) {
      alert(`Không đủ hàng để chuyển. Cơ sở hiện có: ${fromQty}`);
      return;
    }

    try {
      // Update branch stock
      const newBranchStock = {
        ...currentBranchStock,
        [transferFromBranch]: fromQty - transferQuantity,
        [transferToBranch]: (currentBranchStock[transferToBranch] || 0) + transferQuantity
      };

      const totalStock = Object.values(newBranchStock as Record<string, number>).reduce((sum: number, qty: number) => sum + qty, 0);

      await updateProduct(selectedProduct.id, {
        branchStock: newBranchStock,
        stock: totalStock
      });

      // Log transfer history (non-blocking, don't fail the transfer if this fails)
      try {
        await addDoc(collection(null as any /* firebase removed */, 'inventoryTransfers'), {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          fromBranch: transferFromBranch,
          toBranch: transferToBranch,
          quantity: transferQuantity,
          transferDate: new Date().toISOString().split('T')[0],
          note: transferNote,
          createdBy: staffData?.name || 'Admin',
          createdAt: Timestamp.now()
        });
      } catch (historyErr) {
        console.error('Failed to log transfer history:', historyErr);
        // Continue - transfer was successful, just logging failed
      }

      setShowTransferModal(false);
      setSelectedProduct(null);
      setTransferQuantity(1);
      setTransferNote('');
      alert('Chuyển kho thành công!');
    } catch (err) {
      console.error('Transfer error:', err);
      alert('Không thể chuyển kho');
    }
  };

  // Load transfer history
  const loadTransferHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(collection(null as any /* firebase removed */, 'inventoryTransfers'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryTransfer[];
      setTransferHistory(history);
    } catch (err) {
      console.error('Error loading history:', err);
    }
    setLoadingHistory(false);
  };

  const openAddStockModal = (product: Product) => {
    setSelectedProduct(product);
    setAddQuantity(1);
    setStockMode('add');
    setShowAddStockModal(true);
  };

  const openTransferModal = (product: Product) => {
    setSelectedProduct(product);
    setTransferQuantity(1);
    setTransferNote('');
    setShowTransferModal(true);
  };

  const openHistoryModal = () => {
    loadTransferHistory();
    setShowHistoryModal(true);
  };

  const getBranchName = (branchId: string) => {
    return BRANCHES.find(b => b.id === branchId)?.name || branchId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800">Quản lý kho</h2>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            {BRANCHES.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={openHistoryModal}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <History size={18} />
          Lịch sử chuyển kho
        </button>
      </div>

      {/* Branch Stock Summary */}
      {selectedBranch === 'all' && (
        <div className="grid grid-cols-3 gap-4">
          {BRANCHES.filter(b => b.id !== 'all').map(branch => (
            <div key={branch.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={18} className="text-indigo-500" />
                <span className="font-medium text-gray-700">{branch.name}</span>
              </div>
              <p className="text-2xl font-bold text-indigo-600">
                {products.reduce((sum, p) => sum + getBranchStock(p, branch.id), 0)}
              </p>
              <p className="text-xs text-gray-500">Tổng sản phẩm</p>
            </div>
          ))}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="px-6 py-4 w-16">STT</th>
              <th className="px-6 py-4">Tên sản phẩm</th>
              {selectedBranch === 'all' ? (
                <>
                  {BRANCHES.filter(b => b.id !== 'all').map(branch => (
                    <th key={branch.id} className="px-4 py-4 text-center">{branch.name.split(' - ')[0]}</th>
                  ))}
                  <th className="px-4 py-4 text-center">Tổng</th>
                </>
              ) : (
                <th className="px-6 py-4">Số lượng</th>
              )}
              <th className="px-6 py-4">Đơn giá</th>
              <th className="px-6 py-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={selectedBranch === 'all' ? 8 : 5} className="text-center py-8 text-gray-500">Đang tải...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={selectedBranch === 'all' ? 8 : 5} className="text-center py-8 text-gray-400">Chưa có sản phẩm nào</td></tr>
            ) : filteredProducts.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">{index + 1}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                {selectedBranch === 'all' ? (
                  <>
                    {BRANCHES.filter(b => b.id !== 'all').map(branch => (
                      <td key={branch.id} className="px-4 py-4 text-center">
                        <span className={`font-medium ${getBranchStock(item, branch.id) === 0 ? 'text-red-600' : getBranchStock(item, branch.id) < 5 ? 'text-orange-600' : 'text-gray-700'}`}>
                          {getBranchStock(item, branch.id)}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-4 text-center font-bold text-indigo-600">
                      {item.displayStock}
                    </td>
                  </>
                ) : (
                  <td className="px-6 py-4">
                    <span className={`font-medium ${item.displayStock === 0 ? 'text-red-600' : item.displayStock < 5 ? 'text-orange-600' : 'text-gray-900'}`}>
                      {item.displayStock}
                      {item.displayStock === 0 && <AlertTriangle size={14} className="inline ml-1" />}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4">{item.price.toLocaleString()} đ</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => openAddStockModal(item)}
                      className="text-green-600 hover:bg-green-50 p-1.5 rounded border border-green-200" 
                      title="Nhập/Xuất kho"
                    >
                      <Plus size={16} />
                    </button>
                    <button 
                      onClick={() => openTransferModal(item)}
                      className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded border border-indigo-200" 
                      title="Chuyển kho"
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <div className="text-xs text-gray-500">Hiển thị {filteredProducts.length} sản phẩm</div>
        </div>
      </div>

      {/* Add/Subtract Stock Modal */}
      {showAddStockModal && selectedProduct && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Nhập/Xuất kho</h3>
              <button onClick={() => setShowAddStockModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sản phẩm</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-800">{selectedProduct.name}</div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setStockMode('add')}
                  className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                    stockMode === 'add' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Plus size={18} /> Nhập kho
                </button>
                <button
                  onClick={() => setStockMode('subtract')}
                  className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                    stockMode === 'subtract' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Minus size={18} /> Xuất kho
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở</label>
                <select
                  value={addBranch}
                  onChange={(e) => setAddBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {BRANCHES.filter(b => b.id !== 'all').map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} (hiện có: {getBranchStock(selectedProduct, branch.id)})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                <input
                  type="number"
                  min={1}
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Sau khi {stockMode === 'add' ? 'nhập' : 'xuất'}: <strong>
                    {stockMode === 'add' 
                      ? getBranchStock(selectedProduct, addBranch) + addQuantity 
                      : Math.max(0, getBranchStock(selectedProduct, addBranch) - addQuantity)
                    }
                  </strong> sản phẩm
                </p>
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowAddStockModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateStock}
                  className={`px-4 py-2 text-white rounded-lg ${
                    stockMode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {stockMode === 'add' ? 'Nhập kho' : 'Xuất kho'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedProduct && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Chuyển kho</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sản phẩm</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-800">{selectedProduct.name}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Từ cơ sở</label>
                  <select
                    value={transferFromBranch}
                    onChange={(e) => setTransferFromBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {BRANCHES.filter(b => b.id !== 'all').map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name.split(' - ')[0]} ({getBranchStock(selectedProduct, branch.id)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đến cơ sở</label>
                  <select
                    value={transferToBranch}
                    onChange={(e) => setTransferToBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {BRANCHES.filter(b => b.id !== 'all').map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name.split(' - ')[0]} ({getBranchStock(selectedProduct, branch.id)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng chuyển</label>
                <input
                  type="number"
                  min={1}
                  max={getBranchStock(selectedProduct, transferFromBranch)}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Lý do chuyển kho..."
                />
              </div>
              
              <div className="p-3 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-800">
                  Sau khi chuyển: <strong>{getBranchName(transferFromBranch).split(' - ')[0]}</strong> còn <strong>{getBranchStock(selectedProduct, transferFromBranch) - transferQuantity}</strong>,
                  <strong> {getBranchName(transferToBranch).split(' - ')[0]}</strong> có <strong>{getBranchStock(selectedProduct, transferToBranch) + transferQuantity}</strong>
                </p>
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleTransfer}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Chuyển kho
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Transfer History Modal */}
      {showHistoryModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Lịch sử chuyển kho</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {loadingHistory ? (
                <div className="text-center py-8 text-gray-500">Đang tải...</div>
              ) : transferHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Chưa có lịch sử chuyển kho</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Ngày</th>
                      <th className="px-4 py-3 text-left">Sản phẩm</th>
                      <th className="px-4 py-3 text-left">Từ</th>
                      <th className="px-4 py-3 text-left">Đến</th>
                      <th className="px-4 py-3 text-center">SL</th>
                      <th className="px-4 py-3 text-left">Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transferHistory.map(transfer => (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{transfer.transferDate}</td>
                        <td className="px-4 py-3 font-medium">{transfer.productName}</td>
                        <td className="px-4 py-3">{getBranchName(transfer.fromBranch).split(' - ')[0]}</td>
                        <td className="px-4 py-3">{getBranchName(transfer.toBranch).split(' - ')[0]}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{transfer.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">{transfer.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
