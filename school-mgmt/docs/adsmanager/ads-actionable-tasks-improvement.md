# MÔ TẢ KỸ THUẬT: Cải tiến chức năng "Việc cần làm" cho nhân viên Ads

## 1. Tổng quan

### 1.1 Mục tiêu
Nâng cấp endpoint `GET /ads/actions-required` (phương thức `getActionsRequired()` trong `AdsAnalyticsService`) để tạo danh sách việc cần làm **cụ thể, có số liệu, có thể hành động ngay** cho nhân viên ads, dựa trên dữ liệu báo cáo thực tế.

### 1.2 Tình trạng hiện tại

#### Kiến trúc hiện hành
- **Backend:** `ads-analytics.service.ts` → `getActionsRequired()` (dòng 2056–2155)
- **Kiểu dữ liệu:** `ActionableSuggestion` trong `ads.types.ts` (dòng 282–295)
- **Controller:** `GET /ads/actions-required` trong `ads.controller.ts` — Roles: `DIRECTOR`, `OPS`
- **Frontend:** `AdsService.getActionsRequired()` trong `frontend/src/app/services/ads.service.ts`

#### Logic hiện tại (đơn giản, thiếu chi tiết)

| Loại gợi ý | Điều kiện kích hoạt | Hạn chế |
|---|---|---|
| `PAUSE_GROUP` | `totalNetProfit < 0` trong 7 ngày gần nhất (từ `getNetProfitByAdGroup`) | Chỉ dựa vào net profit 7 ngày, **không xét chi phí tối ưu, không phân biệt mức lỗ nặng/nhẹ, không xét xu hướng** |
| `ADJUST_BUDGET` | `changePercent > 20%` và confidence ≠ LOW (từ `getSuggestions`) | Dùng budget cố định 5M, **không dùng chi phí tối ưu thực tế/theo X**, threshold 20% quá thô |
| `CREATE_GROUP` | `unallocated > 0` (ngân sách chưa phân bổ) | **Chỉ 1 gợi ý chung chung**, không tính số lượng nhóm cần tạo, không dựa trên phân tích nhóm có lãi |

---

## 2. Thiết kế cải tiến chi tiết

### 2.1 Gợi ý TẠM DỪNG nhóm quảng cáo đang bị lỗ

#### Dữ liệu nguồn
- **Chi phí quảng cáo tối ưu (Optimal Ad Spend):** Lấy từ `getSuggestions()` → mỗi nhóm có `suggestedDailySpend` (ngân sách tối ưu theo mô hình logarithmic)
- **Chi phí quảng cáo thực tế:** `currentDailySpend` từ trung bình 7 ngày gần nhất
- **Lợi nhuận nhóm:** `effectiveNetProfit` từ `RealizedCohortRow` (lợi nhuận cohort thực + dự kiến)
- **Lợi nhuận chi tiết:** `netProfit` từ `NetProfitDailyRow` = `grossProfit - allocatedOverhead - adSpend`

#### Logic mới

```
VỚI MỖI nhóm quảng cáo ACTIVE:

  // Lấy dữ liệu
  actualDailySpend = trung bình chi phí ads 7 ngày gần nhất
  optimalDailySpend = suggestedDailySpend từ mô hình log-curve
  netProfit7d = tổng netProfit 7 ngày gần nhất (từ getNetProfitByAdGroup)
  effectiveNetProfit = lợi nhuận cohort thực/dự kiến (từ RealizedCohort)
  profitPerLead = averageProfitPerLead (lợi nhuận trung bình/lead)
  
  // Điều kiện tạm dừng
  shouldPause = FALSE
  pauseReasons = []
  
  NẾU netProfit7d < 0 VÀ effectiveNetProfit < 0:
    shouldPause = TRUE
    pauseReasons += "Lỗ liên tục: lỗ {|netProfit7d|}đ trong 7 ngày và cohort lỗ {|effectiveNetProfit|}đ"
  
  NẾU actualDailySpend > optimalDailySpend * 1.5 VÀ netProfit7d < 0:
    shouldPause = TRUE  
    pauseReasons += "Chi vượt tối ưu: đang chi {actualDailySpend}đ/ngày, tối ưu chỉ {optimalDailySpend}đ/ngày"
  
  NẾU profitPerLead !== null VÀ profitPerLead < 0 VÀ dataPoints >= 5:
    shouldPause = TRUE
    pauseReasons += "Mỗi lead đang tạo lỗ {|profitPerLead|}đ — cần sửa funnel trước khi chạy tiếp"

  // Phân loại ưu tiên
  NẾU shouldPause:
    NẾU |netProfit7d| > 2_000_000:    priority = 'CRITICAL'
    NGƯỢC LẠI NẾU |netProfit7d| > 500_000: priority = 'HIGH'
    NGƯỢC LẠI:                         priority = 'MEDIUM'
    
    TẠO ActionableSuggestion {
      type: 'PAUSE_GROUP',
      priority,
      title: "Tạm dừng nhóm QC: {adGroupName}",
      description: pauseReasons ghép lại,
      details: {
        netProfit7Days,
        effectiveNetProfit,
        actualDailySpend,
        optimalDailySpend,
        profitPerLead,
        overspendPercent: ((actualDailySpend - optimalDailySpend) / optimalDailySpend) * 100,
        platform,
        dataPoints,
      },
      relatedEntity: { type: 'AdGroup', id, name }
    }
```

