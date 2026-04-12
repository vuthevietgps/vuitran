import { ExportService } from './export.service';
import { Role } from '../common/interfaces/role.enum';

describe('ExportService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildService() {
    const service = Object.create(ExportService.prototype) as any;
    service.financialControlService = {
      getInvestorMetrics: jest.fn(),
      getAgingReport: jest.fn(),
    };
    service.auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    return service;
  }

  it('exports investor summary CSV with masked shareholder aging rows', async () => {
    const service = buildService();
    const user = {
      sub: 'shareholder-1',
      email: 'shareholder@example.com',
      fullName: 'Investor Demo',
      role: Role.SHAREHOLDER,
    };

    service.financialControlService.getInvestorMetrics.mockResolvedValue({
      snapshot: {
        cashOnHand: 6111000,
        totalFundBalance: 8800000,
        burnRate: 1450000,
        runway: 7.4,
      },
      revenue: {
        recognizedRevenue: {
          thisMonth: 6111000,
          ytd: 54000000,
        },
      },
      profitability: {
        grossProfit: 19500000,
        netProfit: 9800000,
      },
      customerBase: {
        activeStudents: 61,
        enrolledStudents: 69,
      },
      trend: {
        monthCount: 6,
      },
    });
    service.financialControlService.getAgingReport.mockResolvedValue({
      summary: {
        totalAR: 7250000,
        current: 0,
        '1-30': 1250000,
        '31-60': 2000000,
        '61-90': 1500000,
        '90+': 2500000,
      },
      details: [
        {
          parentName: 'PH #1',
          parentPhone: '',
          students: ['HS #1', 'HS #2'],
          totalDebt: 4250000,
          bucket: '90+',
          items: [],
        },
      ],
    });

    const csv = await service.exportInvestorSummaryCsv({ monthCount: 6 }, user);

    expect(service.financialControlService.getInvestorMetrics).toHaveBeenCalledWith(6);
    expect(service.financialControlService.getAgingReport).toHaveBeenCalledWith(user);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Section","Metric","Value","Parent","Masked phone","Students","Bucket","Notes"');
    expect(csv).toContain('"Aging detail","Outstanding receivable","4250000","PH #1","An danh","HS #1 / HS #2","90+","0 chi tiet"');
    expect(csv).not.toContain('090');
    expect(service.auditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'EXPORT',
      description: expect.stringContaining('Xuat bao cao co dong'),
    }));
  });
});
