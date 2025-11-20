# Hướng dẫn API In/Tải PDF Hợp đồng

## 1. Tạo PDF hợp đồng (Staff)

**API:** `POST /api/contracts/:contractId/pdf`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Tạo file hợp đồng thành công",
  "data": {
    "contractId": "...",
    "contractPdfUrl": "https://res.cloudinary.com/.../contract-CT-xxx.pdf"
  }
}
```

**Lưu ý:** Chỉ staff/admin mới có quyền tạo PDF.

---

## 2. Tải PDF hợp đồng (User/Staff)

**API:** `GET /api/contracts/:contractId/pdf`

**Headers:**
```
Authorization: Bearer {token}
```

**Cách sử dụng:**

### Option 1: Tải xuống trực tiếp (Khuyến nghị)
```javascript
// Khi user click nút "In hợp đồng"
const downloadContractPdf = async (contractId) => {
  const response = await fetch(`/api/contracts/${contractId}/pdf`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Backend sẽ tự động trả về file PDF với headers download
  // Browser sẽ tự động tải xuống file: hop-dong-CT-{contractNumber}.pdf
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hop-dong-${contractId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
```

### Option 2: Mở trong tab mới
```javascript
// Nếu muốn mở PDF trong tab mới thay vì download
window.open(`/api/contracts/${contractId}/pdf`, '_blank');
```

---

## Flow hoàn chỉnh

1. **Kiểm tra PDF đã tồn tại chưa:**
   - Gọi `GET /api/contracts/:contractId` để lấy thông tin contract
   - Kiểm tra field `contractPdfUrl` có tồn tại không

2. **Nếu chưa có PDF:**
   - Staff gọi `POST /api/contracts/:contractId/pdf` để tạo PDF
   - Đợi response thành công

3. **Tải PDF:**
   - Gọi `GET /api/contracts/:contractId/pdf`
   - Browser tự động download file PDF

---

## Ví dụ code React

```jsx
const ContractActions = ({ contractId, isStaff }) => {
  const [loading, setLoading] = useState(false);

  const handlePrintContract = async () => {
    setLoading(true);
    try {
      // 1. Kiểm tra PDF đã có chưa
      const contractRes = await api.get(`/contracts/${contractId}`);
      const contract = contractRes.data;
      
      if (!contract.contractPdfUrl && isStaff) {
        // 2. Tạo PDF nếu chưa có (chỉ staff)
        await api.post(`/contracts/${contractId}/pdf`);
      }
      
      // 3. Tải PDF
      const pdfRes = await fetch(`${API_URL}/contracts/${contractId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hop-dong-${contractId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Không thể tải PDF hợp đồng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePrintContract} disabled={loading}>
      {loading ? 'Đang tải...' : 'In hợp đồng'}
    </button>
  );
};
```

---

## Lưu ý

- ✅ PDF tự động download với tên: `hop-dong-CT-{contractNumber}.pdf`
- ✅ User/Staff/Buyer/Seller đều có thể tải PDF
- ✅ Chỉ Staff/Admin mới có quyền tạo PDF
- ✅ Nếu PDF chưa tồn tại, user sẽ thấy lỗi 404