#### Cải tiến so với hiện tại
- ✅ **Kết hợp 3 nguồn dữ liệu** (chi phí tối ưu, chi phí thực, lợi nhuận cohort) thay vì chỉ 1 điều kiện `netProfit < 0`
- ✅ **Phân loại mức lỗ** (CRITICAL / HIGH / MEDIUM) thay vì luôn HIGH
- ✅ **Hiển thị so sánh chi phí tối ưu vs thực tế** để nhân viên hiểu lý do
- ✅ **Xét profit per lead âm** để bắt nhóm có chuyển đổi yếu sớm

---

### 2.2 Gợi ý SỬA CHI PHÍ quảng cáo

#### Dữ liệu nguồn
- **Chi phí QC tối ưu (dữ liệu thật):** `suggestedDailySpend` từ `getSuggestions()` — mô hình `netProfit = A × log(spend + 1) + B` fitted trên dữ liệu cohort thực
- **Chi phí QC tối ưu theo X (refund rate override):** Gọi `getSuggestions()` lần 2 với `refundRatePercentX` — dùng tỷ lệ refund giả định (ví dụ: 0%, 10%, 20%) để stress-test
- **Chi phí thực tế:** `currentDailySpend` = trung bình 7 ngày gần nhất

#### Logic mới

```
VỚI MỖI nhóm quảng cáo ACTIVE có confidence ≠ LOW:

  // Phân tích 2 kịch bản song song
  optimalReal = suggestedDailySpend (dữ liệu thật, refundRatePercentX = null)
  optimalX    = suggestedDailySpend (với refundRatePercentX = X, ví dụ 15%)
  actual      = currentDailySpend
  
  // Tính mức chênh lệch
  deviationReal = actual - optimalReal
  deviationX    = actual - optimalX
  deviationPercentReal = (deviationReal / optimalReal) * 100
  deviationPercentX    = (deviationX / optimalX) * 100
  
  // Lợi nhuận kỳ vọng khi điều chỉnh
  expectedProfitAtOptimal = A × log(optimalReal + 1) + B
  expectedProfitAtCurrent = A × log(actual + 1) + B
  profitGain = expectedProfitAtOptimal - expectedProfitAtCurrent
  
  NẾU |deviationPercentReal| > 15%:  // threshold tinh chỉnh (thay vì 20% cũ)
    
    // Xác định hướng điều chỉnh
    NẾU deviationReal > 0:
      action = "GIẢM"
      title = "Giảm chi phí QC: {adGroupName}"
      description = "Đang chi {actual}đ/ngày, tối ưu chỉ {optimalReal}đ/ngày. 
                     Giảm về {optimalReal}đ/ngày sẽ tăng lợi nhuận ước tính {profitGain}đ/ngày."
    NGƯỢC LẠI:
      action = "TĂNG"
      title = "Tăng chi phí QC: {adGroupName}"
      description = "Đang chi {actual}đ/ngày, tối ưu là {optimalReal}đ/ngày.
                     Tăng lên {optimalReal}đ/ngày sẽ tăng lợi nhuận ước tính {profitGain}đ/ngày."
    
    // Ưu tiên
    NẾU |profitGain| > 500_000/ngày:  priority = 'HIGH'
    NGƯỢC LẠI NẾU |profitGain| > 100_000: priority = 'MEDIUM'
    NGƯỢC LẠI:                         priority = 'LOW'
    
    TẠO ActionableSuggestion {
      type: 'ADJUST_BUDGET',
      subType: action,  // 'INCREASE' hoặc 'DECREASE'
      priority,
      title,
      description,
      details: {
        currentDailySpend: actual,
        optimalDailySpendReal: optimalReal,
        optimalDailySpendX: optimalX,
        refundRatePercentX: X,
        expectedProfitAtOptimal,
        expectedProfitAtCurrent,
        estimatedDailyProfitGain: profitGain,
        estimatedMonthlyProfitGain: profitGain * 30,
        confidence,
        deviationPercentReal,
        deviationPercentX,
        coeffA, coeffB,  // để frontend có thể vẽ biểu đồ
        platform,
      },
      relatedEntity: { type: 'AdGroup', id, name }
    }
```

