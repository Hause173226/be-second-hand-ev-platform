# User Schema Migration Guide

## 🚨 QUAN TRỌNG: Backward Compatibility

Khi thay đổi User schema, chúng ta cần đảm bảo không ảnh hưởng đến các nhánh khác và dữ liệu hiện tại.

## 📋 Migration Strategy

### 1. **Dual Schema Support**

- User model hỗ trợ cả old và new fields
- Legacy fields được giữ lại để backward compatibility
- New fields được thêm vào song song

### 2. **Field Mapping**

| **Legacy Field** | **New Field**  | **Mapping Logic**                        |
| ---------------- | -------------- | ---------------------------------------- |
| `password`       | `passwordHash` | Direct mapping                           |
| `role`           | `roles`        | `role` → `[role]`                        |
| `isActive`       | `status`       | `true` → `ACTIVE`, `false` → `SUSPENDED` |
| `fullName`       | `fullName`     | Same field name                          |

### 3. **Migration Commands**

```bash
# Kiểm tra dữ liệu hiện tại
npm run migrate:check

# Chạy migration
npm run migrate

# Rollback nếu cần
npm run migrate:rollback
```

## 🔄 Migration Process

### **Step 1: Pre-Migration Check**

```bash
npm run migrate:check
```

- Kiểm tra dữ liệu hiện tại
- Xác nhận không có conflicts
- Backup database

### **Step 2: Run Migration**

```bash
npm run migrate
```

- Migrate tất cả users từ old schema sang new schema
- Giữ lại legacy fields để backward compatibility
- Log chi tiết quá trình migration

### **Step 3: Post-Migration Verification**

- Test các API endpoints
- Kiểm tra dữ liệu đã được migrate đúng
- Verify backward compatibility

## 🛡️ Safety Measures

### **1. Database Backup**

```bash
# Backup trước khi migration
mongodump --db second-hand-ev-platform --out backup-$(date +%Y%m%d)
```

### **2. Rollback Plan**

```bash
# Rollback nếu có vấn đề
npm run migrate:rollback
```

### **3. Testing**

- Test trên staging environment trước
- Verify tất cả API endpoints hoạt động
- Kiểm tra performance impact

## 📊 Impact Analysis

### **Affected Components:**

- ✅ **User Authentication** - Backward compatible
- ✅ **Profile Management** - Backward compatible
- ✅ **KYC System** - Backward compatible
- ✅ **Payment Methods** - Backward compatible

### **API Compatibility:**

- ✅ **GET /api/users/profile** - Works with both schemas
- ✅ **POST /api/users/signup** - Works with both schemas
- ✅ **POST /api/users/signin** - Works with both schemas

## 🔧 Implementation Details

### **Virtual Fields**

```typescript
// Map legacy fields to new fields
userSchema.virtual("role").get(function () {
  return this.roles && this.roles.length > 0 ? this.roles[0] : this.role;
});

userSchema.virtual("isActive").get(function () {
  return this.status === "ACTIVE";
});
```

### **Pre-save Middleware**

```typescript
// Sync data between old and new fields
userSchema.pre("save", function (next) {
  if (this.password && !this.passwordHash) {
    this.passwordHash = this.password;
  }
  // ... other mappings
  next();
});
```

## 🚀 Deployment Strategy

### **1. Blue-Green Deployment**

- Deploy new version với dual schema support
- Gradually migrate users
- Monitor for issues

### **2. Feature Flags**

- Enable new schema features gradually
- A/B test với subset users
- Rollback nếu có issues

### **3. Monitoring**

- Monitor API response times
- Track error rates
- Alert on data inconsistencies

## 📝 Checklist

- [ ] Database backup completed
- [ ] Migration script tested on staging
- [ ] All API endpoints verified
- [ ] Performance impact assessed
- [ ] Rollback plan prepared
- [ ] Team notified of changes
- [ ] Documentation updated

## 🆘 Emergency Procedures

### **If Migration Fails:**

1. Stop the migration process
2. Run rollback: `npm run migrate:rollback`
3. Restore from backup if needed
4. Investigate and fix issues
5. Retry migration after fixes

### **If Data Corruption Detected:**

1. Immediately stop all write operations
2. Restore from latest backup
3. Investigate root cause
4. Implement additional safety measures
5. Re-run migration with fixes

## 📞 Support

Nếu có vấn đề với migration:

- Check logs: `tail -f logs/migration.log`
- Contact: [Team Lead]
- Emergency: [On-call Engineer]