#### Cải tiến so với hiện tại
- ✅ **So sánh 2 kịch bản** chi phí tối ưu (dữ liệu thật vs theo X) — nhân viên thấy ngay so sánh
- ✅ **Tính lợi nhuận kỳ vọng khi điều chỉnh** thay vì chỉ hiện % thay đổi
- ✅ **Phân loại TĂNG/GIẢM** rõ ràng, threshold 15% thay vì 20%
- ✅ **Ước tính profit gain hàng ngày + tháng** giúp nhân viên đánh giá mức ảnh hưởng
- ✅ **Gửi coefficients A, B** để frontend vẽ đường cong lợi nhuận (nếu cần)

---

### 2.3 Gợi ý TẠO MỚI nhóm quảng cáo

#### Dữ liệu nguồn
- **Số lượng nhóm quảng cáo có lãi:** Đếm từ `summaryByGroup` (nhóm có `totalNetProfit > 0`)
- **Số lượng nhóm hoạt động:** Đếm nhóm `status = ACTIVE`
- **Tỷ lệ nhóm có lãi:** `profitableGroupCount / activeGroupCount`
- **Ngân sách chưa phân bổ:** `unallocated` từ `getSuggestions()`
- **ROI trung bình các nhóm có lãi:** Để ước tính ROI kỳ vọng nhóm mới

#### Logic mới

```
// Tổng hợp dữ liệu
allGroups = tất cả nhóm ACTIVE
profitableGroups = nhóm có effectiveNetProfit > 0 (từ realized cohort)
unprofitableGroups = nhóm có effectiveNetProfit <= 0
avgProfitPerProfitableGroup = trung bình effectiveNetProfit các nhóm có lãi
totalUnallocated = ngân sách chưa phân bổ tối ưu
avgDailySpendProfitable = trung bình suggestedDailySpend các nhóm có lãi có confidence >= MEDIUM

// Tính số nhóm cần tạo mới
NẾU totalUnallocated > 0 VÀ avgDailySpendProfitable > 0:
  suggestedNewGroupCount = FLOOR(totalUnallocated / avgDailySpendProfitable)
  suggestedNewGroupCount = MIN(suggestedNewGroupCount, 5)  // cap tối đa 5 nhóm/lần
NGƯỢC LẠI:
  suggestedNewGroupCount = 0

// Tính số lượng nhóm có lãi mục tiêu
// Quy tắc: nên có ít nhất 3 nhóm có lãi để đa dạng hóa rủi ro
targetProfitableCount = MAX(3, CEIL(allGroups.length * 0.6))
currentProfitableCount = profitableGroups.length
groupDeficit = MAX(0, targetProfitableCount - currentProfitableCount)

// Kết hợp 2 lý do: budget dư + thiếu nhóm lãi
totalSuggestedNewGroups = MAX(suggestedNewGroupCount, groupDeficit)
totalSuggestedNewGroups = MIN(totalSuggestedNewGroups, 5)

NẾU totalSuggestedNewGroups > 0:
  // Phân tích nền tảng nào nên tạo
  platformStats = {}
  VỚI MỖI platform (FACEBOOK, GOOGLE, TIKTOK):
    count = số nhóm có lãi trên platform đó
    avgROI = ROI trung bình các nhóm có lãi trên platform
    platformStats[platform] = { count, avgROI }
  
  suggestedPlatform = platform có avgROI cao nhất (và đã chạy)
  
  // Phân loại ưu tiên
  NẾU groupDeficit >= 2 VÀ totalUnallocated > 2_000_000:
    priority = 'HIGH'
  NGƯỢC LẠI NẾU groupDeficit >= 1 HOẶC totalUnallocated > 1_000_000:
    priority = 'MEDIUM'
  NGƯỢC LẠI:
    priority = 'LOW'
  
  TẠO ActionableSuggestion {
    type: 'CREATE_GROUP',
    priority,
    title: "Tạo {totalSuggestedNewGroups} nhóm QC mới",
    description: "Hiện có {currentProfitableCount}/{allGroups.length} nhóm có lãi 
                  (mục tiêu {targetProfitableCount} nhóm). 
                  Ngân sách chưa phân bổ: {totalUnallocated}đ/ngày.
                  Nên tạo {totalSuggestedNewGroups} nhóm mới, 
                  ưu tiên nền tảng {suggestedPlatform} (ROI tốt nhất: {avgROI}%).",
    details: {
      activeGroupCount: allGroups.length,
      profitableGroupCount: currentProfitableCount,
      unprofitableGroupCount: unprofitableGroups.length,
      targetProfitableCount,
      groupDeficit,
      suggestedNewGroupCount: totalSuggestedNewGroups,
      unallocatedBudget: totalUnallocated,
      suggestedBudgetPerNewGroup: avgDailySpendProfitable HOẶC FLOOR(totalUnallocated / totalSuggestedNewGroups),
      suggestedPlatform,
      platformBreakdown: platformStats,
      avgProfitPerProfitableGroup,
      estimatedMonthlyProfitIfSuccessful: avgProfitPerProfitableGroup * totalSuggestedNewGroups * 30,
    }
  }
```

#### Cải tiến so với hiện tại
- ✅ **Tính số lượng nhóm cần tạo** thay vì 1 gợi ý chung chung "tạo nhóm mới"
- ✅ **Dựa trên 2 tiêu chí:** ngân sách dư + tỷ lệ nhóm có lãi mục tiêu
- ✅ **Gợi ý nền tảng** nên tạo dựa trên ROI lịch sử
- ✅ **Ước tính ngân sách/nhóm mới** dựa trên mức chi tối ưu các nhóm đang lãi
- ✅ **Ước tính lợi nhuận tiềm năng** nếu nhóm mới thành công

---

## 3. Thay đổi kiến trúc

### 3.1 Mở rộng `ActionableSuggestion` interface

```typescript
// ads.types.ts
export interface ActionableSuggestion {
  type: 'PAUSE_GROUP' | 'ADJUST_BUDGET' | 'CREATE_GROUP';
  subType?: 'INCREASE' | 'DECREASE';        // MỚI: hướng điều chỉnh budget
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';  // MỚI: thêm CRITICAL
  title: string;
  description: string;
  reasons: string[];                          // MỚI: danh sách lý do chi tiết
  details: Record<string, any>;
  relatedEntity?: {
    type: 'AdGroup';
    id: string;
    name: string;
  };
  estimatedImpact?: {                         // MỚI: ước tính tác động
    dailyProfitChange: number;
    monthlyProfitChange: number;
  };
}
```

### 3.2 Cấu trúc phương thức `getActionsRequired()` mới

```typescript
async getActionsRequired(options?: {
  refundRatePercentX?: number;      // Tỷ lệ refund giả định cho kịch bản X
  lookbackDays?: number;            // Mặc định 7; có thể 14, 30
  targetProfitableRatio?: number;   // Mặc định 0.6 (60% nhóm phải có lãi)
  totalBudget?: number;             // Mặc định = tổng chi 7 ngày / 7
}): Promise<{
  actions: ActionableSuggestion[];
  summary: {
    totalActiveGroups: number;
    profitableGroups: number;
    unprofitableGroups: number;
    totalDailySpend: number;
    totalOptimalDailySpend: number;
    overallNetProfit7d: number;
    overallEffectiveNetProfit: number;
    generatedAt: string;
  };
}>
```

### 3.3 Luồng xử lý mới

```
getActionsRequired()
  │
  ├─ [Song song] ─┬─ getNetProfitByAdGroup(7 ngày)    → profitData
  │                ├─ getSuggestions(90 ngày, budget, maturity=60, refundRate=null)  → suggestionsReal
  │                └─ getSuggestions(90 ngày, budget, maturity=60, refundRate=X)     → suggestionsX
  │
  ├─ Merge dữ liệu từ 3 nguồn vào Map<adGroupId, GroupAnalysis>
  │
  ├─ BƯỚC 1: Phát sinh PAUSE_GROUP suggestions
  │   └─ Duyệt các nhóm đang lỗ + vượt chi phí tối ưu
  │
  ├─ BƯỚC 2: Phát sinh ADJUST_BUDGET suggestions (nhóm không bị PAUSE)
  │   └─ So sánh actual vs optimalReal vs optimalX
  │
  ├─ BƯỚC 3: Phát sinh CREATE_GROUP suggestions
  │   └─ Tính số nhóm cần tạo từ budget dư + tỷ lệ nhóm có lãi
  │
  ├─ Sắp xếp theo priority: CRITICAL > HIGH > MEDIUM > LOW
  │
  └─ Trả về { actions, summary }
```

### 3.4 Thay đổi Controller

```typescript
// ads.controller.ts
@Get('actions-required')
@Roles(Role.DIRECTOR, Role.OPS)
async getActionsRequired(@Query() query: QueryActionsRequiredDto) {
  return this.adsAnalyticsService.getActionsRequired({
    refundRatePercentX: query.refundRatePercentX,
    lookbackDays: query.lookbackDays,
    targetProfitableRatio: query.targetProfitableRatio,
    totalBudget: query.totalBudget,
  });
}
```

### 3.5 DTO mới

```typescript
// dto/query-actions-required.dto.ts
export class QueryActionsRequiredDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  refundRatePercentX?: number;

  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  @IsOptional()
  lookbackDays?: number;   // Mặc định: 7

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  @IsOptional()
  targetProfitableRatio?: number;  // Mặc định: 0.6

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalBudget?: number;   // Mặc định: tự tính từ chi thực tế 7 ngày
}
```

### 3.6 Thay đổi Frontend Interface

```typescript
// frontend/src/app/services/ads.service.ts

export interface ActionableSuggestion {
  type: 'PAUSE_GROUP' | 'ADJUST_BUDGET' | 'CREATE_GROUP';
  subType?: 'INCREASE' | 'DECREASE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  reasons: string[];
  details: Record<string, any>;
  relatedEntity?: {
    type: 'AdGroup';
    id: string;
    name: string;
  };
  estimatedImpact?: {
    dailyProfitChange: number;
    monthlyProfitChange: number;
  };
}

export interface ActionsRequiredResponse {
  actions: ActionableSuggestion[];
  summary: {
    totalActiveGroups: number;
    profitableGroups: number;
    unprofitableGroups: number;
    totalDailySpend: number;
    totalOptimalDailySpend: number;
    overallNetProfit7d: number;
    overallEffectiveNetProfit: number;
    generatedAt: string;
  };
}

// Service method
async getActionsRequired(params?: {
  refundRatePercentX?: number;
  lookbackDays?: number;
  targetProfitableRatio?: number;
  totalBudget?: number;
}): Promise<ActionsRequiredResponse> {
  let httpParams = new HttpParams();
  if (params?.refundRatePercentX !== undefined)
    httpParams = httpParams.set('refundRatePercentX', String(params.refundRatePercentX));
  if (params?.lookbackDays !== undefined)
    httpParams = httpParams.set('lookbackDays', String(params.lookbackDays));
  if (params?.targetProfitableRatio !== undefined)
    httpParams = httpParams.set('targetProfitableRatio', String(params.targetProfitableRatio));
  if (params?.totalBudget !== undefined)
    httpParams = httpParams.set('totalBudget', String(params.totalBudget));
  return this.http.get<ActionsRequiredResponse>(
    `${this.apiUrl}/actions-required`, { params: httpParams },
  ).toPromise() as Promise<ActionsRequiredResponse>;
}
```

---

## 4. Bảng tổng hợp logic quyết định

| Gợi ý | Dữ liệu đầu vào | Điều kiện kích hoạt | Priority |
|---|---|---|---|
| **PAUSE_GROUP** | netProfit7d, effectiveNetProfit, actualSpend, optimalSpend, profitPerLead | Lỗ liên tục (cả 7d + cohort) HOẶC chi > 150% tối ưu + lỗ HOẶC profit/lead < 0 | CRITICAL/HIGH/MEDIUM theo mức lỗ |
| **ADJUST_BUDGET (DECREASE)** | actualSpend, optimalReal, optimalX, coeffA, coeffB | actual > optimalReal * 1.15, confidence ≥ MEDIUM | HIGH/MEDIUM/LOW theo profit gain |
| **ADJUST_BUDGET (INCREASE)** | actualSpend, optimalReal, optimalX, coeffA, coeffB | actual < optimalReal * 0.85, confidence ≥ MEDIUM, nhóm đang có lãi | HIGH/MEDIUM/LOW theo profit gain |
| **CREATE_GROUP** | profitableCount, activeCount, unallocated, avgSpend nhóm lãi | groupDeficit > 0 HOẶC unallocated > avgDailySpend nhóm lãi | HIGH/MEDIUM/LOW theo mức thiếu |

---

## 5. Ví dụ output kỳ vọng

```json
{
  "actions": [
    {
      "type": "PAUSE_GROUP",
      "priority": "CRITICAL",
      "title": "Tạm dừng nhóm QC: FB - Toán lớp 3 HN",
      "description": "Nhóm này đang lỗ 3.200.000đ trong 7 ngày qua và lỗ cohort 5.100.000đ. Chi phí thực tế 800.000đ/ngày vượt 180% mức tối ưu 450.000đ/ngày.",
      "reasons": [
        "Lỗ liên tục: lỗ 3.200.000đ trong 7 ngày và cohort lỗ 5.100.000đ",
        "Chi vượt tối ưu: đang chi 800.000đ/ngày, tối ưu chỉ 450.000đ/ngày",
        "Mỗi lead đang tạo lỗ 120.000đ — cần sửa funnel trước khi chạy tiếp"
      ],
      "details": {
        "netProfit7Days": -3200000,
        "effectiveNetProfit": -5100000,
        "actualDailySpend": 800000,
        "optimalDailySpend": 450000,
        "profitPerLead": -120000,
        "overspendPercent": 77.8,
        "platform": "FACEBOOK",
        "dataPoints": 12
      },
      "relatedEntity": {
        "type": "AdGroup",
        "id": "6601a1b2c3d4e5f6a7b8c9d0",
        "name": "FB - Toán lớp 3 HN"
      },
      "estimatedImpact": {
        "dailyProfitChange": 457000,
        "monthlyProfitChange": 13710000
      }
    },
    {
      "type": "ADJUST_BUDGET",
      "subType": "DECREASE",
      "priority": "HIGH",
      "title": "Giảm chi phí QC: GG - Tiếng Anh HCM",
      "description": "Đang chi 1.200.000đ/ngày, tối ưu chỉ 700.000đ/ngày (thực tế) và 750.000đ/ngày (theo X=15%). Giảm về 700.000đ/ngày sẽ tăng lợi nhuận ước tính 350.000đ/ngày.",
      "reasons": [
        "Chi phí thực tế cao hơn 71% so với mức tối ưu",
        "Marginal profit tại mức chi hiện tại đã rất thấp"
      ],
      "details": {
        "currentDailySpend": 1200000,
        "optimalDailySpendReal": 700000,
        "optimalDailySpendX": 750000,
        "refundRatePercentX": 15,
        "estimatedDailyProfitGain": 350000,
        "estimatedMonthlyProfitGain": 10500000,
        "confidence": "HIGH",
        "deviationPercentReal": 71.4,
        "platform": "GOOGLE"
      },
      "relatedEntity": {
        "type": "AdGroup",
        "id": "6601a1b2c3d4e5f6a7b8c9d1",
        "name": "GG - Tiếng Anh HCM"
      },
      "estimatedImpact": {
        "dailyProfitChange": 350000,
        "monthlyProfitChange": 10500000
      }
    },
    {
      "type": "CREATE_GROUP",
      "priority": "MEDIUM",
      "title": "Tạo 2 nhóm QC mới",
      "description": "Hiện có 3/7 nhóm có lãi (mục tiêu 5 nhóm). Ngân sách chưa phân bổ: 1.500.000đ/ngày. Nên tạo 2 nhóm mới, ưu tiên nền tảng FACEBOOK (ROI tốt nhất: 45%).",
      "reasons": [
        "Thiếu 2 nhóm có lãi so với mục tiêu 60%",
        "Còn 1.500.000đ/ngày ngân sách chưa phân bổ tối ưu"
      ],
      "details": {
        "activeGroupCount": 7,
        "profitableGroupCount": 3,
        "unprofitableGroupCount": 4,
        "targetProfitableCount": 5,
        "groupDeficit": 2,
        "suggestedNewGroupCount": 2,
        "unallocatedBudget": 1500000,
        "suggestedBudgetPerNewGroup": 500000,
        "suggestedPlatform": "FACEBOOK",
        "platformBreakdown": {
          "FACEBOOK": { "profitableCount": 2, "avgROI": 45 },
          "GOOGLE": { "profitableCount": 1, "avgROI": 22 },
          "TIKTOK": { "profitableCount": 0, "avgROI": -15 }
        },
        "estimatedMonthlyProfitIfSuccessful": 9000000
      },
      "estimatedImpact": {
        "dailyProfitChange": 300000,
        "monthlyProfitChange": 9000000
      }
    }
  ],
  "summary": {
    "totalActiveGroups": 7,
    "profitableGroups": 3,
    "unprofitableGroups": 4,
    "totalDailySpend": 5200000,
    "totalOptimalDailySpend": 3500000,
    "overallNetProfit7d": -1800000,
    "overallEffectiveNetProfit": 2300000,
    "generatedAt": "2026-03-14T00:00:00.000Z"
  }
}
```

---

## 6. Tệp cần thay đổi

| Tệp | Hành động |
|---|---|
| `backend/src/ads/ads.types.ts` | Mở rộng `ActionableSuggestion`: thêm `subType`, `CRITICAL` priority, `reasons[]`, `estimatedImpact` |
| `backend/src/ads/ads-analytics.service.ts` | Viết lại `getActionsRequired()` theo logic 3 bước mới |
| `backend/src/ads/dto/query-actions-required.dto.ts` | **Tạo mới** — DTO cho query params |
| `backend/src/ads/ads.controller.ts` | Cập nhật endpoint `actions-required` nhận query params |
| `frontend/src/app/services/ads.service.ts` | Cập nhật interfaces + method `getActionsRequired()` |
| Component frontend hiển thị (nếu có) | Cập nhật UI để hiển thị format mới |

---

## 7. Điểm lưu ý kỹ thuật

1. **Performance:** `getActionsRequired()` gọi song song 3 phương thức nặng (`getNetProfitByAdGroup`, `getSuggestions` × 2). Cần đảm bảo `Promise.all` và caching MongoDB aggregation kết quả nếu cần.

2. **Budget mặc định:** Hiện hardcode `5_000_000`. Nên tự tính = `tổng chi thực tế 7 ngày / 7` hoặc cho phép truyền từ client.

3. **Lookback period:** Hiện dùng 7 ngày cho profit, nhưng gọi `getSuggestions` cần ≥ 30–90 ngày để mô hình cohort đủ dữ liệu. Cần dùng 2 range khác nhau: 7 ngày cho PAUSE, 90 ngày cho ADJUST + CREATE.

4. **Loại bỏ trùng lặp:** Nhóm đã bị PAUSE_GROUP thì không tạo thêm ADJUST_BUDGET. Logic cần dùng `Set<adGroupId>` để theo dõi.

5. **Backwards compatibility:** Giữ response cũ (array) nếu client cũ chưa update, hoặc wrap trong object mới `{ actions, summary }` và update frontend cùng lúc.

6. **Refund Rate X:** Giá trị mặc định X nên là trung bình refund rate thực tế hoặc cấu hình từ settings. Có thể mặc định 10-15%.
